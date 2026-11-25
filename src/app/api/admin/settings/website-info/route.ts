import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { revalidateClientShellCache } from "@/lib/cache-tags";

export async function GET() {
  try {
    const auth = await requireAdmin("setting_view");
    if (auth.error) return auth.error;

    let item = await prisma.websiteInfo.findUnique({
      where: { id: "default" },
    });

    if (!item) {
      item = await prisma.websiteInfo.create({
        data: { id: "default" },
      });
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error("GET /api/admin/settings/website-info error:", error);
    return NextResponse.json(
      { message: "Lỗi tải thông tin website" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin("setting_edit");
    if (auth.error) return auth.error;

    const body = await req.json();
    const websiteName = String(body.websiteName || "").trim();
    if (!websiteName) {
      return NextResponse.json(
        { message: "Tên website không được để trống" },
        { status: 400 }
      );
    }

    const phone = String(body.phone || "").trim();
    const email = String(body.email || "").trim();
    const address = String(body.address || "").trim();

    const item = await prisma.websiteInfo.upsert({
      where: { id: "default" },
      update: {
        websiteName,
        phone,
        email,
        address,
        logo: body.logo ? String(body.logo).trim() : null,
        favicon: body.favicon ? String(body.favicon).trim() : null,
      },
      create: {
        id: "default",
        websiteName,
        phone,
        email,
        address,
        logo: body.logo ? String(body.logo).trim() : null,
        favicon: body.favicon ? String(body.favicon).trim() : null,
      },
    });

    revalidateClientShellCache();

    return NextResponse.json({
      message: "Cập nhật thông tin website thành công!",
      item,
    });
  } catch (error) {
    console.error("PUT /api/admin/settings/website-info error:", error);
    return NextResponse.json(
      { message: "Lỗi cập nhật thông tin website" },
      { status: 500 }
    );
  }
}
