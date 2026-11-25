import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_TOKEN_COOKIE,
  buildCookieOptions,
  isHttpsRequest,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ message: "Đã đăng xuất" });
  response.cookies.set(
    ADMIN_TOKEN_COOKIE,
    "",
    buildCookieOptions(0, isHttpsRequest(req))
  );
  return response;
}
