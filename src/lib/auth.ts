import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import {
  ADMIN_TOKEN_COOKIE,
  computePasswordSig,
  verifyAdminToken,
} from "./jwt";

export * from "./jwt";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hashed: string
): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

export async function getCurrentAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifyAdminToken(token);
  if (!payload) return null;

  const account = await prisma.adminAccount.findFirst({
    where: {
      id: payload.sub,
      deleted: false,
      status: "ACTIVE",
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      positionCompany: true,
      avatar: true,
      status: true,
      roleId: true,
      password: true,
      role: {
        select: {
          id: true,
          name: true,
          permissions: true,
        },
      },
    },
  });

  if (!account) return null;

  if (
    payload.pwdSig &&
    payload.pwdSig !== (await computePasswordSig(account.password))
  ) {
    return null;
  }

  const { password: _pw, ...publicAccount } = account;
  return publicAccount;
}

export type CurrentAdminRecord = NonNullable<
  Awaited<ReturnType<typeof getCurrentAdmin>>
>;

export function isSuperAdmin(admin: CurrentAdminRecord): boolean {
  return admin.roleId === "role-admin";
}

export function extractPermissionStrings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => String(item)).filter(Boolean);
}

export function hasAdminPermission(
  admin: CurrentAdminRecord,
  required?: string | string[]
): boolean {
  if (!required || (Array.isArray(required) && required.length === 0)) {
    return true;
  }
  if (isSuperAdmin(admin)) {
    return true;
  }
  const perms = new Set(extractPermissionStrings(admin.role?.permissions));
  const requiredList = Array.isArray(required) ? required : [required];
  return requiredList.some((key) => perms.has(key));
}

export async function requireAdmin(requiredPermission?: string | string[]): Promise<
  | { admin: CurrentAdminRecord; error?: never }
  | { admin?: never; error: NextResponse }
> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return {
      error: NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 }),
    };
  }
  if (!hasAdminPermission(admin, requiredPermission)) {
    return {
      error: NextResponse.json(
        { message: "Bạn không có quyền thực hiện thao tác này" },
        { status: 403 }
      ),
    };
  }
  return { admin };
}
