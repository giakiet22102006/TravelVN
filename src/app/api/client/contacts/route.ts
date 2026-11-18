import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();

    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { message: "Vui lòng nhập địa chỉ email hợp lệ" },
        { status: 400 }
      );
    }

    const existing = await prisma.contact.findFirst({
      where: { email, deleted: false },
    });

    if (existing) {
      return NextResponse.json(
        {
          message: "Email của bạn đã được đăng ký nhận tin khuyến mãi trước đó!",
          contact: existing,
        },
        { status: 201 }
      );
    }

    const contact = await prisma.contact.create({
      data: { email },
    });

    return NextResponse.json(
      {
        message: "Đăng ký nhận bản tin thành công!",
        contact,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/client/contacts error:", error);
    return NextResponse.json(
      { message: "Lỗi hệ thống khi đăng ký email" },
      { status: 500 }
    );
  }
}
