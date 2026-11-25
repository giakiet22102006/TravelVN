import { cookies } from "next/headers";
import type { MemberTier } from "@/types/ota";
import { prisma } from "./prisma";
import { computeMemberTier } from "./loyalty";
import {
  CLIENT_TOKEN_COOKIE,
  computePasswordSig,
  verifyClientToken,
} from "./jwt";

export const CLIENT_USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  address: true,
  avatar: true,
  provider: true,
  status: true,
  loyaltyPoints: true,
  lifetimePoints: true,
  createdAt: true,
} as const;

export interface ClientUserPublic {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  address: string | null;
  avatar: string | null;
  provider: string;
  status: string;
  hasPassword: boolean;
  loyaltyPoints: number;
  lifetimePoints: number;
  memberTier?: MemberTier;
}

export interface RawClientUserRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  address: string | null;
  avatar: string | null;
  provider: string;
  status: string;
  loyaltyPoints: number;
  lifetimePoints: number;
  password?: string | null;
}

export function toClientUserPublic(
  rawUser: RawClientUserRecord,
  options?: { hasPassword?: boolean }
): ClientUserPublic & { memberTier: MemberTier } {
  const hasPassword =
    options?.hasPassword !== undefined
      ? options.hasPassword
      : Boolean(rawUser.password);

  return {
    id: rawUser.id,
    fullName: rawUser.fullName,
    email: rawUser.email,
    phone: rawUser.phone,
    address: rawUser.address,
    avatar: rawUser.avatar,
    provider: rawUser.provider,
    status: rawUser.status,
    hasPassword,
    loyaltyPoints: rawUser.loyaltyPoints,
    lifetimePoints: rawUser.lifetimePoints,
    memberTier: computeMemberTier(rawUser.lifetimePoints).tier,
  };
}

export async function getCurrentUser(): Promise<ClientUserPublic | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(CLIENT_TOKEN_COOKIE)?.value;
    if (!token) return null;

    const payload = await verifyClientToken(token);
    if (!payload) return null;

    const user = await prisma.user.findFirst({
      where: {
        id: payload.sub,
        deleted: false,
        status: "ACTIVE",
      },
      select: {
        ...CLIENT_USER_SELECT,
        password: true,
      },
    });

    if (!user) return null;

    if (
      payload.pwdSig &&
      payload.pwdSig !== (await computePasswordSig(user.password))
    ) {
      return null;
    }

    return toClientUserPublic(user);
  } catch {
    return null;
  }
}
