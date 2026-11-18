import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }
  return NextResponse.json({ account: admin });
}
