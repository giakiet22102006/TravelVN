import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { getCurrentUser } from "@/lib/client-auth";
import { StorageService } from "@/lib/storage";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  try {
    const [admin, user] = await Promise.all([
      getCurrentAdmin(),
      getCurrentUser(),
    ]);

    if (!admin && !user) {
      return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { message: "Vui lòng chọn file ảnh hợp lệ" },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { message: "Chỉ hỗ trợ định dạng ảnh (PNG, JPG, WebP, SVG)" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { message: "Dung lượng ảnh tối đa 10MB" },
        { status: 400 }
      );
    }

    const result = await StorageService.uploadImage(file);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { message: "Lỗi tải ảnh lên hệ thống" },
      { status: 500 }
    );
  }
}
