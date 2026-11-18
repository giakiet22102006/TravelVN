import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { CLIENT_TOKEN_COOKIE, verifyClientToken } from "./jwt";

export const CLIENT_USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  address: true,
  avatar: true,
  provider: true,
  status: true,
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

    const { password, ...rest } = user;
    return {
      ...rest,
      hasPassword: Boolean(password),
    };
  } catch {
    return null;
  }
}
