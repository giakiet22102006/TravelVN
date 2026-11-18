import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_TOKEN_COOKIE,
  buildCookieOptions,
  isHttpsRequest,
  signAdminToken,
  verifyPassword,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const rememberPassword = Boolean(body.rememberPassword);

    if (!email || !password) {
      return NextResponse.json(
        { message: "Vui lòng nhập đầy đủ email và mật khẩu" },
        { status: 400 }
      );
    }

    const account = await prisma.adminAccount.findFirst({
      where: { email, deleted: false },
      include: { role: { select: { id: true, name: true } } },
    });

    if (!account) {
      return NextResponse.json(
        { message: "Email hoặc mật khẩu không đúng" },
        { status: 401 }
      );
    }

    const isMatch = await verifyPassword(password, account.password);
    if (!isMatch) {
      return NextResponse.json(
        { message: "Email hoặc mật khẩu không đúng" },
        { status: 401 }
      );
    }

    if (account.status === "INITIAL") {
      return NextResponse.json(
        { message: "Tài khoản của bạn đang chờ kích hoạt!" },
        { status: 403 }
      );
    }

    if (account.status === "INACTIVE") {
      return NextResponse.json(
        { message: "Tài khoản đã bị tạm khóa!" },
        { status: 403 }
      );
    }

    const maxAgeSeconds = rememberPassword ? 30 * 24 * 60 * 60 : 24 * 60 * 60;
    const token = await signAdminToken(
      {
        sub: account.id,
        email: account.email,
        roleId: account.roleId,
      },
      rememberPassword ? "30d" : "1d"
    );

    const response = NextResponse.json({
      message: "Đăng nhập thành công",
      account: {
        id: account.id,
        fullName: account.fullName,
        email: account.email,
        avatar: account.avatar,
        roleName: account.role?.name || "Quản trị viên",
      },
    });

    response.cookies.set(
      ADMIN_TOKEN_COOKIE,
      token,
      buildCookieOptions(maxAgeSeconds, isHttpsRequest(req))
    );

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { message: "Có lỗi xảy ra khi đăng nhập" },
      { status: 500 }
    );
  }
}
