import crypto from "crypto";

export const MAX_OTP_ATTEMPTS = 5;
export const OTP_TTL_MS = 5 * 60 * 1000;

export type OtpScope = "admin" | "client";

/**
 * Namespaces Client OTP records separately from Admin OTP records in the shared
 * ForgotPassword table so accounts sharing the same email cannot overwrite or
 * cross-verify each other's recovery codes.
 */
export function buildOtpStorageKey(scope: OtpScope, rawEmail: string): string {
  const email = rawEmail.trim().toLowerCase();
  return scope === "client" ? `client:${email}` : email;
}

export function generateNumericOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export function hashOtp(storageKey: string, otp: string): string {
  return crypto
    .createHash("sha256")
    .update(`${storageKey}:${otp.trim()}`)
    .digest("hex");
}

export function packOtpRecord(attempts: number, hash: string): string {
  return `${Math.max(0, Math.floor(attempts))}:${hash}`;
}

export function parseOtpRecord(raw: string): { attempts: number; hash: string } {
  const colonIdx = raw.indexOf(":");
  if (colonIdx <= 0) {
    return { attempts: 0, hash: "" };
  }
  const attempts = Number.parseInt(raw.slice(0, colonIdx), 10);
  const hash = raw.slice(colonIdx + 1);
  return {
    attempts: Number.isFinite(attempts) && attempts >= 0 ? attempts : 0,
    hash,
  };
}

export function verifyOtpConstantTime(
  storedHash: string,
  expectedHash: string
): boolean {
  if (!storedHash || !expectedHash) return false;
  const bufA = Buffer.from(storedHash, "utf8");
  const bufB = Buffer.from(expectedHash, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
