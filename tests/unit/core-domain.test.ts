import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildOtpStorageKey,
  generateNumericOtp,
  hashOtp,
  packOtpRecord,
  parseOtpRecord,
  verifyOtpConstantTime,
} from "@/lib/otp";
import {
  computePasswordSig,
  signClientResetToken,
  signResetToken,
  verifyClientResetToken,
  verifyResetToken,
} from "@/lib/jwt";
import {
  signWebhookPayload,
  verifyWebhookSignature,
} from "@/lib/payment-webhook";
import {
  calculateCouponDiscount,
  evaluateCouponEligibility,
  findCouponDefinition,
} from "@/lib/knowledge/coupons";
import {
  calculateEarnedPoints,
  calculateMaxRedeemablePoints,
  computeMemberTier,
} from "@/lib/loyalty";
import { checkRateLimit } from "@/lib/rate-limit";

describe("OTP security & Admin/Client namespace isolation", () => {
  it("namespaces client and admin OTP storage keys separately", () => {
    const adminKey = buildOtpStorageKey("admin", "LeVanA@gmail.com ");
    const clientKey = buildOtpStorageKey("client", " levana@gmail.com");
    assert.equal(adminKey, "levana@gmail.com");
    assert.equal(clientKey, "client:levana@gmail.com");
    assert.notEqual(adminKey, clientKey);
  });

  it("generates 6-digit numeric OTPs and verifies constant-time SHA-256 hashes", () => {
    const otp = generateNumericOtp();
    assert.match(otp, /^\d{6}$/);

    const key = buildOtpStorageKey("client", "traveler@example.com");
    const hash = hashOtp(key, otp);
    const packed = packOtpRecord(2, hash);
    const parsed = parseOtpRecord(packed);

    assert.equal(parsed.attempts, 2);
    assert.equal(parsed.hash, hash);
    assert.equal(verifyOtpConstantTime(parsed.hash, hashOtp(key, otp)), true);
    assert.equal(verifyOtpConstantTime(parsed.hash, hashOtp(key, "000000")), false);
    assert.equal(verifyOtpConstantTime("", hash), false);
  });

  it("safely parses malformed OTP records", () => {
    assert.deepEqual(parseOtpRecord("corrupted"), { attempts: 0, hash: "" });
    assert.deepEqual(parseOtpRecord(":abc"), { attempts: 0, hash: "" });
  });
});

describe("JWT password-reset domain separation", () => {
  it("prevents cross-domain reuse between Admin and Client reset tokens", async () => {
    const pwdSig = await computePasswordSig("$2b$10$hashA");
    const adminToken = await signResetToken("user@example.com", pwdSig);
    const clientToken = await signClientResetToken("user@example.com", pwdSig);

    const adminVerified = await verifyResetToken(adminToken);
    assert.equal(adminVerified?.email, "user@example.com");
    assert.equal(adminVerified?.pwdSig, pwdSig);

    const clientVerified = await verifyClientResetToken(clientToken);
    assert.equal(clientVerified?.email, "user@example.com");
    assert.equal(clientVerified?.pwdSig, pwdSig);

    // Cross-domain verification MUST fail
    assert.equal(await verifyClientResetToken(adminToken), null);
    assert.equal(await verifyResetToken(clientToken), null);
  });

  it("changes password fingerprint when password hash changes", async () => {
    const sig1 = await computePasswordSig("$2b$10$oldhash");
    const sig2 = await computePasswordSig("$2b$10$newhash");
    assert.notEqual(sig1, sig2);
    assert.equal(sig1.length, 12);
  });
});

describe("Payment webhook HMAC-SHA256 verification", () => {
  it("accepts valid raw hex and sha256= prefixed signatures", () => {
    const rawBody = JSON.stringify({
      eventId: "evt_unit_1",
      orderCode: "OD123456",
      amount: 4_500_000,
    });
    const sig = signWebhookPayload(rawBody);

    assert.equal(verifyWebhookSignature(rawBody, sig), true);
    assert.equal(verifyWebhookSignature(rawBody, `sha256=${sig}`), true);
  });

  it("rejects tampered payloads and malformed signatures", () => {
    const rawBody = JSON.stringify({
      eventId: "evt_unit_2",
      orderCode: "OD123456",
      amount: 4_500_000,
    });
    const sig = signWebhookPayload(rawBody);
    const tampered = rawBody.replace("4500000", "1000");

    assert.equal(verifyWebhookSignature(tampered, sig), false);
    assert.equal(verifyWebhookSignature(rawBody, "not-valid-hex!"), false);
    assert.equal(verifyWebhookSignature(rawBody, sig.slice(0, -2)), false);
  });
});

describe("Coupon eligibility & discount math", () => {
  it("caps percentage and fixed discounts correctly", () => {
    const pct = calculateCouponDiscount("giam10", 20_000_000);
    assert.equal(pct.valid, true);
    assert.equal(pct.discount, 1_000_000); // capped at maxDiscountVND

    const smallOrder = calculateCouponDiscount("TOUR2026", 250_000);
    assert.equal(smallOrder.valid, true);
    assert.equal(smallOrder.discount, 250_000); // never exceeds subTotal

    const invalid = calculateCouponDiscount("NO_SUCH_CODE", 5_000_000);
    assert.equal(invalid.valid, false);
    assert.equal(invalid.discount, 0);
  });

  it("enforces member-only and tier/paid-order rules", () => {
    const memberCoupon = findCouponDefinition("THANHVIEN200");
    assert.ok(memberCoupon);

    const guestRes = evaluateCouponEligibility(memberCoupon, {
      subTotal: 3_000_000,
      isAuthenticated: false,
    });
    assert.equal(guestRes.eligible, false);
    assert.equal(guestRes.requiresAuth, true);

    const vipCoupon = findCouponDefinition("VIP500");
    assert.ok(vipCoupon);

    const bronzeNoOrders = evaluateCouponEligibility(vipCoupon, {
      subTotal: 9_000_000,
      isAuthenticated: true,
      memberTier: "BRONZE",
      paidOrderCount: 0,
    });
    assert.equal(bronzeNoOrders.eligible, false);

    const bronzeWithPaidBypass = evaluateCouponEligibility(vipCoupon, {
      subTotal: 9_000_000,
      isAuthenticated: true,
      memberTier: "BRONZE",
      paidOrderCount: 1,
    });
    assert.equal(bronzeWithPaidBypass.eligible, true);
  });
});

describe("Loyalty tier & point math", () => {
  it("computes BRONZE, SILVER, and GOLD tiers accurately", () => {
    assert.equal(computeMemberTier(0).tier, "BRONZE");
    assert.equal(computeMemberTier(499).tier, "BRONZE");
    assert.equal(computeMemberTier(500).tier, "SILVER");
    assert.equal(computeMemberTier(1499).tier, "SILVER");
    assert.equal(computeMemberTier(1500).tier, "GOLD");
    assert.equal(computeMemberTier(1500).progressPercent, 100);
  });

  it("enforces 20% post-coupon redeem cap and 1% earn rate with integer math", () => {
    // 5,000,000đ -> 20% = 1,000,000đ = 1,000 points max
    assert.equal(calculateMaxRedeemablePoints(5_000_000, 2_000), 1_000);
    assert.equal(calculateMaxRedeemablePoints(5_000_000, 350), 350);
    assert.equal(calculateMaxRedeemablePoints(-100, 500), 0);

    // 1% earn rate -> 1 point per 100,000đ
    assert.equal(calculateEarnedPoints(4_999_999), 49);
    assert.equal(calculateEarnedPoints(5_000_000), 50);
    assert.equal(calculateEarnedPoints(Number.NaN), 0);
  });
});

describe("Sliding-window rate limiter", () => {
  it("blocks requests exceeding the configured window limit", () => {
    const key = `unit-test-rl-${Date.now()}-${Math.random()}`;
    const r1 = checkRateLimit(key, 2, 10_000);
    const r2 = checkRateLimit(key, 2, 10_000);
    const r3 = checkRateLimit(key, 2, 10_000);

    assert.equal(r1.allowed, true);
    assert.equal(r1.remaining, 1);
    assert.equal(r2.allowed, true);
    assert.equal(r2.remaining, 0);
    assert.equal(r3.allowed, false);
    assert.equal(r3.remaining, 0);
    assert.ok(r3.retryAfterSec >= 1);
  });
});
