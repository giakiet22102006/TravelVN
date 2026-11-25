import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { makeOrderPayload } from "../lib/fixtures.mjs";
import {
  adminUpdateOrder,
  createAdminSession,
  createGuestOrder,
  payOrderViaWebhook,
  registerFreshMember,
  triggerExpireOrdersCron,
} from "../lib/helpers.mjs";
import {
  createSession,
  freshIp,
  signClaimToken,
  signWebhookBody,
  uniqueEmail,
  uniquePhone,
  uniqueTag,
} from "../lib/http.mjs";

export const tier2Cases = [
  // =========================================================================
  // F1: Schema & DB Boundaries (5 cases)
  // =========================================================================
  {
    id: "T2-F1-01",
    feature: "F1",
    name: "WELCOME_BONUS never duplicates even when orderId is NULL across repeated auth/claim",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      const { session, user, email, password } = await registerFreshMember({
        baseUrl,
        tracker,
      });
      const { claimToken } = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.midTier,
        email,
      });

      const loginRes = await session.login({ email, password, claimToken });
      assert.equal(loginRes.status, 200);

      const bonuses = await prisma.loyaltyTransaction.findMany({
        where: { userId: user.id, type: "WELCOME_BONUS" },
      });
      assert.equal(bonuses.length, 1);
      assert.equal(bonuses[0].orderId, null);
    },
  },
  {
    id: "T2-F1-02",
    feature: "F1",
    name: "LoyaltyTransaction preserves audit row (orderId -> NULL) on Order hard delete",
    async run({ prisma, tracker, assert }) {
      const user = await prisma.user.create({
        data: {
          fullName: "E2E SetNull User",
          email: uniqueEmail("setnull"),
        },
      });
      tracker.trackUser(user.id);

      const order = await prisma.order.create({
        data: {
          code: `E2EOD-${uniqueTag("sn").slice(-10).toUpperCase()}`,
          userId: user.id,
          fullName: "E2E Order",
          phone: "0912345678",
          subTotal: 2_000_000,
          total: 2_000_000,
        },
      });
      tracker.trackOrder(order);

      const tx = await prisma.loyaltyTransaction.create({
        data: {
          userId: user.id,
          orderId: order.id,
          type: "ORDER_EARN",
          points: 20,
          description: "Audit row",
        },
      });

      await prisma.order.delete({ where: { id: order.id } });
      const preserved = await prisma.loyaltyTransaction.findUnique({
        where: { id: tx.id },
      });
      assert.ok(preserved !== null);
      assert.equal(preserved.orderId, null);
      assert.equal(preserved.points, 20);
    },
  },
  {
    id: "T2-F1-03",
    feature: "F1",
    name: "User loyaltyPoints and lifetimePoints never drop below 0 on refund revoke",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      const { session, user, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });
      const o1Res = await session.createOrder(
        makeOrderPayload({
          fixture: fixtures.tenMTier,
          email,
          phone,
          paymentMethod: "BANK_TRANSFER",
        }),
        tracker
      );
      assert.equal(o1Res.status, 201);
      const o1 = o1Res.json.order;
      await payOrderViaWebhook({ baseUrl, tracker, order: o1 });

      // Spend entire balance (100 welcome + 100 earn = 200)
      const o2Res = await session.createOrder(
        makeOrderPayload({
          fixture: fixtures.tenMTier,
          email,
          phone,
          redeemPoints: 200,
        }),
        tracker
      );
      assert.equal(o2Res.status, 201);

      const adminSession = await createAdminSession(baseUrl);
      const refRes = await adminUpdateOrder(adminSession, o1, {
        paymentMethod: "BANK_TRANSFER",
        paymentStatus: "PAID",
        status: "CANCELLED",
        refundStatus: "REFUNDED",
      });
      assert.equal(refRes.status, 200);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      assert.ok(dbUser.loyaltyPoints >= 0);
      assert.ok(dbUser.lifetimePoints >= 0);
      assert.equal(dbUser.loyaltyPoints, 0);
    },
  },
  {
    id: "T2-F1-04",
    feature: "F1",
    name: "Register normalizes email case and rejects duplicate MixedCase vs lowercase (409)",
    async run({ baseUrl, tracker, assert }) {
      const tag = uniqueTag("case");
      const mixed = `Test.User.${tag}@Test.TravelVN.local`;
      await registerFreshMember({
        baseUrl,
        tracker,
        email: mixed,
      });

      const s2 = createSession({ baseUrl, ip: freshIp() });
      const dupRes = await s2.register(
        {
          fullName: "Duplicate User",
          email: mixed.toLowerCase(),
          password: "Password@123",
        },
        tracker
      );
      assert.equal(dupRes.status, 409);
    },
  },
  {
    id: "T2-F1-05",
    feature: "F1",
    name: "SavedTraveler allows null documentNumber and null relationship",
    async run({ baseUrl, tracker, assert }) {
      const { session } = await registerFreshMember({ baseUrl, tracker });
      const res = await session.post("/api/client/account/travelers", {
        fullName: "Trẻ Em Không Giấy Tờ",
        gender: "OTHER",
        birthDate: "2023-01-15",
        defaultTier: "BABY",
        documentNumber: null,
        relationship: null,
      });
      assert.equal(res.status, 201);
      assert.equal(res.json?.traveler?.documentNumber, null);
      assert.equal(res.json?.traveler?.relationship, null);
    },
  },

  // =========================================================================
  // F2: Domain Math & Token Boundaries (5 cases)
  // =========================================================================
  {
    id: "T2-F2-01",
    feature: "F2",
    name: "Tier thresholds at exact boundaries 499, 500, 1499, 1500",
    async run({ baseUrl, prisma, tracker, assert }) {
      const { session, user } = await registerFreshMember({
        baseUrl,
        tracker,
      });
      const checks = [
        { pts: 499, tier: "BRONZE", pct: 99, next: "SILVER", toNext: 1 },
        { pts: 500, tier: "SILVER", pct: 0, next: "GOLD", toNext: 1000 },
        { pts: 1499, tier: "SILVER", pct: 99, next: "GOLD", toNext: 1 },
        { pts: 1500, tier: "GOLD", pct: 100, next: null, toNext: 0 },
      ];
      for (const c of checks) {
        await prisma.user.update({
          where: { id: user.id },
          data: { lifetimePoints: c.pts, loyaltyPoints: c.pts },
        });
        const res = await session.get("/api/client/account/loyalty");
        assert.equal(res.status, 200);
        assert.equal(res.json.tierInfo.tier, c.tier);
        assert.equal(res.json.tierInfo.progressPercent, c.pct);
        assert.equal(res.json.tierInfo.nextTier, c.next);
        assert.equal(res.json.tierInfo.pointsToNext, c.toNext);
      }
    },
  },
  {
    id: "T2-F2-02",
    feature: "F2",
    name: "Non-divisible subtotal 2,004,999d enforces integer 20% cap (400 ok, 401 rejected)",
    async run({ baseUrl, prisma, tracker, assert }) {
      const tour = await tracker.createEphemeralTour({
        priceNewAdult: 2_004_999,
      });
      const { session, user, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { loyaltyPoints: 500, lifetimePoints: 500 },
      });

      const over = await session.createOrder(
        makeOrderPayload({
          fixture: tour,
          email,
          phone,
          redeemPoints: 401,
        }),
        tracker
      );
      assert.equal(over.status, 400);

      const ok = await session.createOrder(
        makeOrderPayload({
          fixture: tour,
          email,
          phone,
          redeemPoints: 400,
        }),
        tracker
      );
      assert.equal(ok.status, 201);
      assert.equal(ok.json.order.pointsRedeemed, 400);
      assert.equal(ok.json.order.pointsDiscount, 400_000);
    },
  },
  {
    id: "T2-F2-03",
    feature: "F2",
    name: "1% earn threshold boundary: 99,999d earns 0 pts, 100,000d earns 1 pt",
    async run({ baseUrl, tracker, assert }) {
      const t99 = await tracker.createEphemeralTour({ priceNewAdult: 99_999 });
      const t100 = await tracker.createEphemeralTour({ priceNewAdult: 100_000 });
      const { session, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });

      const r1 = await session.createOrder(
        makeOrderPayload({
          fixture: t99,
          email,
          phone,
          paymentMethod: "BANK_TRANSFER",
        }),
        tracker
      );
      const r2 = await session.createOrder(
        makeOrderPayload({
          fixture: t100,
          email,
          phone,
          paymentMethod: "BANK_TRANSFER",
        }),
        tracker
      );
      assert.equal(r1.status, 201);
      assert.equal(r2.status, 201);

      await payOrderViaWebhook({ baseUrl, tracker, order: r1.json.order });
      await payOrderViaWebhook({ baseUrl, tracker, order: r2.json.order });

      const loyalty = await session.get("/api/client/account/loyalty");
      assert.equal(loyalty.status, 200);
      assert.equal(loyalty.json.loyaltyPoints, 101);
    },
  },
  {
    id: "T2-F2-04",
    feature: "F2",
    name: "Malformed, wrong-secret, or 1-part/3-part claimTokens rejected with 400",
    async run({ baseUrl, tracker, fixtures, assert }) {
      const { session } = await registerFreshMember({ baseUrl, tracker });
      const { order } = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.midTier,
      });

      const wrongSecretToken = signClaimToken(
        {
          orderId: order.id,
          orderCode: order.code,
          email: order.email,
          phone: order.phone,
        },
        { secret: "completely-wrong-secret-key" }
      );

      for (const bad of ["", "not-two-parts", "a.b.c", wrongSecretToken]) {
        const res = await session.post("/api/client/orders/claim", {
          mode: "link",
          claimToken: bad,
        });
        assert.equal(res.status, 400);
      }
    },
  },
  {
    id: "T2-F2-05",
    feature: "F2",
    name: "Phone normalization handles +840, 84, and dotted/spaced formats on manual claim",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      const variants = ["+840912345678", "84912345678", "0912.345-678 "];
      for (const inputPhone of variants) {
        const { session, user } = await registerFreshMember({
          baseUrl,
          tracker,
        });
        const { order } = await createGuestOrder({
          baseUrl,
          tracker,
          fixture: fixtures.midTier,
          phone: "0912345678",
        });
        const res = await session.post("/api/client/orders/claim", {
          mode: "link",
          orderCode: order.code,
          phone: inputPhone,
        });
        assert.equal(
          res.status,
          200,
          `Phone format "${inputPhone}" should succeed`
        );
        const dbOrder = await prisma.order.findUnique({
          where: { id: order.id },
        });
        assert.equal(dbOrder?.userId, user.id);
      }
    },
  },

  // =========================================================================
  // F3: Auth & OAuth Boundaries (5 cases)
  // =========================================================================
  {
    id: "T2-F3-01",
    feature: "F3",
    name: "Register password boundary: 5 chars rejected (400), 6 chars succeeds (201)",
    async run({ baseUrl, tracker, assert }) {
      const s1 = createSession({ baseUrl, ip: freshIp() });
      const shortRes = await s1.register(
        {
          fullName: "Short Pass",
          email: uniqueEmail("p5"),
          password: "12345",
        },
        tracker
      );
      assert.equal(shortRes.status, 400);

      const s2 = createSession({ baseUrl, ip: freshIp() });
      const okRes = await s2.register(
        {
          fullName: "Valid Pass",
          email: uniqueEmail("p6"),
          password: "123456",
        },
        tracker
      );
      assert.equal(okRes.status, 201);
    },
  },
  {
    id: "T2-F3-02",
    feature: "F3",
    name: "Register rate limit 5 / 10m per IP returns 429 with Retry-After on 6th attempt",
    async run({ baseUrl, tracker, assert }) {
      const fixedIp = freshIp();
      const s = createSession({ baseUrl, ip: fixedIp });
      for (let i = 0; i < 5; i++) {
        // Invalid password triggers 400 AFTER rate-limit check so no DB rows created, or valid register
        const r = await s.register(
          {
            fullName: `RL User ${i}`,
            email: uniqueEmail(`rlreg-${i}`),
            password: "Password@123",
          },
          tracker
        );
        assert.equal(r.status, 201);
      }
      const blocked = await s.register(
        {
          fullName: "RL Blocked",
          email: uniqueEmail("rlreg-6"),
          password: "Password@123",
        },
        tracker
      );
      assert.equal(blocked.status, 429);
      assert.ok(Number(blocked.headers.get("retry-after")) >= 1);
    },
  },
  {
    id: "T2-F3-03",
    feature: "F3",
    name: "Google OAuth POST sandbox enforces 403 when disabled or 400 on invalid payload when enabled",
    async run({ baseUrl, assert }) {
      const s = createSession({ baseUrl, ip: freshIp() });
      const check = await s.get("/api/client/auth/oauth/google?check=1");
      if (check.status === 403) {
        const postRes = await s.post("/api/client/auth/oauth/google", {
          email: uniqueEmail("oauth-off"),
          fullName: "Blocked User",
        });
        assert.equal(postRes.status, 403);
      } else {
        assert.equal(check.status, 200);
        const badRes = await s.post("/api/client/auth/oauth/google", {
          email: "",
          fullName: "",
        });
        assert.equal(badRes.status, 400);
      }

      const badProvider = await s.get("/api/client/auth/oauth/facebook?check=1");
      assert.equal(badProvider.status, 400);
    },
  },
  {
    id: "T2-F3-04",
    feature: "F3",
    name: "Locked (INACTIVE) and soft-deleted users are rejected on login with no cookie",
    async run({ baseUrl, prisma, tracker, assert }) {
      const { user, email, password } = await registerFreshMember({
        baseUrl,
        tracker,
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { status: "INACTIVE" },
      });

      const s1 = createSession({ baseUrl, ip: freshIp() });
      const lockedRes = await s1.login({ email, password });
      assert.equal(lockedRes.status, 403);
      assert.equal(s1.jar.get("client_token"), null);

      await prisma.user.update({
        where: { id: user.id },
        data: { status: "ACTIVE", deleted: true },
      });

      const s2 = createSession({ baseUrl, ip: freshIp() });
      const deletedRes = await s2.login({ email, password });
      assert.inSet(deletedRes.status, [401, 403]);
      assert.equal(s2.jar.get("client_token"), null);
    },
  },
  {
    id: "T2-F3-05",
    feature: "F3",
    name: "Repeated logins or OAuth signins never grant duplicate WELCOME_BONUS",
    async run({ baseUrl, prisma, tracker, assert }) {
      const s = createSession({ baseUrl, ip: freshIp() });
      const check = await s.get("/api/client/auth/oauth/google?check=1");

      if (check.status === 200 && check.json?.mode === "sandbox") {
        const email = uniqueEmail("oauth-repeat");
        const providerId = `google-${uniqueTag("rep")}`;
        const r1 = await s.post("/api/client/auth/oauth/google", {
          email,
          fullName: "Repeat Google",
          providerId,
        });
        assert.equal(r1.status, 200);
        tracker.trackUser(r1.json.user.id);

        const r2 = await s.post("/api/client/auth/oauth/google", {
          email,
          fullName: "Repeat Google",
          providerId,
        });
        assert.equal(r2.status, 200);
        assert.equal(r2.json.user.loyaltyPoints, 100);

        const count = await prisma.loyaltyTransaction.count({
          where: { userId: r1.json.user.id, type: "WELCOME_BONUS" },
        });
        assert.equal(count, 1);
      } else {
        const { user, email, password } = await registerFreshMember({
          baseUrl,
          tracker,
        });
        const s2 = createSession({ baseUrl, ip: freshIp() });
        const loginRes = await s2.login({ email, password });
        assert.equal(loginRes.status, 200);
        assert.equal(loginRes.json.user.loyaltyPoints, 100);
      }
    },
  },

  // =========================================================================
  // F4: Order Claim Security & Rate-Limit Boundaries (5 cases)
  // =========================================================================
  {
    id: "T2-F4-01",
    feature: "F4",
    name: "quick-register rejects already-registered email with 409 and does not hijack",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      const { user: existingUser, email } = await registerFreshMember({
        baseUrl,
        tracker,
      });
      const { order, claimToken } = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.midTier,
        email,
      });

      const attacker = createSession({ baseUrl, ip: freshIp() });
      const res = await attacker.post("/api/client/orders/claim", {
        mode: "quick-register",
        claimToken,
        password: "AttackerPassword123",
      });
      assert.equal(res.status, 409);
      assert.equal(attacker.jar.get("client_token"), null);

      const dbOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      assert.equal(dbOrder?.userId, null);
      assert.ok(existingUser.id);
    },
  },
  {
    id: "T2-F4-02",
    feature: "F4",
    name: "Expired claimToken (exp <= now) returns 400 on quick-register and link",
    async run({ baseUrl, tracker, fixtures, assert }) {
      const { session } = await registerFreshMember({ baseUrl, tracker });
      const { order } = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.midTier,
      });

      const expiredToken = signClaimToken(
        {
          orderId: order.id,
          orderCode: order.code,
          email: order.email,
          phone: order.phone,
        },
        { exp: Date.now() - 10_000 }
      );

      const qrRes = await createSession({ baseUrl, ip: freshIp() }).post(
        "/api/client/orders/claim",
        {
          mode: "quick-register",
          claimToken: expiredToken,
          password: "Password@123",
        }
      );
      assert.equal(qrRes.status, 400);

      const linkRes = await session.post("/api/client/orders/claim", {
        mode: "link",
        claimToken: expiredToken,
      });
      assert.equal(linkRes.status, 400);
    },
  },
  {
    id: "T2-F4-03",
    feature: "F4",
    name: "Tampered claimToken signature (1 char flipped) rejected with 400",
    async run({ baseUrl, tracker, fixtures, assert }) {
      const { order, claimToken } = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.midTier,
      });
      const last = claimToken.slice(-1);
      const flipped =
        claimToken.slice(0, -1) + (last === "A" ? "B" : "A");

      const res = await createSession({ baseUrl, ip: freshIp() }).post(
        "/api/client/orders/claim",
        {
          mode: "quick-register",
          claimToken: flipped,
          password: "Password@123",
        }
      );
      assert.equal(res.status, 400);
      assert.ok(order.id);
    },
  },
  {
    id: "T2-F4-04",
    feature: "F4",
    name: "Already-claimed order returns 403 for wrong phone before 409 for right phone",
    async run({ baseUrl, tracker, fixtures, assert }) {
      const owner = await registerFreshMember({ baseUrl, tracker });
      const probe = await registerFreshMember({ baseUrl, tracker });
      const { order, phone } = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.midTier,
      });

      const claim1 = await owner.session.post("/api/client/orders/claim", {
        mode: "link",
        orderCode: order.code,
        phone,
      });
      assert.equal(claim1.status, 200);

      const wrongPhone = await probe.session.post("/api/client/orders/claim", {
        mode: "link",
        orderCode: order.code,
        phone: "0988888888",
      });
      assert.equal(wrongPhone.status, 403);

      const rightPhone = await probe.session.post("/api/client/orders/claim", {
        mode: "link",
        orderCode: order.code,
        phone,
      });
      assert.equal(rightPhone.status, 409);
    },
  },
  {
    id: "T2-F4-05",
    feature: "F4",
    name: "Manual claim rate limit 5 / 10m returns 429 on 6th attempt even with valid phone",
    async run({ baseUrl, tracker, fixtures, assert }) {
      const { session } = await registerFreshMember({ baseUrl, tracker });
      const { order, phone } = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.midTier,
      });

      for (let i = 0; i < 5; i++) {
        const res = await session.post("/api/client/orders/claim", {
          mode: "link",
          orderCode: order.code,
          phone: "0999999999",
        });
        assert.equal(res.status, 403);
      }

      const sixth = await session.post("/api/client/orders/claim", {
        mode: "link",
        orderCode: order.code,
        phone,
      });
      assert.equal(sixth.status, 429);
      assert.ok(Number(sixth.headers.get("retry-after")) >= 1);
    },
  },

  // =========================================================================
  // F5: Order Creation Coupons & Points Boundaries (5 cases)
  // =========================================================================
  {
    id: "T2-F5-01",
    feature: "F5",
    name: "THANHVIEN200 minOrderVND boundary: < 2M rejected (400), >= 2M succeeds (201)",
    async run({ baseUrl, tracker, fixtures, assert }) {
      const lowTour = await tracker.createEphemeralTour({
        priceNewAdult: 1_500_000,
      });
      const { session, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });

      const failRes = await session.createOrder(
        makeOrderPayload({
          fixture: lowTour,
          email,
          phone,
          couponCode: "THANHVIEN200",
        }),
        tracker
      );
      assert.equal(failRes.status, 400);

      const okRes = await session.createOrder(
        makeOrderPayload({
          fixture: fixtures.midTier,
          email,
          phone,
          couponCode: "THANHVIEN200",
        }),
        tracker
      );
      assert.equal(okRes.status, 201);
      assert.equal(okRes.json.order.discount, 200_000);
    },
  },
  {
    id: "T2-F5-02",
    feature: "F5",
    name: "VIP500 requires SILVER or >= 1 paid order and >= 8M subtotal",
    async run({ baseUrl, tracker, fixtures, assert }) {
      const { session, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });
      const qty8M = fixtures.vipTier.unitAdult >= 8_000_000 ? 1 : 2;

      // BRONZE with 0 paid orders cannot use VIP500
      const fail0 = await session.createOrder(
        makeOrderPayload({
          fixture: fixtures.vipTier,
          quantityAdult: qty8M,
          email,
          phone,
          couponCode: "VIP500",
        }),
        tracker
      );
      assert.inSet(fail0.status, [400, 403]);

      // Pay 1 small order -> allowPaidOrderBypass unlocks VIP500 even while still BRONZE
      const paidOrderRes = await session.createOrder(
        makeOrderPayload({
          fixture: fixtures.midTier,
          email,
          phone,
          paymentMethod: "BANK_TRANSFER",
        }),
        tracker
      );
      assert.equal(paidOrderRes.status, 201);
      await payOrderViaWebhook({
        baseUrl,
        tracker,
        order: paidOrderRes.json.order,
      });

      // SubTotal < 8M still fails VIP500
      const under8M = await session.createOrder(
        makeOrderPayload({
          fixture: fixtures.midTier,
          email,
          phone,
          couponCode: "VIP500",
        }),
        tracker
      );
      assert.equal(under8M.status, 400);

      // SubTotal >= 8M succeeds
      const ok = await session.createOrder(
        makeOrderPayload({
          fixture: fixtures.vipTier,
          quantityAdult: qty8M,
          email,
          phone,
          couponCode: "VIP500",
        }),
        tracker
      );
      assert.equal(ok.status, 201);
      assert.equal(ok.json.order.discount, 500_000);
    },
  },
  {
    id: "T2-F5-03",
    feature: "F5",
    name: "Guest cannot apply THANHVIEN200 via direct POST /api/client/orders",
    async run({ baseUrl, tracker, fixtures, assert }) {
      const guest = createSession({ baseUrl, ip: freshIp() });
      const res = await guest.createOrder(
        makeOrderPayload({
          fixture: fixtures.midTier,
          couponCode: "THANHVIEN200",
        }),
        tracker
      );
      assert.inSet(res.status, [400, 401, 403]);
    },
  },
  {
    id: "T2-F5-04",
    feature: "F5",
    name: "redeemPoints > 20% cap (400) and > user balance (409/400) leave balance untouched",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      const { session, user, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });
      // User has 100 pts. Requesting 150 pts (> balance)
      const overBalance = await session.createOrder(
        makeOrderPayload({
          fixture: fixtures.tenMTier,
          email,
          phone,
          redeemPoints: 150,
        }),
        tracker
      );
      assert.inSet(overBalance.status, [400, 409]);

      // Give 500 pts on 2M tour -> max 20% = 400 pts; requesting 401 pts
      const tour2M = await tracker.createEphemeralTour({
        priceNewAdult: 2_000_000,
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { loyaltyPoints: 500 },
      });
      const overCap = await session.createOrder(
        makeOrderPayload({
          fixture: tour2M,
          email,
          phone,
          redeemPoints: 401,
        }),
        tracker
      );
      assert.equal(overCap.status, 400);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      assert.equal(dbUser?.loyaltyPoints, 500);
    },
  },
  {
    id: "T2-F5-05",
    feature: "F5",
    name: "Invalid redeemPoints (negative, float, overflow, unauth) never yield negative discount",
    async run({ baseUrl, tracker, fixtures, assert }) {
      const guest = createSession({ baseUrl, ip: freshIp() });
      const guestRedeem = await guest.createOrder(
        makeOrderPayload({
          fixture: fixtures.tenMTier,
          redeemPoints: 10,
        }),
        tracker
      );
      assert.inSet(guestRedeem.status, [400, 401]);

      const { session, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });
      for (const badPts of [-5, 10.5, 3_000_000_000]) {
        const res = await session.createOrder(
          makeOrderPayload({
            fixture: fixtures.tenMTier,
            email,
            phone,
            redeemPoints: badPts,
          }),
          tracker
        );
        assert.inSet(res.status, [400, 409]);
      }

      const zeroRes = await session.createOrder(
        makeOrderPayload({
          fixture: fixtures.tenMTier,
          email,
          phone,
          redeemPoints: 0,
        }),
        tracker
      );
      assert.equal(zeroRes.status, 201);
      assert.equal(zeroRes.json.order.pointsRedeemed, 0);
      assert.equal(zeroRes.json.order.pointsDiscount, 0);
    },
  },

  // =========================================================================
  // F6: Webhook, Cron & Cancel Boundaries (5 cases)
  // =========================================================================
  {
    id: "T2-F6-01",
    feature: "F6",
    name: "Webhook invalid signature / tampered body returns 401 and logs INVALID_SIGNATURE",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      const { session, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });
      const orderRes = await session.createOrder(
        makeOrderPayload({
          fixture: fixtures.midTier,
          email,
          phone,
          paymentMethod: "BANK_TRANSFER",
        }),
        tracker
      );
      assert.equal(orderRes.status, 201);
      const order = orderRes.json.order;

      const eventId = uniqueTag("badsig");
      tracker.trackEventId(eventId);
      const signedBody = JSON.stringify({
        eventId,
        orderCode: order.code,
        amount: order.total,
      });
      const sig = signWebhookBody(signedBody);
      const tamperedBody = JSON.stringify({
        eventId,
        orderCode: order.code,
        amount: order.total + 1,
      });

      const whRes = await session.postRaw("/api/webhooks/payment", tamperedBody, {
        headers: { "x-webhook-signature": sig },
      });
      assert.equal(whRes.status, 401);

      const log = await prisma.paymentWebhookLog.findUnique({
        where: { eventId },
      });
      assert.equal(log?.signatureValid, false);
      assert.equal(log?.outcome, "INVALID_SIGNATURE");

      const dbOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      assert.equal(dbOrder?.paymentStatus, "UNPAID");
      assert.equal(dbOrder?.pointsEarned, 0);
    },
  },
  {
    id: "T2-F6-02",
    feature: "F6",
    name: "Webhook INSUFFICIENT_AMOUNT (total - 1) returns 400 and awards 0 points",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      const { session, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });
      const orderRes = await session.createOrder(
        makeOrderPayload({
          fixture: fixtures.midTier,
          email,
          phone,
          paymentMethod: "BANK_TRANSFER",
        }),
        tracker
      );
      assert.equal(orderRes.status, 201);
      const order = orderRes.json.order;

      const { res: whRes } = await payOrderViaWebhook({
        baseUrl,
        tracker,
        order,
        amount: order.total - 1,
      });
      assert.equal(whRes.status, 400);
      assert.equal(whRes.json?.outcome, "INSUFFICIENT_AMOUNT");

      const dbOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      assert.equal(dbOrder?.paymentStatus, "UNPAID");
      assert.equal(dbOrder?.pointsEarned, 0);
    },
  },
  {
    id: "T2-F6-03",
    feature: "F6",
    name: "CASH order has expiresAt=null and is immune to /api/cron/expire-orders",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      const { session, user, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });
      const orderRes = await session.createOrder(
        makeOrderPayload({
          fixture: fixtures.tenMTier,
          email,
          phone,
          paymentMethod: "CASH",
          redeemPoints: 50,
        }),
        tracker
      );
      assert.equal(orderRes.status, 201);
      const order = orderRes.json.order;
      assert.equal(order.expiresAt, null);

      const cronRes = await triggerExpireOrdersCron(baseUrl);
      assert.equal(cronRes.status, 200);

      const dbOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      assert.equal(dbOrder?.status, "INITIAL");
      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      assert.equal(dbUser?.loyaltyPoints, 50);
    },
  },
  {
    id: "T2-F6-04",
    feature: "F6",
    name: "Customer cannot cancel an already-APPROVED order (400)",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      const { session, user, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });
      const orderRes = await session.createOrder(
        makeOrderPayload({
          fixture: fixtures.tenMTier,
          email,
          phone,
          paymentMethod: "BANK_TRANSFER",
          redeemPoints: 50,
        }),
        tracker
      );
      assert.equal(orderRes.status, 201);
      const order = orderRes.json.order;
      await payOrderViaWebhook({ baseUrl, tracker, order });

      const cancelRes = await session.patch(
        `/api/client/account/orders/${order.id}/cancel`
      );
      assert.equal(cancelRes.status, 400);

      const dbOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      assert.equal(dbOrder?.status, "APPROVED");
      const refundTxs = await prisma.loyaltyTransaction.count({
        where: {
          userId: user.id,
          orderId: order.id,
          type: "ORDER_REDEEM_REFUND",
        },
      });
      assert.equal(refundTxs, 0);
    },
  },
  {
    id: "T2-F6-05",
    feature: "F6",
    name: "Cancelling order with 0 pointsRedeemed creates zero ORDER_REDEEM_REFUND rows",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      const { session, user, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });
      const orderRes = await session.createOrder(
        makeOrderPayload({
          fixture: fixtures.midTier,
          email,
          phone,
          redeemPoints: 0,
        }),
        tracker
      );
      assert.equal(orderRes.status, 201);

      const cancelRes = await session.patch(
        `/api/client/account/orders/${orderRes.json.order.id}/cancel`
      );
      assert.equal(cancelRes.status, 200);

      const count = await prisma.loyaltyTransaction.count({
        where: {
          userId: user.id,
          orderId: orderRes.json.order.id,
          type: "ORDER_REDEEM_REFUND",
        },
      });
      assert.equal(count, 0);
    },
  },

  // =========================================================================
  // F7: Saved Travelers Boundaries (5 cases)
  // =========================================================================
  {
    id: "T2-F7-01",
    feature: "F7",
    name: "Max 20 Saved Travelers enforced: 20th returns 201, 21st rejected (400/409)",
    async run({ baseUrl, prisma, tracker, assert }) {
      const { session, user } = await registerFreshMember({ baseUrl, tracker });
      // Seed 19 directly in DB for speed, then test 20th and 21st via HTTP API
      await prisma.savedTraveler.createMany({
        data: Array.from({ length: 19 }, (_, idx) => ({
          userId: user.id,
          fullName: `Hành Khách ${idx + 1}`,
          gender: "MALE",
          birthDate: "1990-01-01",
          defaultTier: "ADULT",
        })),
      });

      const r20 = await session.post("/api/client/account/travelers", {
        fullName: "Hành Khách 20",
        gender: "FEMALE",
        birthDate: "1992-02-02",
        defaultTier: "ADULT",
      });
      assert.equal(r20.status, 201);

      const r21 = await session.post("/api/client/account/travelers", {
        fullName: "Hành Khách 21",
        gender: "FEMALE",
        birthDate: "1993-03-03",
        defaultTier: "ADULT",
      });
      assert.inSet(r21.status, [400, 409]);

      const count = await prisma.savedTraveler.count({
        where: { userId: user.id },
      });
      assert.equal(count, 20);
    },
  },
  {
    id: "T2-F7-02",
    feature: "F7",
    name: "Unauthenticated GET/POST/PUT/DELETE /api/client/account/travelers return 401",
    async run({ baseUrl, assert }) {
      const guest = createSession({ baseUrl, ip: freshIp() });
      const g = await guest.get("/api/client/account/travelers");
      const p = await guest.post("/api/client/account/travelers", {
        fullName: "Test",
        gender: "MALE",
        birthDate: "1990-01-01",
        defaultTier: "ADULT",
      });
      const u = await guest.put("/api/client/account/travelers/fake-id", {
        fullName: "Test",
        gender: "MALE",
        birthDate: "1990-01-01",
        defaultTier: "ADULT",
      });
      const d = await guest.del("/api/client/account/travelers/fake-id");
      assert.equal(g.status, 401);
      assert.equal(p.status, 401);
      assert.equal(u.status, 401);
      assert.equal(d.status, 401);
    },
  },
  {
    id: "T2-F7-03",
    feature: "F7",
    name: "Cross-user IDOR on /api/client/account/travelers/[id] rejected (403/404)",
    async run({ baseUrl, prisma, tracker, assert }) {
      const userA = await registerFreshMember({ baseUrl, tracker });
      const userB = await registerFreshMember({ baseUrl, tracker });

      const created = await userA.session.post("/api/client/account/travelers", {
        fullName: "User A Traveler",
        gender: "MALE",
        birthDate: "1991-01-01",
        defaultTier: "ADULT",
      });
      assert.equal(created.status, 201);
      const tid = created.json.traveler.id;

      const putRes = await userB.session.put(
        `/api/client/account/travelers/${tid}`,
        {
          fullName: "Hacked Name",
          gender: "MALE",
          birthDate: "1991-01-01",
          defaultTier: "ADULT",
        }
      );
      const delRes = await userB.session.del(
        `/api/client/account/travelers/${tid}`
      );
      assert.inSet(putRes.status, [403, 404]);
      assert.inSet(delRes.status, [403, 404]);

      const dbRow = await prisma.savedTraveler.findUnique({
        where: { id: tid },
      });
      assert.equal(dbRow?.fullName, "User A Traveler");
    },
  },
  {
    id: "T2-F7-04",
    feature: "F7",
    name: "Invalid SavedTraveler payloads rejected with 400",
    async run({ baseUrl, tracker, assert }) {
      const { session } = await registerFreshMember({ baseUrl, tracker });
      const badPayloads = [
        {
          fullName: "A",
          gender: "MALE",
          birthDate: "1990-01-01",
          defaultTier: "ADULT",
        },
        {
          fullName: "Valid Name",
          gender: "UNKNOWN",
          birthDate: "1990-01-01",
          defaultTier: "ADULT",
        },
        {
          fullName: "Valid Name",
          gender: "MALE",
          birthDate: "1990-01-01",
          defaultTier: "VIP",
        },
        {
          fullName: "Valid Name",
          gender: "MALE",
          birthDate: "",
          defaultTier: "ADULT",
        },
      ];
      for (const body of badPayloads) {
        const res = await session.post("/api/client/account/travelers", body);
        assert.equal(res.status, 400);
      }
    },
  },
  {
    id: "T2-F7-05",
    feature: "F7",
    name: "saveTravelers=true at checkout respects 20-traveler cap without failing order",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      const { session, user, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });
      await prisma.savedTraveler.createMany({
        data: Array.from({ length: 20 }, (_, idx) => ({
          userId: user.id,
          fullName: `Cap Traveler ${idx + 1}`,
          gender: "MALE",
          birthDate: "1990-01-01",
          defaultTier: "ADULT",
        })),
      });

      const res = await session.createOrder(
        makeOrderPayload({
          fixture: fixtures.midTier,
          quantityAdult: 2,
          email,
          phone,
          saveTravelers: true,
        }),
        tracker
      );
      assert.equal(res.status, 201);

      const count = await prisma.savedTraveler.count({
        where: { userId: user.id },
      });
      assert.equal(count, 20);
    },
  },

  // =========================================================================
  // F8: Loyalty Wallet & Orders Query Boundaries (5 cases)
  // =========================================================================
  {
    id: "T2-F8-01",
    feature: "F8",
    name: "GET /api/client/account/loyalty returns 401 when unauthenticated",
    async run({ baseUrl, assert }) {
      const guest = createSession({ baseUrl, ip: freshIp() });
      const res = await guest.get("/api/client/account/loyalty");
      assert.equal(res.status, 401);
    },
  },
  {
    id: "T2-F8-02",
    feature: "F8",
    name: "SILVER tier progress at 500 (0%, 1000 to GOLD) and 1499 (99%, 1 to GOLD)",
    async run({ baseUrl, prisma, tracker, assert }) {
      const { session, user } = await registerFreshMember({ baseUrl, tracker });
      await prisma.user.update({
        where: { id: user.id },
        data: { lifetimePoints: 500 },
      });
      const r500 = await session.get("/api/client/account/loyalty");
      assert.equal(r500.status, 200);
      assert.equal(r500.json.tierInfo.progressPercent, 0);
      assert.equal(r500.json.tierInfo.pointsToNext, 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: { lifetimePoints: 1499 },
      });
      const r1499 = await session.get("/api/client/account/loyalty");
      assert.equal(r1499.status, 200);
      assert.equal(r1499.json.tierInfo.progressPercent, 99);
      assert.equal(r1499.json.tierInfo.pointsToNext, 1);
    },
  },
  {
    id: "T2-F8-03",
    feature: "F8",
    name: "GOLD tier saturates at lifetimePoints=5000 (100%, nextTier=null, pointsToNext=0)",
    async run({ baseUrl, prisma, tracker, assert }) {
      const { session, user } = await registerFreshMember({ baseUrl, tracker });
      await prisma.user.update({
        where: { id: user.id },
        data: { lifetimePoints: 5000, loyaltyPoints: 5000 },
      });
      const res = await session.get("/api/client/account/loyalty");
      assert.equal(res.status, 200);
      assert.equal(res.json.tierInfo.tier, "GOLD");
      assert.equal(res.json.tierInfo.nextTier, null);
      assert.equal(res.json.tierInfo.progressPercent, 100);
      assert.equal(res.json.tierInfo.pointsToNext, 0);
    },
  },
  {
    id: "T2-F8-04",
    feature: "F8",
    name: "Loyalty ledger caps at 20 most recent transactions ordered descending",
    async run({ baseUrl, prisma, tracker, assert }) {
      const { session, user } = await registerFreshMember({ baseUrl, tracker });
      const baseTime = Date.now() - 30 * 60 * 1000;
      await prisma.loyaltyTransaction.createMany({
        data: Array.from({ length: 24 }, (_, idx) => ({
          userId: user.id,
          orderId: null,
          type: "ORDER_EARN",
          points: idx + 1,
          description: `Ledger item #${idx + 1}`,
          createdAt: new Date(baseTime + (idx + 1) * 1000),
        })),
      });

      const res = await session.get("/api/client/account/loyalty");
      assert.equal(res.status, 200);
      assert.equal(res.json.transactions.length, 20);
      const firstTime = new Date(res.json.transactions[0].createdAt).getTime();
      const lastTime = new Date(res.json.transactions[19].createdAt).getTime();
      assert.ok(firstTime >= lastTime);
    },
  },
  {
    id: "T2-F8-05",
    feature: "F8",
    name: "GET /api/client/account/orders?status=APPROVED filters claimed PAID order",
    async run({ baseUrl, tracker, fixtures, assert }) {
      const { order, phone } = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.midTier,
        paymentMethod: "BANK_TRANSFER",
      });
      await payOrderViaWebhook({ baseUrl, tracker, order });

      const { session } = await registerFreshMember({ baseUrl, tracker });
      const claimRes = await session.post("/api/client/orders/claim", {
        mode: "link",
        orderCode: order.code,
        phone,
      });
      assert.equal(claimRes.status, 200);

      const approved = await session.get(
        "/api/client/account/orders?status=APPROVED"
      );
      const initial = await session.get(
        "/api/client/account/orders?status=INITIAL"
      );
      assert.equal(approved.status, 200);
      assert.equal(initial.status, 200);
      assert.ok(approved.json.orders.some((o) => o.id === order.id));
      assert.equal(
        initial.json.orders.some((o) => o.id === order.id),
        false
      );
    },
  },

  // =========================================================================
  // F9: Auth Session & Static Hard Scope Compliance (5 cases)
  // =========================================================================
  {
    id: "T2-F9-01",
    feature: "F9",
    name: "ClientUserPublic never leaks password hash across /me, /register, /login, /profile",
    async run({ baseUrl, tracker, assert }) {
      const { session, email, password, res: regRes } =
        await registerFreshMember({ baseUrl, tracker });
      const meRes = await session.me();
      const profRes = await session.get("/api/client/account/profile");
      const loginRes = await createSession({ baseUrl, ip: freshIp() }).login({
        email,
        password,
      });

      for (const u of [
        regRes.json?.user,
        meRes.json?.user,
        profRes.json?.user,
        loginRes.json?.user,
      ]) {
        assert.ok(u && u.id);
        assert.equal("password" in u, false);
        assert.equal(u.hasPassword, true);
      }
    },
  },
  {
    id: "T2-F9-02",
    feature: "F9",
    name: "POST /api/client/auth/logout clears session cookie and /me returns null",
    async run({ baseUrl, tracker, assert }) {
      const { session } = await registerFreshMember({ baseUrl, tracker });
      assert.ok(session.jar.get("client_token"));

      const outRes = await session.logout();
      assert.equal(outRes.status, 200);
      assert.equal(session.jar.get("client_token"), null);

      const meRes = await session.me();
      assert.equal(meRes.status, 200);
      assert.equal(meRes.json?.user, null);
    },
  },
  {
    id: "T2-F9-03",
    feature: "F9",
    name: "GET /api/client/orders/[code]/status rejects unauthenticated / mismatched phone",
    async run({ baseUrl, tracker, fixtures, assert }) {
      const { order } = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.midTier,
        phone: "0912345678",
      });

      const guest = createSession({ baseUrl, ip: freshIp() });
      const unauth = await guest.get(`/api/client/orders/${order.code}/status`);
      assert.equal(unauth.status, 401);

      const badPhone = await guest.get(
        `/api/client/orders/${order.code}/status?phone=0999999999`
      );
      assert.equal(badPhone.status, 403);
    },
  },
  {
    id: "T2-F9-04",
    feature: "F9",
    name: "POST /api/client/orders rate limit 6 / 5m returns 429 on 7th order from same IP",
    async run({ baseUrl, tracker, assert }) {
      const fixedIp = freshIp();
      const s = createSession({ baseUrl, ip: fixedIp });
      const eph = await tracker.createEphemeralTour({ stockAdult: 10 });
      for (let i = 0; i < 6; i++) {
        const res = await s.createOrder(
          makeOrderPayload({
            fixture: eph,
            email: uniqueEmail(`rlo-${i}`),
            phone: uniquePhone(),
          }),
          tracker
        );
        assert.equal(res.status, 201);
      }

      const seventh = await s.createOrder(
        makeOrderPayload({
          fixture: eph,
          email: uniqueEmail("rlo-7"),
          phone: uniquePhone(),
        }),
        tracker
      );
      assert.equal(seventh.status, 429);
      assert.ok(Number(seventh.headers.get("retry-after")) >= 1);
    },
  },
  {
    id: "T2-F9-05",
    feature: "F9",
    name: "Static scope compliance: permissions.ts & Google SVG untouched; 0 raw colors in client diff/new UI",
    async run({ assert }) {
      const permDiff = execFileSync(
        "git",
        ["diff", "main", "--", "src/lib/permissions.ts"],
        { encoding: "utf8" }
      ).trim();
      assert.equal(permDiff, "", "src/lib/permissions.ts must remain untouched");

      const currentSocial = fs.readFileSync(
        path.join(process.cwd(), "src/components/client/SocialOAuthButtons.tsx"),
        "utf8"
      );
      const mainSocial = execFileSync(
        "git",
        ["show", "main:src/components/client/SocialOAuthButtons.tsx"],
        { encoding: "utf8" }
      );
      const extractSvg = (src) => {
        const m = src.match(/function GoogleLogo\(\)\s*\{[\s\S]*?\n\}/);
        return m ? m[0] : "";
      };
      assert.ok(extractSvg(currentSocial).length > 100);
      assert.equal(
        extractSvg(currentSocial).replace(/\r\n/g, "\n"),
        extractSvg(mainSocial).replace(/\r\n/g, "\n"),
        "GoogleLogo SVG in SocialOAuthButtons.tsx must remain untouched"
      );

      // Check added/modified lines in src/app/(client) & src/components/client + untracked files
      const rawColorRegex =
        /\b(emerald|amber|red|blue|green|yellow|slate|gray|indigo|purple|pink|teal|cyan|orange|rose|violet|sky|lime|fuchsia|zinc|neutral|stone)-\d{2,3}\b|#[0-9a-fA-F]{3,8}\b/;

      const clientDiff = execFileSync(
        "git",
        ["diff", "-U0", "main", "--", "src/app/(client)", "src/components/client"],
        { encoding: "utf8" }
      );
      const addedViolations = [];
      let currentFile = "";
      for (const line of clientDiff.split(/\r?\n/)) {
        if (line.startsWith("+++ b/")) {
          currentFile = line.slice(6);
          continue;
        }
        if (line.startsWith("+") && !line.startsWith("+++")) {
          const content = line.slice(1);
          if (rawColorRegex.test(content)) {
            addedViolations.push(`${currentFile}: ${content.trim()}`);
          }
        }
      }

      const untracked = execFileSync(
        "git",
        [
          "ls-files",
          "--others",
          "--exclude-standard",
          "src/app/(client)",
          "src/components/client",
        ],
        { encoding: "utf8" }
      )
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);

      for (const relPath of untracked) {
        const lines = fs
          .readFileSync(path.join(process.cwd(), relPath), "utf8")
          .split(/\r?\n/);
        lines.forEach((l, idx) => {
          if (rawColorRegex.test(l)) {
            addedViolations.push(`${relPath}:${idx + 1}: ${l.trim()}`);
          }
        });
      }

      assert.deepEqual(
        addedViolations,
        [],
        `Found raw Tailwind colors / stray hex in client UI changes:\n${addedViolations.join("\n")}`
      );
    },
  },

  // =========================================================================
  // F10: Checkout & Auth Flow Boundaries (5 cases)
  // =========================================================================
  {
    id: "T2-F10-01",
    feature: "F10",
    name: "Member with 0 loyaltyPoints cannot redeem points (redeemPoints=1 rejected)",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      const { session, user, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { loyaltyPoints: 0 },
      });

      const failRes = await session.createOrder(
        makeOrderPayload({
          fixture: fixtures.midTier,
          email,
          phone,
          redeemPoints: 1,
        }),
        tracker
      );
      assert.inSet(failRes.status, [400, 409]);

      const okRes = await session.createOrder(
        makeOrderPayload({
          fixture: fixtures.midTier,
          email,
          phone,
          redeemPoints: 0,
        }),
        tracker
      );
      assert.equal(okRes.status, 201);
      assert.equal(okRes.json.order.pointsDiscount, 0);
    },
  },
  {
    id: "T2-F10-02",
    feature: "F10",
    name: "20% redeem cap is calculated on post-coupon subtotal after GIAM10 discount",
    async run({ baseUrl, prisma, tracker, assert }) {
      // 3,000,000 tour with GIAM10 (-300,000 => postCoupon=2,700,000 -> 20% = 540,000 = 540 pts)
      // Pre-coupon 20% would be 600 pts -> 541..600 must be rejected!
      const tour3M = await tracker.createEphemeralTour({
        priceNewAdult: 3_000_000,
      });
      const { session, user, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { loyaltyPoints: 1000, lifetimePoints: 1000 },
      });

      const overRes = await session.createOrder(
        makeOrderPayload({
          fixture: tour3M,
          email,
          phone,
          couponCode: "GIAM10",
          redeemPoints: 541,
        }),
        tracker
      );
      assert.equal(overRes.status, 400);

      const okRes = await session.createOrder(
        makeOrderPayload({
          fixture: tour3M,
          email,
          phone,
          couponCode: "GIAM10",
          redeemPoints: 540,
        }),
        tracker
      );
      assert.equal(okRes.status, 201);
      assert.equal(okRes.json.order.discount, 300_000);
      assert.equal(okRes.json.order.pointsRedeemed, 540);
      assert.equal(okRes.json.order.pointsDiscount, 540_000);
      assert.equal(okRes.json.order.total, 2_160_000);
    },
  },
  {
    id: "T2-F10-03",
    feature: "F10",
    name: "Passenger count mismatch in POST /api/client/orders returns 400",
    async run({ baseUrl, tracker, fixtures, assert }) {
      const guest = createSession({ baseUrl, ip: freshIp() });
      const res = await guest.createOrder(
        makeOrderPayload({
          fixture: fixtures.midTier,
          quantityAdult: 2,
          passengers: [
            {
              fullName: "Only One",
              gender: "MALE",
              birthDate: "1990-01-01",
              tier: "ADULT",
            },
          ],
        }),
        tracker
      );
      assert.equal(res.status, 400);
    },
  },
  {
    id: "T2-F10-04",
    feature: "F10",
    name: "quick-register rejects password shorter than 6 characters with 400",
    async run({ baseUrl, tracker, fixtures, assert }) {
      const { claimToken } = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.midTier,
      });
      const res = await createSession({ baseUrl, ip: freshIp() }).post(
        "/api/client/orders/claim",
        {
          mode: "quick-register",
          claimToken,
          password: "123",
        }
      );
      assert.equal(res.status, 400);
    },
  },
  {
    id: "T2-F10-05",
    feature: "F10",
    name: "Login/Register safeNext hardens against //evil.com open redirect while preserving claimToken",
    async run({ baseUrl, assert }) {
      const loginSrc = fs.readFileSync(
        path.join(process.cwd(), "src/app/(client)/login/page.tsx"),
        "utf8"
      );
      const regSrc = fs.readFileSync(
        path.join(process.cwd(), "src/app/(client)/register/page.tsx"),
        "utf8"
      );
      assert.match(loginSrc, /\.startsWith\(["']\/["']\)/);
      assert.match(
        loginSrc,
        /(?:![a-zA-Z_$][\w$.]*\.startsWith\(["']\/\/["']\)|[a-zA-Z_$][\w$.]*\.startsWith\(["']\/\/["']\)[\s\S]{0,400}return\s+null)/
      );
      assert.match(loginSrc, /\.startsWith\(["']\/\\\\["']\)/);
      assert.match(loginSrc, /SENTINEL_ORIGIN/);
      assert.includes(regSrc, "claimToken");

      const guest = createSession({ baseUrl, ip: freshIp() });
      const res = await guest.get(
        "/login?next=//evil.com&claimToken=sample.token"
      );
      assert.equal(res.status, 200);
    },
  },
];
