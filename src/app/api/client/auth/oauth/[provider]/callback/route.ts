import { NextRequest, NextResponse } from "next/server";
import {
  buildCookieOptions,
  isHttpsRequest,
  OAUTH_STATE_COOKIE,
} from "@/lib/jwt";
import {
  attachClientSessionCookie,
  hasRealOAuthConfig,
  parseOAuthProvider,
  sanitizeRedirectPath,
  upsertOAuthUser,
} from "@/lib/oauth";

async function fetchGoogleProfile(code: string, redirectUri: string) {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: (process.env.GOOGLE_CLIENT_ID || "").trim(),
      client_secret: (process.env.GOOGLE_CLIENT_SECRET || "").trim(),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    throw new Error("Không thể đổi mã xác thực Google");
  }
  const tokenData = (await tokenRes.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    throw new Error("Thiếu Google access token");
  }

  const profileRes = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    }
  );
  if (!profileRes.ok) {
    throw new Error("Không thể lấy hồ sơ người dùng Google");
  }
  const profile = (await profileRes.json()) as {
    sub?: string;
    email?: string;
    name?: string;
    picture?: string;
  };
  return {
    providerId: profile.sub || "",
    email: profile.email || "",
    fullName: profile.name || profile.email?.split("@")[0] || "Khách Google",
    avatar: profile.picture || null,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: rawProvider } = await params;
  const provider = parseOAuthProvider(rawProvider);
  const origin = req.nextUrl.origin;

  if (!provider || !hasRealOAuthConfig(provider)) {
    return NextResponse.redirect(new URL("/login?error=oauth_config", origin));
  }

  const code = req.nextUrl.searchParams.get("code") || "";
  const stateParam = req.nextUrl.searchParams.get("state") || "";
  const rawStateCookie = req.cookies.get(OAUTH_STATE_COOKIE)?.value || "";

  let nextPath = "/account/orders";
  let stateValid = false;
  try {
    const parsed = JSON.parse(rawStateCookie) as {
      provider?: string;
      state?: string;
      next?: string;
    };
    if (
      parsed.provider === provider &&
      parsed.state &&
      parsed.state === stateParam
    ) {
      stateValid = true;
      nextPath = sanitizeRedirectPath(parsed.next);
    }
  } catch {
    stateValid = false;
  }

  if (!code || !stateValid) {
    return NextResponse.redirect(new URL("/login?error=oauth_state", origin));
  }

  try {
    const redirectUri = `${origin}/api/client/auth/oauth/google/callback`;
    const profile = await fetchGoogleProfile(code, redirectUri);

    const upserted = await upsertOAuthUser({
      email: profile.email,
      fullName: profile.fullName,
      avatar: profile.avatar,
      provider: "GOOGLE",
      providerId: profile.providerId,
    });

    if (!upserted.user) {
      return NextResponse.redirect(
        new URL(
          `/login?error=${encodeURIComponent(upserted.error || "oauth_failed")}`,
          origin
        )
      );
    }

    const response = NextResponse.redirect(new URL(nextPath, origin));
    response.cookies.set(
      OAUTH_STATE_COOKIE,
      "",
      buildCookieOptions(0, isHttpsRequest(req))
    );
    return await attachClientSessionCookie(response, upserted.user, req);
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return NextResponse.redirect(new URL("/login?error=oauth_failed", origin));
  }
}
