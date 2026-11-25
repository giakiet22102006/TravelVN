import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_TOKEN_COOKIE,
  buildCookieOptions,
  computePasswordSig,
  getCurrentAdmin,
  isHttpsRequest,
  signAdminToken,
} from "@/lib/auth";

export async function GET() {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
    }

    return NextResponse.json({ item: admin });
  } catch (error) {
    console.error("GET /api/admin/profile error:", error);
    return NextResponse.json(
      { message: "Lỗi tải thông tin cá nhân" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
    }

    const body = await req.json();
    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();

    if (!fullName || !email) {
      return NextResponse.json(
        { message: "Họ tên và Email không được để trống" },
        { status: 400 }
      );
    }

    const emailTaken = await prisma.adminAccount.findFirst({
      where: { email, NOT: { id: admin.id } },
      select: { id: true },
    });
    if (emailTaken) {
      return NextResponse.json(
        { message: "Email đã được sử dụng bởi tài khoản khác" },
        { status: 409 }
      );
    }

    const updated = await prisma.adminAccount.update({
      where: { id: admin.id },
      data: {
        fullName,
        email,
        phone: body.phone ? String(body.phone).trim() : null,
        positionCompany: body.positionCompany
          ? String(body.positionCompany).trim()
          : null,
        avatar: body.avatar ? String(body.avatar).trim() : null,
        updatedById: admin.id,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        positionCompany: true,
        avatar: true,
        roleId: true,
        password: true,
        role: { select: { id: true, name: true } },
      },
    });

    const { password: passwordHash, ...publicUpdated } = updated;

    const response = NextResponse.json({
      message: "Cập nhật thông tin cá nhân thành công!",
      item: publicUpdated,
    });

    if (email !== admin.email) {
      const pwdSig = await computePasswordSig(passwordHash);
      const token = await signAdminToken({
        sub: publicUpdated.id,
        email: publicUpdated.email,
        roleId: publicUpdated.roleId,
        pwdSig,
      });
      response.cookies.set(
        ADMIN_TOKEN_COOKIE,
        token,
        buildCookieOptions(7 * 24 * 60 * 60, isHttpsRequest(req))
      );
    }

    return response;
  } catch (error) {
    console.error("PUT /api/admin/profile error:", error);
    return NextResponse.json(
      { message: "Lỗi cập nhật thông tin cá nhân" },
      { status: 500 }
    );
  }
}
