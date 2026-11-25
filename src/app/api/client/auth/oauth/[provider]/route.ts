import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  buildCookieOptions,
  isHttpsRequest,
  OAUTH_STATE_COOKIE,
} from "@/lib/jwt";
import {
  attachClientSessionCookie,
  hasRealOAuthConfig,
  isOAuthSandboxEnabled,
  parseOAuthProvider,
  sanitizeRedirectPath,
  upsertOAuthUser,
} from "@/lib/oauth";

function buildGoogleAuthorizeUrl(req: NextRequest, state: string): string {
  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/client/auth/oauth/google/callback`;

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", (process.env.GOOGLE_CLIENT_ID || "").trim());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: rawProvider } = await params;
  const provider = parseOAuthProvider(rawProvider);
  if (!provider) {
    return NextResponse.json(
      { message: "Nhà cung cấp đăng nhập không được hỗ trợ" },
      { status: 400 }
    );
  }

  const nextPath = sanitizeRedirectPath(req.nextUrl.searchParams.get("next"));
  const isCheck = req.nextUrl.searchParams.get("check") === "1";

  if (!hasRealOAuthConfig(provider)) {
    if (!isOAuthSandboxEnabled(provider)) {
      if (isCheck) {
        return NextResponse.json(
          { message: "Đăng nhập Google chưa được cấu hình trên hệ thống" },
          { status: 403 }
        );
      }
      return NextResponse.redirect(
        new URL("/login?error=oauth_config", req.nextUrl.origin)
      );
    }
    if (isCheck) {
      return NextResponse.json({ mode: "sandbox", provider, next: nextPath });
    }
    const sandboxUrl = new URL("/login", req.nextUrl.origin);
    sandboxUrl.searchParams.set("oauth_sandbox", provider);
    sandboxUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(sandboxUrl);
  }

  const state = crypto.randomBytes(24).toString("hex");
  const authorizeUrl = buildGoogleAuthorizeUrl(req, state);
  const stateCookiePayload = JSON.stringify({
    provider,
    state,
    next: nextPath,
  });

  const response = isCheck
    ? NextResponse.json({ mode: "oauth", url: authorizeUrl })
    : NextResponse.redirect(authorizeUrl);

  response.cookies.set(
    OAUTH_STATE_COOKIE,
    stateCookiePayload,
    buildCookieOptions(600, isHttpsRequest(req))
  );
  return response;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider: rawProvider } = await params;
    const provider = parseOAuthProvider(rawProvider);
    if (!provider) {
      return NextResponse.json(
        { message: "Nhà cung cấp đăng nhập không được hỗ trợ" },
        { status: 400 }
      );
    }

    if (!isOAuthSandboxEnabled(provider)) {
      return NextResponse.json(
        {
          message: "Chế độ OAuth Sandbox đã bị vô hiệu hóa",
        },
        { status: 403 }
      );
    }

    let body: Record<string, unknown>;
    try {
      const raw = await req.json();
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return NextResponse.json(
          { message: "Dữ liệu đăng nhập Google không hợp lệ" },
          { status: 400 }
        );
      }
      body = raw as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { message: "Payload JSON không hợp lệ" },
        { status: 400 }
      );
    }
    const email = String(body.email || "").trim().toLowerCase();
    const fullName = String(body.fullName || "").trim();
    const avatar = body.avatar ? String(body.avatar).trim() : null;
    const providerId = String(body.providerId || `google-${email}`);
    const emailVerified = body.emailVerified === false ? false : true;

    const result = await upsertOAuthUser({
      email,
      fullName,
      avatar,
      provider: "GOOGLE",
      providerId,
      emailVerified,
    });

    if (result.error || !result.user) {
      return NextResponse.json(
        { message: result.error || "Đăng nhập thất bại" },
        { status: result.status || 400 }
      );
    }

    const response = NextResponse.json({
      message: "Đăng nhập bằng Google thành công!",
      user: result.user,
      isNewUser: Boolean(result.isNewUser),
      claimedOrderCount: result.claimedOrderCount ?? 0,
      pointsAwarded: result.pointsAwarded ?? 0,
    });
    return await attachClientSessionCookie(
      response,
      result.user,
      req,
      result.passwordHash
    );
  } catch (error) {
    console.error("POST /api/client/auth/oauth/[provider] error:", error);
    return NextResponse.json(
      { message: "Lỗi xử lý đăng nhập Google" },
      { status: 500 }
    );
  }
}
