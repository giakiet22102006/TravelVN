import { NextRequest, NextResponse } from "next/server";
import {
  buildCookieOptions,
  CLIENT_TOKEN_COOKIE,
  isHttpsRequest,
} from "@/lib/jwt";

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ message: "Đã đăng xuất" });
  res.cookies.set(
    CLIENT_TOKEN_COOKIE,
    "",
    buildCookieOptions(0, isHttpsRequest(req))
  );
  return res;
}
