import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { makeOrderPayload, makePassengers } from "../lib/fixtures.mjs";
import {
  adminUpdateOrder,
  createAdminSession,
  createGuestOrder,
  payOrderViaWebhook,
  registerFreshMember,
} from "../lib/helpers.mjs";
import {
  createSession,
  decodeClaimToken,
  freshIp,
  normalizePhoneValue,
  uniqueEmail,
  uniquePhone,
  uniqueTag,
  verifyClaimTokenHmac,
} from "../lib/http.mjs";

export const tier1Cases = [
  // =========================================================================
  // F1: Git Branch & Prisma Schema (5 cases)
  // =========================================================================
  {
    id: "T1-F1-01",
    feature: "F1",
    name: "Git branch is feat/member-retention-suite from bd1896f",
    async run({ assert }) {
      const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
        encoding: "utf8",
      }).trim();
      const mergeBase = execFileSync("git", ["merge-base", "main", "HEAD"], {
        encoding: "utf8",
      }).trim();
      assert.equal(branch, "feat/member-retention-suite");
      assert.ok(
        mergeBase.startsWith("bd1896f"),
        `Expected merge-base bd1896f*, got ${mergeBase}`
      );
    },
  },
  {
    id: "T1-F1-02",
    feature: "F1",
    name: "User loyaltyPoints and lifetimePoints default to 0",
    async run({ prisma, tracker, assert }) {
      const user = await prisma.user.create({
        data: {
          fullName: "E2E Default User",
          email: uniqueEmail("f1-user"),
        },
      });
      tracker.trackUser(user.id);
      assert.equal(user.loyaltyPoints, 0);
      assert.equal(user.lifetimePoints, 0);
    },
  },
  {
    id: "T1-F1-03",
    feature: "F1",
    name: "Order pointsRedeemed, pointsDiscount, and pointsEarned default to 0",
    async run({ prisma, tracker, assert }) {
      const code = `E2EOD-${uniqueTag("def").slice(-10).toUpperCase()}`;
      const order = await prisma.order.create({
        data: {
          code,
          fullName: "E2E Default Order",
          phone: "0912345678",
          subTotal: 1_000_000,
          total: 1_000_000,
        },
      });
      tracker.trackOrder(order);
      assert.equal(order.pointsRedeemed, 0);
      assert.equal(order.pointsDiscount, 0);
      assert.equal(order.pointsEarned, 0);
    },
  },
  {
    id: "T1-F1-04",
    feature: "F1",
    name: "SavedTraveler persists and cascades when parent User is deleted",
    async run({ prisma, tracker, assert }) {
      const user = await prisma.user.create({
        data: {
          fullName: "E2E Cascade User",
          email: uniqueEmail("f1-cascade"),
        },
      });
      tracker.trackUser(user.id);

      const traveler = await prisma.savedTraveler.create({
        data: {
          userId: user.id,
          fullName: "Nguyễn Văn A",
          gender: "MALE",
          birthDate: "1990-01-01",
          defaultTier: "ADULT",
          documentNumber: "079090001234",
          relationship: "Gia đình",
        },
      });
      tracker.trackTraveler(traveler.id);

      const foundBefore = await prisma.savedTraveler.findUnique({
        where: { id: traveler.id },
      });
      assert.equal(foundBefore?.fullName, "Nguyễn Văn A");

      await prisma.user.delete({ where: { id: user.id } });
      const foundAfter = await prisma.savedTraveler.findUnique({
        where: { id: traveler.id },
      });
      assert.equal(foundAfter, null);
    },
  },
  {
    id: "T1-F1-05",
    feature: "F1",
    name: "LoyaltyTransaction enforces unique (userId, orderId, type) constraint",
    async run({ prisma, tracker, assert }) {
      const user = await prisma.user.create({
        data: {
          fullName: "E2E Unique Tx User",
          email: uniqueEmail("f1-uniq"),
        },
      });
      tracker.trackUser(user.id);

      const order = await prisma.order.create({
        data: {
          code: `E2EOD-${uniqueTag("uq").slice(-10).toUpperCase()}`,
          userId: user.id,
          fullName: "E2E Unique Order",
          phone: "0912345678",
          subTotal: 5_000_000,
          total: 5_000_000,
        },
      });
      tracker.trackOrder(order);

      await prisma.loyaltyTransaction.create({
        data: {
          userId: user.id,
          orderId: order.id,
          type: "ORDER_EARN",
          points: 50,
          description: "Test 1",
        },
      });

      await assert.rejects(
        () =>
          prisma.loyaltyTransaction.create({
            data: {
              userId: user.id,
              orderId: order.id,
              type: "ORDER_EARN",
              points: 50,
              description: "Test duplicate",
            },
          }),
        (err) => err?.code === "P2002"
      );
    },
  },

  // =========================================================================
  // F2: Core Domain Contracts via Opaque-Box API & DB (5 cases)
  // =========================================================================
  {
    id: "T1-F2-01",
    feature: "F2",
    name: "Tier progression metadata (BRONZE -> SILVER -> GOLD) via /api/client/account/loyalty",
    async run({ baseUrl, prisma, tracker, assert }) {
      const { session, user } = await registerFreshMember({
        baseUrl,
        tracker,
      });

      const bronzeRes = await session.get("/api/client/account/loyalty");
      assert.equal(bronzeRes.status, 200);
      assert.equal(bronzeRes.json?.tierInfo?.tier, "BRONZE");
      assert.equal(bronzeRes.json?.tierInfo?.progressPercent, 20);
      assert.equal(bronzeRes.json?.tierInfo?.pointsToNext, 400);

      await prisma.user.update({
        where: { id: user.id },
        data: { lifetimePoints: 500, loyaltyPoints: 500 },
      });
      const silverRes = await session.get("/api/client/account/loyalty");
      assert.equal(silverRes.status, 200);
      assert.equal(silverRes.json?.tierInfo?.tier, "SILVER");
      assert.equal(silverRes.json?.tierInfo?.progressPercent, 0);
      assert.equal(silverRes.json?.tierInfo?.pointsToNext, 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: { lifetimePoints: 1500, loyaltyPoints: 1500 },
      });
      const goldRes = await session.get("/api/client/account/loyalty");
      assert.equal(goldRes.status, 200);
      assert.equal(goldRes.json?.tierInfo?.tier, "GOLD");
      assert.equal(goldRes.json?.tierInfo?.progressPercent, 100);
      assert.equal(goldRes.json?.tierInfo?.nextTier, null);
    },
  },
  {
    id: "T1-F2-02",
    feature: "F2",
    name: "20% post-coupon point redemption cap enforced by POST /api/client/orders",
    async run({ baseUrl, prisma, tracker, assert }) {
      const tour5M = await tracker.createEphemeralTour({
        priceNewAdult: 5_000_000,
      });
      const { session, user, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { loyaltyPoints: 2000, lifetimePoints: 2000 },
      });

      // 20% of 5,000,000 = 1,000,000 VND = 1000 pts
      const overRes = await session.createOrder(
        makeOrderPayload({
          fixture: tour5M,
          email,
          phone,
          redeemPoints: 1001,
        }),
        tracker
      );
      assert.equal(overRes.status, 400);

      const okRes = await session.createOrder(
        makeOrderPayload({
          fixture: tour5M,
          email,
          phone,
          redeemPoints: 1000,
        }),
        tracker
      );
      assert.equal(okRes.status, 201);
      assert.equal(okRes.json?.order?.pointsRedeemed, 1000);
      assert.equal(okRes.json?.order?.pointsDiscount, 1_000_000);
      assert.equal(okRes.json?.order?.total, 4_000_000);
    },
  },
  {
    id: "T1-F2-03",
    feature: "F2",
    name: "1% earn rate (Math.floor(total / 100_000)) on PAID & APPROVED orders",
    async run({ baseUrl, tracker, fixtures, assert }) {
      const { session, user, email, phone } = await registerFreshMember({
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
      const expectedEarn = Math.floor(order.total / 100_000);

      const { res: whRes } = await payOrderViaWebhook({
        baseUrl,
        tracker,
        order,
      });
      assert.equal(whRes.status, 200);
      assert.equal(whRes.json?.outcome, "PAID_APPROVED");

      const loyaltyRes = await session.get("/api/client/account/loyalty");
      assert.equal(loyaltyRes.status, 200);
      assert.equal(loyaltyRes.json?.loyaltyPoints, 100 + expectedEarn);
      assert.equal(loyaltyRes.json?.lifetimePoints, 100 + expectedEarn);

      const ordersRes = await session.get("/api/client/account/orders");
      assert.equal(ordersRes.status, 200);
      const found = ordersRes.json.orders.find((o) => o.id === order.id);
      assert.equal(found?.pointsEarned, expectedEarn);
    },
  },
  {
    id: "T1-F2-04",
    feature: "F2",
    name: "Guest claimToken encodes normalized fields, 30m TTL, and valid HMAC-SHA256",
    async run({ baseUrl, tracker, fixtures, assert }) {
      const rawEmail = `Guest.Upper.${uniqueTag("tok")}@Test.TravelVN.local`;
      const rawPhone = "+84 912.345-678";
      const { order, claimToken } = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.midTier,
        email: rawEmail,
        phone: rawPhone,
      });

      assert.ok(typeof claimToken === "string" && claimToken.includes("."));
      assert.equal(verifyClaimTokenHmac(claimToken), true);

      const decoded = decodeClaimToken(claimToken);
      assert.ok(decoded !== null);
      assert.equal(decoded.payload.orderId, order.id);
      assert.equal(decoded.payload.orderCode, order.code);
      assert.equal(decoded.payload.email, rawEmail.trim().toLowerCase());
      assert.equal(decoded.payload.phone, normalizePhoneValue(rawPhone));
      assert.ok(decoded.payload.exp > Date.now() + 20 * 60 * 1000);
    },
  },
  {
    id: "T1-F2-05",
    feature: "F2",
    name: "Member coupon eligibility matrix for THANHVIEN200 and VIP500",
    async run({ baseUrl, prisma, tracker, assert }) {
      const { session, user } = await registerFreshMember({
        baseUrl,
        tracker,
      });

      const bronze0Res = await session.get("/api/client/account/loyalty");
      assert.equal(bronze0Res.status, 200);
      const tvBronze = bronze0Res.json.coupons.find(
        (c) => c.code === "THANHVIEN200"
      );
      const vipBronze = bronze0Res.json.coupons.find(
        (c) => c.code === "VIP500"
      );
      assert.equal(tvBronze?.eligibility?.eligible, true);
      assert.equal(vipBronze?.eligibility?.eligible, false);

      await prisma.user.update({
        where: { id: user.id },
        data: { lifetimePoints: 500, loyaltyPoints: 500 },
      });

      const silverRes = await session.get("/api/client/account/loyalty");
      assert.equal(silverRes.status, 200);
      const vipSilver = silverRes.json.coupons.find((c) => c.code === "VIP500");
      assert.equal(vipSilver?.eligibility?.eligible, true);
    },
  },

  // =========================================================================
  // F3: Auth & Google OAuth Auto-Claim (5 cases)
  // =========================================================================
  {
    id: "T1-F3-01",
    feature: "F3",
    name: "Credentials registration grants +100 Welcome Bonus and sets client_token",
    async run({ baseUrl, prisma, tracker, assert }) {
      const { session, user } = await registerFreshMember({
        baseUrl,
        tracker,
      });
      assert.ok(session.jar.get("client_token"));
      assert.equal(user.loyaltyPoints, 100);
      assert.equal(user.lifetimePoints, 100);
      assert.equal(user.memberTier, "BRONZE");

      const txs = await prisma.loyaltyTransaction.findMany({
        where: { userId: user.id },
      });
      assert.equal(txs.length, 1);
      assert.equal(txs[0].type, "WELCOME_BONUS");
      assert.equal(txs[0].points, 100);
    },
  },
  {
    id: "T1-F3-02",
    feature: "F3",
    name: "Normal registration does NOT blindly auto-claim guest orders by unverified email",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      const sharedEmail = uniqueEmail("nohijack");
      const { order } = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.midTier,
        email: sharedEmail,
      });

      const { session, user } = await registerFreshMember({
        baseUrl,
        tracker,
        email: sharedEmail,
      });

      const ordersRes = await session.get("/api/client/account/orders");
      assert.equal(ordersRes.status, 200);
      assert.equal(ordersRes.json?.orders?.length, 0);

      const dbOrder = await prisma.order.findUnique({
        where: { id: order.id },
        select: { userId: true },
      });
      assert.equal(dbOrder?.userId, null);
      assert.ok(user.id);
    },
  },
  {
    id: "T1-F3-03",
    feature: "F3",
    name: "POST /api/client/auth/register with valid claimToken claims order and grants +100 bonus",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      const guestEmail = uniqueEmail("regclaim");
      const { order, claimToken } = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.midTier,
        email: guestEmail,
      });

      const { session, user } = await registerFreshMember({
        baseUrl,
        tracker,
        email: guestEmail,
        claimToken,
      });

      assert.equal(user.loyaltyPoints, 100);
      const dbOrder = await prisma.order.findUnique({
        where: { id: order.id },
        select: { userId: true },
      });
      assert.equal(dbOrder?.userId, user.id);

      const ordersRes = await session.get("/api/client/account/orders");
      assert.equal(ordersRes.status, 200);
      assert.ok(ordersRes.json.orders.some((o) => o.id === order.id));
    },
  },
  {
    id: "T1-F3-04",
    feature: "F3",
    name: "POST /api/client/auth/login with valid claimToken claims target guest order only",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      const { email, password, user } = await registerFreshMember({
        baseUrl,
        tracker,
      });

      const { order: targetOrder, claimToken } = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.midTier,
        email,
      });
      const { order: otherOrder } = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.midTier,
        email,
      });

      const loginSession = createSession({ baseUrl, ip: freshIp() });
      const loginRes = await loginSession.login({
        email,
        password,
        claimToken,
      });
      assert.equal(loginRes.status, 200);

      const dbTarget = await prisma.order.findUnique({
        where: { id: targetOrder.id },
      });
      const dbOther = await prisma.order.findUnique({
        where: { id: otherOrder.id },
      });
      assert.equal(dbTarget?.userId, user.id);
      assert.equal(dbOther?.userId, null);
    },
  },
  {
    id: "T1-F3-05",
    feature: "F3",
    name: "Google OAuth verified email auto-claim (sandbox when enabled, 403 & redirect guard when disabled)",
    async run({ baseUrl, prisma, tracker, fixtures, assert, note }) {
      const probeSession = createSession({ baseUrl, ip: freshIp() });
      const checkRes = await probeSession.get(
        "/api/client/auth/oauth/google?check=1"
      );

      if (checkRes.status === 200 && checkRes.json?.mode === "sandbox") {
        const rawEmail = `OAuth.Mix.${uniqueTag("g")}@Test.TravelVN.local`;
        const { order } = await createGuestOrder({
          baseUrl,
          tracker,
          fixture: fixtures.midTier,
          email: rawEmail,
        });

        const oauthSession = createSession({ baseUrl, ip: freshIp() });
        const oauthRes = await oauthSession.post(
          "/api/client/auth/oauth/google",
          {
            email: rawEmail.toLowerCase(),
            fullName: "Google OAuth User",
            providerId: `google-${uniqueTag("sub")}`,
          }
        );
        assert.equal(oauthRes.status, 200);
        assert.ok(oauthSession.jar.get("client_token"));
        const userId = oauthRes.json?.user?.id;
        assert.ok(userId);
        tracker.trackUser(userId);
        assert.equal(oauthRes.json.user.loyaltyPoints, 100);

        const dbOrder = await prisma.order.findUnique({
          where: { id: order.id },
        });
        assert.equal(dbOrder?.userId, userId);
      } else {
        assert.equal(checkRes.status, 403);
        const redirectRes = await probeSession.get(
          "/api/client/auth/oauth/google"
        );
        assert.inSet(redirectRes.status, [302, 307]);
        assert.includes(redirectRes.location || "", "/login?error=oauth_config");

        const cbRes = await probeSession.get(
          "/api/client/auth/oauth/google/callback?code=fake&state=bad"
        );
        assert.inSet(cbRes.status, [302, 307]);
        assert.includes(cbRes.location || "", "/login?error=oauth_config");
        note(
          "OAuth sandbox is disabled on server; verified 403 & redirect guards (set ENABLE_OAUTH_SANDBOX=true to run live sandbox auto-claim)."
        );
      }
    },
  },

  // =========================================================================
  // F4: Order Claim API (5 cases)
  // =========================================================================
  {
    id: "T1-F4-01",
    feature: "F4",
    name: "POST /api/client/orders/claim mode=quick-register creates user (+100) and claims order",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      const guestEmail = uniqueEmail("qr");
      const { order, claimToken } = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.midTier,
        email: guestEmail,
      });

      const qrSession = createSession({ baseUrl, ip: freshIp() });
      const res = await qrSession.post("/api/client/orders/claim", {
        mode: "quick-register",
        claimToken,
        password: "Password@123",
        fullName: "Quick Reg Member",
      });
      assert.equal(res.status, 201);
      assert.ok(qrSession.jar.get("client_token"));
      assert.ok(res.json?.user?.id);
      tracker.trackUser(res.json.user.id);
      assert.equal(res.json.user.loyaltyPoints, 100);
      assert.equal(res.json.claimedOrder?.code, order.code);

      const dbOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      assert.equal(dbOrder?.userId, res.json.user.id);
    },
  },
  {
    id: "T1-F4-02",
    feature: "F4",
    name: "POST /api/client/orders/claim mode=link via claimToken attaches order to member",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      const { session, user } = await registerFreshMember({
        baseUrl,
        tracker,
      });
      const { order, claimToken } = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.midTier,
      });

      const res = await session.post("/api/client/orders/claim", {
        mode: "link",
        claimToken,
      });
      assert.equal(res.status, 200);
      assert.equal(res.json?.claimedOrder?.id, order.id);

      const dbOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      assert.equal(dbOrder?.userId, user.id);
    },
  },
  {
    id: "T1-F4-03",
    feature: "F4",
    name: "POST /api/client/orders/claim mode=link via orderCode + phone links guest order",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      const { session, user } = await registerFreshMember({
        baseUrl,
        tracker,
      });
      const phone = uniquePhone();
      const { order } = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.midTier,
        phone,
      });

      const res = await session.post("/api/client/orders/claim", {
        mode: "link",
        orderCode: order.code,
        phone,
      });
      assert.equal(res.status, 200);
      assert.equal(res.json?.claimedOrder?.code, order.code);

      const dbOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      assert.equal(dbOrder?.userId, user.id);
    },
  },
  {
    id: "T1-F4-04",
    feature: "F4",
    name: "POST /api/client/orders/claim normalizes +84/punctuation phone formats",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      const { session, user } = await registerFreshMember({
        baseUrl,
        tracker,
      });
      const basePhone = "0912345678";
      const { order } = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.midTier,
        phone: basePhone,
      });

      const res = await session.post("/api/client/orders/claim", {
        mode: "link",
        orderCode: order.code.toLowerCase(),
        phone: "+84 912.345-678",
      });
      assert.equal(res.status, 200);

      const dbOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      assert.equal(dbOrder?.userId, user.id);
    },
  },
  {
    id: "T1-F4-05",
    feature: "F4",
    name: "POST /api/client/orders/claim rejects wrong phone with 403 and leaves userId null",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      const { session } = await registerFreshMember({
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
        phone: "0999999999",
      });
      assert.equal(res.status, 403);

      const dbOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      assert.equal(dbOrder?.userId, null);
    },
  },

  // =========================================================================
  // F5: Order Creation API (5 cases)
  // =========================================================================
  {
    id: "T1-F5-01",
    feature: "F5",
    name: "Guest checkout with public coupon TOUR2026 stays smooth and issues claimToken",
    async run({ baseUrl, tracker, fixtures, assert }) {
      const { order, claimToken } = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.midTier,
        couponCode: "TOUR2026",
      });
      assert.equal(order.userId, null);
      assert.equal(order.discount, 400_000);
      assert.equal(order.couponCode, "TOUR2026");
      assert.equal(order.pointsRedeemed, 0);
      assert.ok(typeof claimToken === "string" && claimToken.length > 20);
    },
  },
  {
    id: "T1-F5-02",
    feature: "F5",
    name: "Member checkout applies THANHVIEN200 (-200,000d) on >= 2M order",
    async run({ baseUrl, tracker, fixtures, assert }) {
      const { session, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });
      const res = await session.createOrder(
        makeOrderPayload({
          fixture: fixtures.midTier,
          email,
          phone,
          couponCode: "THANHVIEN200",
        }),
        tracker
      );
      assert.equal(res.status, 201);
      assert.equal(res.json.order.couponCode, "THANHVIEN200");
      assert.equal(res.json.order.discount, 200_000);
    },
  },
  {
    id: "T1-F5-03",
    feature: "F5",
    name: "SILVER member applies VIP500 (-500,000d) on >= 8M order",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      const { session, user, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { lifetimePoints: 500, loyaltyPoints: 500 },
      });

      const res = await session.createOrder(
        makeOrderPayload({
          fixture: fixtures.vipTier,
          quantityAdult: fixtures.vipTier.unitAdult >= 8_000_000 ? 1 : 2,
          email,
          phone,
          couponCode: "VIP500",
        }),
        tracker
      );
      assert.equal(res.status, 201);
      assert.equal(res.json.order.couponCode, "VIP500");
      assert.equal(res.json.order.discount, 500_000);
    },
  },
  {
    id: "T1-F5-04",
    feature: "F5",
    name: "Member redeems 100 loyalty points (-100,000d) and records ORDER_REDEEM",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      const { session, user, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });
      const res = await session.createOrder(
        makeOrderPayload({
          fixture: fixtures.tenMTier,
          email,
          phone,
          redeemPoints: 100,
        }),
        tracker
      );
      assert.equal(res.status, 201);
      const order = res.json.order;
      assert.equal(order.pointsRedeemed, 100);
      assert.equal(order.pointsDiscount, 100_000);
      assert.equal(order.total, order.subTotal - 100_000);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      assert.equal(dbUser?.loyaltyPoints, 0);

      const redeemTx = await prisma.loyaltyTransaction.findFirst({
        where: { userId: user.id, orderId: order.id, type: "ORDER_REDEEM" },
      });
      assert.equal(redeemTx?.points, -100);
    },
  },
  {
    id: "T1-F5-05",
    feature: "F5",
    name: "saveTravelers=true saves passengers and deduplicates by fullName + birthDate",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      const { session, user, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });

      const p1 = {
        fullName: "Trần Minh Quân",
        gender: "MALE",
        birthDate: "1991-03-10",
        tier: "ADULT",
        documentNumber: "079091001122",
      };
      const p2 = {
        fullName: "Lê Thu Hà",
        gender: "FEMALE",
        birthDate: "1993-07-22",
        tier: "ADULT",
      };
      const p3 = {
        fullName: "Phạm Bảo An",
        gender: "FEMALE",
        birthDate: "2019-11-05",
        tier: "CHILD",
      };

      const res1 = await session.createOrder(
        makeOrderPayload({
          fixture: fixtures.midTier,
          quantityAdult: 2,
          email,
          phone,
          saveTravelers: true,
          passengers: [p1, p2],
        }),
        tracker
      );
      assert.equal(res1.status, 201);

      let saved = await prisma.savedTraveler.findMany({
        where: { userId: user.id },
      });
      assert.equal(saved.length, 2);

      // Repeat with overlapping p1 (different case/spaces) + new p3
      const res2 = await session.createOrder(
        makeOrderPayload({
          fixture: fixtures.midTier,
          quantityAdult: 1,
          quantityChild: 1,
          email,
          phone,
          saveTravelers: true,
          passengers: [{ ...p1, fullName: "  trần minh quân " }, p3],
        }),
        tracker
      );
      assert.equal(res2.status, 201);

      saved = await prisma.savedTraveler.findMany({
        where: { userId: user.id },
      });
      assert.equal(saved.length, 3);
    },
  },

  // =========================================================================
  // F6: Order Lifecycle Loyalty Hooks (5 cases)
  // =========================================================================
  {
    id: "T1-F6-01",
    feature: "F6",
    name: "Payment webhook credits ORDER_EARN (+1%) for PAID & APPROVED member order",
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
        }),
        tracker
      );
      assert.equal(orderRes.status, 201);
      const order = orderRes.json.order;
      const expected = Math.floor(order.total / 100_000);

      const { res: whRes } = await payOrderViaWebhook({
        baseUrl,
        tracker,
        order,
      });
      assert.equal(whRes.status, 200);
      assert.equal(whRes.json?.outcome, "PAID_APPROVED");

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      assert.equal(dbUser?.loyaltyPoints, 100 + expected);
      assert.equal(dbUser?.lifetimePoints, 100 + expected);
    },
  },
  {
    id: "T1-F6-02",
    feature: "F6",
    name: "Admin PUT APPROVED+PAID credits ORDER_EARN",
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
        }),
        tracker
      );
      assert.equal(orderRes.status, 201);
      const order = orderRes.json.order;
      const expected = Math.floor(order.total / 100_000);

      const adminSession = await createAdminSession(baseUrl);
      const putRes = await adminUpdateOrder(adminSession, order, {
        paymentStatus: "PAID",
        status: "APPROVED",
        refundStatus: "NONE",
      });
      assert.equal(putRes.status, 200);

      const earnTx = await prisma.loyaltyTransaction.findFirst({
        where: { userId: user.id, orderId: order.id, type: "ORDER_EARN" },
      });
      assert.equal(earnTx?.points, expected);
    },
  },
  {
    id: "T1-F6-03",
    feature: "F6",
    name: "Customer PATCH cancel refunds pointsRedeemed with ORDER_REDEEM_REFUND",
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
          redeemPoints: 50,
        }),
        tracker
      );
      assert.equal(orderRes.status, 201);
      const order = orderRes.json.order;

      const cancelRes = await session.patch(
        `/api/client/account/orders/${order.id}/cancel`
      );
      assert.equal(cancelRes.status, 200);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      assert.equal(dbUser?.loyaltyPoints, 100);

      const refundTx = await prisma.loyaltyTransaction.findFirst({
        where: {
          userId: user.id,
          orderId: order.id,
          type: "ORDER_REDEEM_REFUND",
        },
      });
      assert.equal(refundTx?.points, 50);
    },
  },
  {
    id: "T1-F6-04",
    feature: "F6",
    name: "Admin cancel (PUT) and Admin delete (DELETE) both refund pointsRedeemed",
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
          redeemPoints: 40,
        }),
        tracker
      );
      const o2Res = await session.createOrder(
        makeOrderPayload({
          fixture: fixtures.tenMTier,
          email,
          phone,
          redeemPoints: 60,
        }),
        tracker
      );
      assert.equal(o1Res.status, 201);
      assert.equal(o2Res.status, 201);

      const adminSession = await createAdminSession(baseUrl);
      const putRes = await adminUpdateOrder(adminSession, o1Res.json.order, {
        status: "CANCELLED",
      });
      assert.equal(putRes.status, 200);

      const delRes = await adminSession.del(
        `/api/admin/orders/${o2Res.json.order.id}`
      );
      assert.equal(delRes.status, 200);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      assert.equal(dbUser?.loyaltyPoints, 100);
    },
  },
  {
    id: "T1-F6-05",
    feature: "F6",
    name: "Admin PUT refundStatus=REFUNDED revokes ORDER_EARN via ORDER_REFUND_REVOKE",
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
        }),
        tracker
      );
      assert.equal(orderRes.status, 201);
      const order = orderRes.json.order;
      const earned = Math.floor(order.total / 100_000);

      const { res: whRes } = await payOrderViaWebhook({
        baseUrl,
        tracker,
        order,
      });
      assert.equal(whRes.status, 200);

      const adminSession = await createAdminSession(baseUrl);
      const refundRes = await adminUpdateOrder(adminSession, order, {
        paymentMethod: "BANK_TRANSFER",
        paymentStatus: "PAID",
        status: "CANCELLED",
        refundStatus: "REFUNDED",
      });
      assert.equal(refundRes.status, 200);

      const revokeTx = await prisma.loyaltyTransaction.findFirst({
        where: {
          userId: user.id,
          orderId: order.id,
          type: "ORDER_REFUND_REVOKE",
        },
      });
      assert.equal(revokeTx?.points, -earned);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      assert.equal(dbUser?.loyaltyPoints, 100);
      assert.equal(dbUser?.lifetimePoints, 100);
    },
  },

  // =========================================================================
  // F7: Saved Travelers CRUD & Page (5 cases)
  // =========================================================================
  {
    id: "T1-F7-01",
    feature: "F7",
    name: "GET /api/client/account/travelers returns all saved travelers with expected fields",
    async run({ baseUrl, tracker, assert }) {
      const { session } = await registerFreshMember({ baseUrl, tracker });

      const c1 = await session.post("/api/client/account/travelers", {
        fullName: "Nguyễn Hải Nam",
        gender: "MALE",
        birthDate: "1988-02-14",
        defaultTier: "ADULT",
        documentNumber: "079088001122",
        relationship: "Bản thân",
      });
      const c2 = await session.post("/api/client/account/travelers", {
        fullName: "Nguyễn Hải My",
        gender: "FEMALE",
        birthDate: "2018-08-20",
        defaultTier: "CHILD",
      });
      assert.equal(c1.status, 201);
      assert.equal(c2.status, 201);

      const listRes = await session.get("/api/client/account/travelers");
      assert.equal(listRes.status, 200);
      assert.equal(listRes.json?.travelers?.length, 2);
      const first = listRes.json.travelers.find(
        (t) => t.fullName === "Nguyễn Hải Nam"
      );
      assert.equal(first?.gender, "MALE");
      assert.equal(first?.defaultTier, "ADULT");
      assert.equal(first?.documentNumber, "079088001122");
      assert.equal(first?.relationship, "Bản thân");
    },
  },
  {
    id: "T1-F7-02",
    feature: "F7",
    name: "POST /api/client/account/travelers creates traveler and persists in PostgreSQL",
    async run({ baseUrl, prisma, tracker, assert }) {
      const { session, user } = await registerFreshMember({ baseUrl, tracker });
      const res = await session.post("/api/client/account/travelers", {
        fullName: "Phạm Gia Hân",
        gender: "FEMALE",
        birthDate: "1995-05-20",
        defaultTier: "ADULT",
        documentNumber: "079095001234",
        relationship: "Gia đình",
      });
      assert.equal(res.status, 201);
      assert.ok(res.json?.traveler?.id);

      const dbRow = await prisma.savedTraveler.findUnique({
        where: { id: res.json.traveler.id },
      });
      assert.equal(dbRow?.userId, user.id);
      assert.equal(dbRow?.fullName, "Phạm Gia Hân");
    },
  },
  {
    id: "T1-F7-03",
    feature: "F7",
    name: "PUT /api/client/account/travelers/[id] updates traveler fields",
    async run({ baseUrl, tracker, assert }) {
      const { session } = await registerFreshMember({ baseUrl, tracker });
      const created = await session.post("/api/client/account/travelers", {
        fullName: "Lê Văn Cũ",
        gender: "MALE",
        birthDate: "1990-01-01",
        defaultTier: "ADULT",
      });
      assert.equal(created.status, 201);
      const id = created.json.traveler.id;

      const updated = await session.put(`/api/client/account/travelers/${id}`, {
        fullName: "Lê Văn Mới",
        gender: "MALE",
        birthDate: "1990-01-01",
        defaultTier: "ADULT",
        documentNumber: "079090009999",
        relationship: "Bạn bè",
      });
      assert.equal(updated.status, 200);
      assert.equal(updated.json?.traveler?.fullName, "Lê Văn Mới");
      assert.equal(updated.json?.traveler?.relationship, "Bạn bè");
    },
  },
  {
    id: "T1-F7-04",
    feature: "F7",
    name: "DELETE /api/client/account/travelers/[id] removes traveler from DB",
    async run({ baseUrl, tracker, assert }) {
      const { session } = await registerFreshMember({ baseUrl, tracker });
      const created = await session.post("/api/client/account/travelers", {
        fullName: "Hành Khách Xóa",
        gender: "OTHER",
        birthDate: "1994-12-12",
        defaultTier: "ADULT",
      });
      assert.equal(created.status, 201);
      const id = created.json.traveler.id;

      const delRes = await session.del(`/api/client/account/travelers/${id}`);
      assert.equal(delRes.status, 200);

      const listRes = await session.get("/api/client/account/travelers");
      assert.equal(listRes.status, 200);
      assert.equal(
        listRes.json.travelers.some((t) => t.id === id),
        false
      );
    },
  },
  {
    id: "T1-F7-05",
    feature: "F7",
    name: "GET /account/travelers SSR HTML returns 200 without runtime error",
    async run({ baseUrl, tracker, assert }) {
      const { session } = await registerFreshMember({ baseUrl, tracker });
      const res = await session.get("/account/travelers");
      assert.equal(res.status, 200);
      assert.includes(res.headers.get("content-type") || "", "text/html");
      assert.doesNotMatch(res.text, /Application error|Internal Server Error/i);
    },
  },

  // =========================================================================
  // F8: Member Center & Orders UI/API (5 cases)
  // =========================================================================
  {
    id: "T1-F8-01",
    feature: "F8",
    name: "GET /api/client/account/loyalty returns complete wallet payload",
    async run({ baseUrl, tracker, assert }) {
      const { session } = await registerFreshMember({ baseUrl, tracker });
      const res = await session.get("/api/client/account/loyalty");
      assert.equal(res.status, 200);
      assert.equal(typeof res.json?.loyaltyPoints, "number");
      assert.equal(typeof res.json?.lifetimePoints, "number");
      assert.equal(typeof res.json?.paidOrderCount, "number");
      assert.ok(res.json?.tierInfo && typeof res.json.tierInfo.tier === "string");
      assert.ok(Array.isArray(res.json?.coupons));
      assert.ok(Array.isArray(res.json?.transactions));
    },
  },
  {
    id: "T1-F8-02",
    feature: "F8",
    name: "GET /api/client/account/loyalty returns accurate BRONZE label & progress",
    async run({ baseUrl, tracker, assert }) {
      const { session } = await registerFreshMember({ baseUrl, tracker });
      const res = await session.get("/api/client/account/loyalty");
      assert.equal(res.status, 200);
      assert.equal(res.json.tierInfo.tier, "BRONZE");
      assert.equal(res.json.tierInfo.label, "Thành viên Đồng");
      assert.equal(res.json.tierInfo.nextTier, "SILVER");
      assert.equal(res.json.tierInfo.nextTierMinPoints, 500);
      assert.equal(res.json.tierInfo.progressPercent, 20);
      assert.equal(res.json.tierInfo.pointsToNext, 400);
    },
  },
  {
    id: "T1-F8-03",
    feature: "F8",
    name: "GET /api/client/account/loyalty lists THANHVIEN200 and VIP500 coupon cards",
    async run({ baseUrl, tracker, assert }) {
      const { session } = await registerFreshMember({ baseUrl, tracker });
      const res = await session.get("/api/client/account/loyalty");
      assert.equal(res.status, 200);
      const codes = res.json.coupons.map((c) => c.code);
      assert.includes(codes, "THANHVIEN200");
      assert.includes(codes, "VIP500");
    },
  },
  {
    id: "T1-F8-04",
    feature: "F8",
    name: "GET /api/client/account/loyalty ledger records WELCOME_BONUS, ORDER_REDEEM, ORDER_EARN",
    async run({ baseUrl, tracker, fixtures, assert }) {
      const { session, email, phone } = await registerFreshMember({
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
      await payOrderViaWebhook({
        baseUrl,
        tracker,
        order: orderRes.json.order,
      });

      const res = await session.get("/api/client/account/loyalty");
      assert.equal(res.status, 200);
      const types = res.json.transactions.map((t) => t.type);
      assert.includes(types, "WELCOME_BONUS");
      assert.includes(types, "ORDER_REDEEM");
      assert.includes(types, "ORDER_EARN");
    },
  },
  {
    id: "T1-F8-05",
    feature: "F8",
    name: "/account and /account/orders SSR + /api/client/account/orders expose points fields",
    async run({ baseUrl, tracker, fixtures, assert }) {
      const { session, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });
      const orderRes = await session.createOrder(
        makeOrderPayload({
          fixture: fixtures.tenMTier,
          email,
          phone,
          redeemPoints: 25,
        }),
        tracker
      );
      assert.equal(orderRes.status, 201);

      const ordersRes = await session.get("/api/client/account/orders");
      assert.equal(ordersRes.status, 200);
      const o = ordersRes.json.orders.find(
        (x) => x.id === orderRes.json.order.id
      );
      assert.equal(o?.pointsRedeemed, 25);
      assert.equal(o?.pointsDiscount, 25_000);
      assert.equal(o?.pointsEarned, 0);

      for (const route of ["/account", "/account/orders"]) {
        const page = await session.get(route);
        assert.equal(page.status, 200);
        assert.doesNotMatch(
          page.text,
          /Application error|Internal Server Error/i
        );
      }
    },
  },

  // =========================================================================
  // F9: Header & Account Sidebar Navigation + Contracts (5 cases)
  // =========================================================================
  {
    id: "T1-F9-01",
    feature: "F9",
    name: "GET /api/client/auth/me exposes loyaltyPoints, lifetimePoints, memberTier",
    async run({ baseUrl, tracker, assert }) {
      const { session, user } = await registerFreshMember({ baseUrl, tracker });
      const meRes = await session.me();
      assert.equal(meRes.status, 200);
      assert.equal(meRes.json?.user?.id, user.id);
      assert.equal(meRes.json?.user?.loyaltyPoints, 100);
      assert.equal(meRes.json?.user?.lifetimePoints, 100);
      assert.equal(meRes.json?.user?.memberTier, "BRONZE");
      assert.equal(meRes.json?.user?.hasPassword, true);
    },
  },
  {
    id: "T1-F9-02",
    feature: "F9",
    name: "GET /api/client/auth/me returns { user: null } for guest session",
    async run({ baseUrl, assert }) {
      const guest = createSession({ baseUrl, ip: freshIp() });
      const res = await guest.me();
      assert.equal(res.status, 200);
      assert.equal(res.json?.user, null);
    },
  },
  {
    id: "T1-F9-03",
    feature: "F9",
    name: "GET /api/client/account/profile includes loyalty fields consistent with /auth/me",
    async run({ baseUrl, tracker, assert }) {
      const { session, user } = await registerFreshMember({ baseUrl, tracker });
      const profRes = await session.get("/api/client/account/profile");
      assert.equal(profRes.status, 200);
      assert.equal(profRes.json?.user?.id, user.id);
      assert.equal(profRes.json?.user?.loyaltyPoints, 100);
      assert.equal(profRes.json?.user?.lifetimePoints, 100);
      assert.equal(profRes.json?.user?.memberTier, "BRONZE");
    },
  },
  {
    id: "T1-F9-04",
    feature: "F9",
    name: "Navigation components expose /account/travelers (Sổ hành khách) & loyalty badges",
    async run({ assert }) {
      const sidebarPath = path.join(
        process.cwd(),
        "src/components/client/AccountSidebar.tsx"
      );
      const headerPath = path.join(
        process.cwd(),
        "src/components/client/ClientHeader.tsx"
      );
      const sidebarSrc = fs.readFileSync(sidebarPath, "utf8");
      const headerSrc = fs.readFileSync(headerPath, "utf8");

      assert.includes(sidebarSrc, "/account/travelers");
      assert.includes(sidebarSrc, "Sổ hành khách");
      assert.includes(headerSrc, "/account/travelers");
      assert.includes(headerSrc, "loyaltyPoints");
    },
  },
  {
    id: "T1-F9-05",
    feature: "F9",
    name: "Core client pages (/, /tours, /account, /account/orders, /account/travelers) render 200",
    async run({ baseUrl, assert }) {
      const guest = createSession({ baseUrl, ip: freshIp() });
      for (const route of [
        "/",
        "/tours",
        "/account",
        "/account/orders",
        "/account/travelers",
      ]) {
        const res = await guest.get(route);
        assert.equal(res.status, 200, `Expected 200 for ${route}`);
        assert.doesNotMatch(
          res.text,
          /Application error|Internal Server Error/i
        );
      }
    },
  },

  // =========================================================================
  // F10: Checkout Perks & Auth Claim UI / Sandbox Flow (5 cases)
  // =========================================================================
  {
    id: "T1-F10-01",
    feature: "F10",
    name: "GET /cart SSR HTML renders cleanly without server errors",
    async run({ baseUrl, assert }) {
      const guest = createSession({ baseUrl, ip: freshIp() });
      const res = await guest.get("/cart");
      assert.equal(res.status, 200);
      assert.includes(res.headers.get("content-type") || "", "text/html");
      assert.doesNotMatch(res.text, /Application error|Internal Server Error/i);
    },
  },
  {
    id: "T1-F10-02",
    feature: "F10",
    name: "GET /login and /register accept ?claimToken= & ?next= cleanly",
    async run({ baseUrl, assert }) {
      const guest = createSession({ baseUrl, ip: freshIp() });
      for (const route of [
        "/login?claimToken=dummy.token&next=/account/orders",
        "/register?claimToken=dummy.token&next=/account/orders",
      ]) {
        const res = await guest.get(route);
        assert.equal(res.status, 200, `Expected 200 for ${route}`);
        assert.doesNotMatch(
          res.text,
          /Application error|Internal Server Error/i
        );
      }
    },
  },
  {
    id: "T1-F10-03",
    feature: "F10",
    name: "GET /api/client/orders/[code]/status returns payment/status summary",
    async run({ baseUrl, tracker, fixtures, assert }) {
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

      const statusRes = await session.get(
        `/api/client/orders/${order.code}/status`
      );
      assert.equal(statusRes.status, 200);
      assert.equal(statusRes.json?.order?.code, order.code);
      assert.equal(statusRes.json?.order?.paymentStatus, "UNPAID");
      assert.equal(typeof statusRes.json?.sandboxEnabled, "boolean");
    },
  },
  {
    id: "T1-F10-04",
    feature: "F10",
    name: "POST /api/client/orders/[code]/status sandbox payment awards ORDER_EARN",
    async run({ baseUrl, prisma, tracker, fixtures, assert, note }) {
      const { session, user, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });
      const orderRes = await session.createOrder(
        makeOrderPayload({
          fixture: fixtures.tenMTier,
          email,
          phone,
          paymentMethod: "MOMO",
        }),
        tracker
      );
      assert.equal(orderRes.status, 201);
      const order = orderRes.json.order;
      const expected = Math.floor(order.total / 100_000);

      const payRes = await session.post(
        `/api/client/orders/${order.code}/status`,
        {}
      );
      if (payRes.status === 200) {
        assert.equal(payRes.json?.ok, true);
        assert.equal(payRes.json?.outcome, "PAID_APPROVED");
        const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
        assert.equal(dbUser?.loyaltyPoints, 100 + expected);
        // Clean up sandbox PaymentWebhookLog if created by server
        const logs = await prisma.paymentWebhookLog.findMany({
          where: { orderCode: order.code },
          select: { eventId: true },
        });
        for (const l of logs) tracker.trackEventId(l.eventId);
      } else {
        assert.equal(payRes.status, 403);
        note("Payment sandbox disabled (production mode); verified 403 guard.");
      }
    },
  },
  {
    id: "T1-F10-05",
    feature: "F10",
    name: "GET /orders/[code]/voucher?phone=... renders 200 with order code",
    async run({ baseUrl, tracker, fixtures, assert }) {
      const { order, phone } = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.midTier,
      });
      const guest = createSession({ baseUrl, ip: freshIp() });
      const res = await guest.get(
        `/orders/${encodeURIComponent(order.code)}/voucher?phone=${encodeURIComponent(
          phone
        )}`
      );
      assert.equal(res.status, 200);
      assert.includes(res.text, order.code);
    },
  },
];
