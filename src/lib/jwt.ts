import { SignJWT, jwtVerify } from "jose";

export const ADMIN_TOKEN_COOKIE = "admin_token";
export const CLIENT_TOKEN_COOKIE = "client_token";
export const RESET_TOKEN_COOKIE = "admin_reset_token";
export const OAUTH_STATE_COOKIE = "oauth_state";

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!secret || secret.trim().length < 32) {
      throw new Error(
        "CRITICAL: JWT_SECRET must be set and at least 32 characters in production"
      );
    }
    return new TextEncoder().encode(secret);
  }
  return new TextEncoder().encode(
    secret || "travelvn-fallback-dev-secret-change-in-prod"
  );
}

/**
 * Computes a short, runtime-agnostic password fingerprint using Web Crypto
 * so JWTs and reset tokens are automatically invalidated when the password changes
 * without adding an extra database column.
 */
export async function computePasswordSig(
  passwordHash: string | null | undefined
): Promise<string> {
  const encoded = new TextEncoder().encode(passwordHash || "no-password");
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < 6; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

export interface AdminJwtPayload {
  sub: string;
  email: string;
  roleId?: string | null;
  pwdSig?: string;
}

export interface ClientJwtPayload {
  sub: string;
  email: string;
  type: "CLIENT_USER";
  pwdSig?: string;
}

export interface ResetTokenPayload {
  email: string;
  pwdSig?: string;
}

export async function signAdminToken(
  payload: AdminJwtPayload,
  expiresIn = "7d"
): Promise<string> {
  return new SignJWT({ ...payload, type: "ADMIN_USER" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecretKey());
}

export async function verifyAdminToken(
  token: string
): Promise<AdminJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    if (
      payload.type !== "ADMIN_USER" ||
      !payload.sub ||
      typeof payload.email !== "string"
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      email: payload.email,
      roleId: typeof payload.roleId === "string" ? payload.roleId : null,
      pwdSig: typeof payload.pwdSig === "string" ? payload.pwdSig : undefined,
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
    .sign(getSecretKey());
}

export async function verifyClientToken(
  token: string
): Promise<ClientJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
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
      pwdSig: typeof payload.pwdSig === "string" ? payload.pwdSig : undefined,
    };
  } catch {
    return null;
  }
}

export async function signResetToken(
  email: string,
  pwdSig?: string
): Promise<string> {
  return new SignJWT({
    email,
    purpose: "password_reset",
    ...(pwdSig ? { pwdSig } : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getSecretKey());
}

export async function verifyResetToken(
  token: string
): Promise<ResetTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    if (
      payload.purpose === "password_reset" &&
      typeof payload.email === "string"
    ) {
      return {
        email: payload.email,
        pwdSig: typeof payload.pwdSig === "string" ? payload.pwdSig : undefined,
      };
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
