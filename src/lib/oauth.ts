import { NextRequest, NextResponse } from "next/server";
import { RecordStatus } from "@prisma/client";
import { prisma } from "./prisma";
import {
  buildCookieOptions,
  CLIENT_TOKEN_COOKIE,
  isHttpsRequest,
  signClientToken,
} from "./jwt";
import { CLIENT_USER_SELECT, type ClientUserPublic } from "./client-auth";

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

export function sanitizeRedirectPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/account/orders";
  }
  return raw;
}

export async function attachClientSessionCookie(
  res: NextResponse,
  user: ClientUserPublic,
  req: NextRequest
) {
  const token = await signClientToken(
    {
      sub: user.id,
      email: user.email,
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
}): Promise<{ user?: ClientUserPublic; error?: string; status?: number }> {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();

  if (!email || !fullName) {
    return {
      error: "Thiếu thông tin email hoặc họ tên từ Google",
      status: 400,
    };
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: {
      ...CLIENT_USER_SELECT,
      password: true,
      deleted: true,
    },
  });

  if (existing && !existing.deleted && existing.status === RecordStatus.INACTIVE) {
    return {
      error: "Tài khoản của bạn đang bị tạm khóa. Vui lòng liên hệ CSKH.",
      status: 403,
    };
  }

  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        fullName: existing.deleted ? fullName : existing.fullName || fullName,
        avatar: existing.avatar || input.avatar || null,
        provider: existing.password ? existing.provider : input.provider,
        providerId: input.providerId,
        deleted: false,
        status: RecordStatus.ACTIVE,
      },
      select: {
        ...CLIENT_USER_SELECT,
        password: true,
      },
    });
    const { password, ...rest } = updated;
    return { user: { ...rest, hasPassword: Boolean(password) } };
  }

  const created = await prisma.user.create({
    data: {
      fullName,
      email,
      avatar: input.avatar || null,
      provider: input.provider,
      providerId: input.providerId,
      status: RecordStatus.ACTIVE,
    },
    select: {
      ...CLIENT_USER_SELECT,
      password: true,
    },
  });

  const { password, ...rest } = created;
  return { user: { ...rest, hasPassword: Boolean(password) } };
}
