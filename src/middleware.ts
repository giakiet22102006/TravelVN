import { NextRequest, NextResponse } from "next/server";
import { ADMIN_TOKEN_COOKIE, verifyAdminToken } from "@/lib/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin")) {
    const isAuthPage = pathname.startsWith("/admin/account");
    const token = req.cookies.get(ADMIN_TOKEN_COOKIE)?.value;
    const verified = token ? await verifyAdminToken(token) : null;

    if (!isAuthPage && !verified) {
      const loginUrl = new URL("/admin/account/login", req.url);
      return NextResponse.redirect(loginUrl);
    }

    if (isAuthPage && verified && pathname === "/admin/account/login") {
      const targetUrl = new URL("/admin/tours", req.url);
      return NextResponse.redirect(targetUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
