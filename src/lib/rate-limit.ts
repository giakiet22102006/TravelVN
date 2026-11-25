import { NextRequest, NextResponse } from "next/server";

interface BucketEntry {
  timestamps: number[];
  expiresAt: number;
}

const MAX_STORE_SIZE = 5000;
const CLEANUP_INTERVAL_MS = 60_000;

const globalStore = globalThis as unknown as {
  __travelvnRateLimitStore?: Map<string, BucketEntry>;
  __travelvnRateLimitLastCleanup?: number;
};

function getStore(): Map<string, BucketEntry> {
  if (!globalStore.__travelvnRateLimitStore) {
    globalStore.__travelvnRateLimitStore = new Map();
  }
  return globalStore.__travelvnRateLimitStore;
}

function cleanupExpired(now: number) {
  const store = getStore();
  const lastCleanup = globalStore.__travelvnRateLimitLastCleanup ?? 0;
  if (now - lastCleanup < CLEANUP_INTERVAL_MS && store.size < MAX_STORE_SIZE) {
    return;
  }
  globalStore.__travelvnRateLimitLastCleanup = now;

  for (const [key, entry] of store.entries()) {
    if (entry.expiresAt <= now) {
      store.delete(key);
    }
  }

  // Bound memory in high-cardinality abuse bursts
  if (store.size > MAX_STORE_SIZE) {
    const excess = store.size - MAX_STORE_SIZE;
    let removed = 0;
    for (const key of store.keys()) {
      store.delete(key);
      removed += 1;
      if (removed >= excess) break;
    }
  }
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSec: number; remaining: number } {
  const now = Date.now();
  cleanupExpired(now);

  const store = getStore();
  const windowStart = now - windowMs;
  const existing = store.get(key);
  const recent = existing
    ? existing.timestamps.filter((ts) => ts > windowStart)
    : [];

  if (recent.length >= limit) {
    const oldest = recent[0] ?? now;
    const retryAfterSec = Math.max(
      1,
      Math.ceil((oldest + windowMs - now) / 1000)
    );
    store.set(key, {
      timestamps: recent,
      expiresAt: oldest + windowMs,
    });
    return { allowed: false, retryAfterSec, remaining: 0 };
  }

  recent.push(now);
  store.set(key, {
    timestamps: recent,
    expiresAt: now + windowMs,
  });

  return {
    allowed: true,
    retryAfterSec: 0,
    remaining: Math.max(0, limit - recent.length),
  };
}

export function rateLimitExceededResponse(
  retryAfterSec: number,
  message = "Bạn thao tác quá nhanh, vui lòng thử lại sau."
) {
  return NextResponse.json(
    { message },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
      },
    }
  );
}
