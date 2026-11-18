import { NextRequest, NextResponse } from "next/server";
import { RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getClientNewsBySlug } from "@/lib/client-data";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const data = await getClientNewsBySlug(slug);
    if (!data) {
      return NextResponse.json(
        { message: "Bài viết không tồn tại" },
        { status: 404 }
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/client/news/[slug] error:", error);
    return NextResponse.json(
      { message: "Không thể tải bài viết" },
      { status: 500 }
    );
  }
}

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    await prisma.newsArticle.updateMany({
      where: {
        slug,
        deleted: false,
        status: RecordStatus.ACTIVE,
      },
      data: {
        views: { increment: 1 },
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
