import { SignJWT, jwtVerify } from "jose";

export const ADMIN_TOKEN_COOKIE = "admin_token";
export const CLIENT_TOKEN_COOKIE = "client_token";
export const RESET_TOKEN_COOKIE = "admin_reset_token";
export const OAUTH_STATE_COOKIE = "oauth_state";

function getJwtSecret(): Uint8Array {
  const secret =
    process.env.JWT_SECRET || "travelvn-fallback-dev-secret-change-in-prod";
  return new TextEncoder().encode(secret);
}

export interface AdminJwtPayload {
  sub: string;
  email: string;
  roleId?: string | null;
}

export interface ClientJwtPayload {
  sub: string;
  email: string;
  type: "CLIENT_USER";
}

export async function signAdminToken(
  payload: AdminJwtPayload,
  expiresIn = "7d"
): Promise<string> {
  return new SignJWT({ ...payload, type: "ADMIN_USER" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getJwtSecret());
}

export async function verifyAdminToken(
  token: string
): Promise<AdminJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (
      payload.type === "CLIENT_USER" ||
      !payload.sub ||
      typeof payload.email !== "string"
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      email: payload.email,
      roleId: typeof payload.roleId === "string" ? payload.roleId : null,
    };
  } catch {
    return null;
  }
}

export async function signClientToken(
  payload: Omit<ClientJwtPayload, "type">,
  expiresIn = "30d"
): Promise<string> {
  return new SignJWT({ ...payload, type: "CLIENT_USER" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getJwtSecret());
}

export async function verifyClientToken(
  token: string
): Promise<ClientJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (
      payload.type !== "CLIENT_USER" ||
      !payload.sub ||
      typeof payload.email !== "string"
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      email: payload.email,
      type: "CLIENT_USER",
    };
  } catch {
    return null;
  }
}

export async function signResetToken(email: string): Promise<string> {
  return new SignJWT({ email, purpose: "password_reset" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getJwtSecret());
}

export async function verifyResetToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (
      payload.purpose === "password_reset" &&
      typeof payload.email === "string"
    ) {
      return payload.email;
    }
    return null;
  } catch {
    return null;
  }
}

export function isHttpsRequest(req: {
  headers: Headers;
  nextUrl?: { protocol: string };
}): boolean {
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedProto) {
    return forwardedProto.split(",")[0].trim() === "https";
  }
  return req.nextUrl?.protocol === "https:";
}

/**
 * Auth tokens are stored in HttpOnly + SameSite=Lax cookies instead of localStorage:
 * browser JS cannot read HttpOnly cookies, blocking XSS token exfiltration while
 * SameSite=Lax mitigates cross-site form/AJAX CSRF.
 */
export function buildCookieOptions(maxAgeSeconds: number, secure = false) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
