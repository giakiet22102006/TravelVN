import { NextRequest, NextResponse } from "next/server";
import { Prisma, RecordStatus } from "@prisma/client";
import type { MemberTier } from "@/types/ota";
import { prisma } from "./prisma";
import {
  buildCookieOptions,
  CLIENT_TOKEN_COOKIE,
  computePasswordSig,
  isHttpsRequest,
  signClientToken,
} from "./jwt";
import {
  CLIENT_USER_SELECT,
  toClientUserPublic,
  type ClientUserPublic,
} from "./client-auth";
import { grantWelcomeBonusTx } from "./loyalty";
import { claimVerifiedEmailOrdersTx } from "./order-claim";

export type SupportedOAuthProvider = "google";

export function parseOAuthProvider(raw: string): SupportedOAuthProvider | null {
  const lower = raw.trim().toLowerCase();
  if (lower === "google") return "google";
  return null;
}

export function hasRealOAuthConfig(provider: SupportedOAuthProvider): boolean {
  if (provider === "google") {
    return Boolean(
      process.env.GOOGLE_CLIENT_ID?.trim() &&
        process.env.GOOGLE_CLIENT_SECRET?.trim()
    );
  }
  return false;
}

export function isOAuthSandboxEnabled(
  provider: SupportedOAuthProvider
): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.ENABLE_OAUTH_SANDBOX === "true" &&
    !hasRealOAuthConfig(provider)
  );
}

const OAUTH_DUMMY_ORIGIN = "http://localhost";
const OAUTH_SENTINEL_ORIGIN = "http://sentinel.invalid";

export function sanitizeRedirectPath(
  raw: string | null | undefined,
  fallback = "/"
): string {
  const rawNext = (raw || "").trim();
  if (
    !rawNext.startsWith("/") ||
    rawNext.startsWith("//") ||
    rawNext.startsWith("/\\") ||
    rawNext.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(rawNext)
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(rawNext, OAUTH_DUMMY_ORIGIN);
    if (
      parsed.origin !== OAUTH_DUMMY_ORIGIN ||
      parsed.host !== "localhost" ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      !parsed.pathname.startsWith("/") ||
      parsed.pathname.startsWith("//") ||
      parsed.pathname.startsWith("/\\") ||
      /%5c/i.test(parsed.pathname)
    ) {
      return fallback;
    }

    const candidate = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (
      !candidate.startsWith("/") ||
      candidate.startsWith("//") ||
      candidate.startsWith("/\\") ||
      candidate.includes("\\") ||
      /[\u0000-\u001f\u007f]/.test(candidate) ||
      /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(candidate)
    ) {
      return fallback;
    }

    const reparsed = new URL(candidate, OAUTH_SENTINEL_ORIGIN);
    if (
      reparsed.origin !== OAUTH_SENTINEL_ORIGIN ||
      reparsed.host !== "sentinel.invalid" ||
      reparsed.username !== "" ||
      reparsed.password !== "" ||
      !reparsed.pathname.startsWith("/") ||
      reparsed.pathname.startsWith("//") ||
      reparsed.pathname.startsWith("/\\")
    ) {
      return fallback;
    }

    return candidate;
  } catch {
    return fallback;
  }
}

export async function attachClientSessionCookie(
  res: NextResponse,
  user: ClientUserPublic,
  req: NextRequest,
  passwordHash?: string | null
) {
  const pwdSig = await computePasswordSig(passwordHash);
  const token = await signClientToken(
    {
      sub: user.id,
      email: user.email,
      pwdSig,
    },
    "30d"
  );
  res.cookies.set(
    CLIENT_TOKEN_COOKIE,
    token,
    buildCookieOptions(30 * 24 * 60 * 60, isHttpsRequest(req))
  );
  return res;
}

export async function upsertOAuthUser(input: {
  email: string;
  fullName: string;
  avatar?: string | null;
  provider: "GOOGLE";
  providerId: string;
  emailVerified?: boolean;
}): Promise<{
  user?: ClientUserPublic & { memberTier: MemberTier };
  passwordHash?: string | null;
  isNewUser?: boolean;
  claimedOrderCount?: number;
  pointsAwarded?: number;
  error?: string;
  errorCode?: string;
  status?: number;
}> {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();

  if (!email || !fullName) {
    return {
      error: "Thiếu thông tin email hoặc họ tên từ Google",
      status: 400,
    };
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.user.findUnique({
          where: { email },
          select: {
            ...CLIENT_USER_SELECT,
            password: true,
            deleted: true,
          },
        });

        if (
          existing &&
          (existing.deleted || existing.status !== RecordStatus.ACTIVE)
        ) {
          return {
            error: "Tài khoản của bạn đang bị tạm khóa. Vui lòng liên hệ CSKH.",
            errorCode: "account_locked",
            status: 403,
          };
        }

        let targetUserId: string;
        let isNewUser = false;

        if (existing) {
          const updated = await tx.user.update({
            where: { id: existing.id },
            data: {
              fullName: existing.fullName || fullName,
              avatar: existing.avatar || input.avatar || null,
              provider: existing.password ? existing.provider : input.provider,
              providerId: input.providerId,
            },
            select: { id: true },
          });
          targetUserId = updated.id;
        } else {
          const created = await tx.user.create({
            data: {
              fullName,
              email,
              avatar: input.avatar || null,
              provider: input.provider,
              providerId: input.providerId,
              status: RecordStatus.ACTIVE,
            },
            select: { id: true },
          });
          targetUserId = created.id;
          isNewUser = true;
          await grantWelcomeBonusTx(tx, created.id);
        }

        let claimedOrderCount = 0;
        let pointsAwarded = 0;
        if (input.emailVerified === true) {
          const claimRes = await claimVerifiedEmailOrdersTx(
            tx,
            targetUserId,
            email
          );
          claimedOrderCount = claimRes.claimedCount;
          pointsAwarded = claimRes.pointsAwarded;
        }

        const freshUser = await tx.user.findUniqueOrThrow({
          where: { id: targetUserId },
          select: {
            ...CLIENT_USER_SELECT,
            password: true,
          },
        });

        return {
          user: toClientUserPublic(freshUser),
          passwordHash: freshUser.password,
          isNewUser,
          claimedOrderCount,
          pointsAwarded,
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        attempt === 0
      ) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Failed to upsert OAuth user after retry");
}
