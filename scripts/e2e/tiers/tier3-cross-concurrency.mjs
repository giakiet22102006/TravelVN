import { makeOrderPayload } from "../lib/fixtures.mjs";
import {
  adminUpdateOrder,
  createAdminSession,
  createGuestOrder,
  payOrderViaWebhook,
  registerFreshMember,
  triggerExpireOrdersCron,
} from "../lib/helpers.mjs";
import { createSession, freshIp, uniqueTag } from "../lib/http.mjs";

export const tier3Cases = [
  {
    id: "T3-01",
    feature: "F5, F6",
    name: "Concurrent point redemption race (Promise.all): 1 wins (201), 1 fails (409/400), never negative",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      const { session, user, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });

      const payload1 = makeOrderPayload({
        fixture: fixtures.tenMTier,
        email,
        phone,
        redeemPoints: 100,
      });
      const payload2 = makeOrderPayload({
        fixture: fixtures.tenMTier,
        email,
        phone,
        redeemPoints: 100,
      });

      const [r1, r2] = await Promise.all([
        session.createOrder(payload1, tracker),
        session.createOrder(payload2, tracker),
      ]);

      const statuses = [r1.status, r2.status].sort((a, b) => a - b);
      assert.equal(statuses[0], 201);
      assert.inSet(statuses[1], [400, 409]);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      assert.equal(dbUser?.loyaltyPoints, 0);

      const redeemTxs = await prisma.loyaltyTransaction.findMany({
        where: { userId: user.id, type: "ORDER_REDEEM" },
      });
      assert.equal(redeemTxs.length, 1);
      assert.equal(redeemTxs[0].points, -100);
    },
  },
  {
    id: "T3-02",
    feature: "F6",
    name: "Webhook replay idempotency for ORDER_EARN (same eventId + new eventId)",
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
      const expectedEarn = Math.floor(order.total / 100_000);

      const evt1 = uniqueTag("wh-idem-1");
      const w1 = await payOrderViaWebhook({
        baseUrl,
        tracker,
        order,
        eventId: evt1,
      });
      assert.equal(w1.res.status, 200);
      assert.equal(w1.res.json?.outcome, "PAID_APPROVED");

      // Replay exact same eventId
      const w2 = await payOrderViaWebhook({
        baseUrl,
        tracker,
        order,
        eventId: evt1,
      });
      assert.equal(w2.res.status, 200);
      assert.equal(w2.res.json?.duplicate, true);

      // New eventId on already-paid order
      const evt2 = uniqueTag("wh-idem-2");
      const w3 = await payOrderViaWebhook({
        baseUrl,
        tracker,
        order,
        eventId: evt2,
      });
      assert.equal(w3.res.status, 200);
      assert.equal(w3.res.json?.duplicate, true);
      assert.equal(w3.res.json?.outcome, "ALREADY_PAID");

      const earnTxs = await prisma.loyaltyTransaction.findMany({
        where: { userId: user.id, orderId: order.id, type: "ORDER_EARN" },
      });
      assert.equal(earnTxs.length, 1);
      assert.equal(earnTxs[0].points, expectedEarn);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      assert.equal(dbUser?.loyaltyPoints, 100 + expectedEarn);
      assert.equal(dbUser?.lifetimePoints, 100 + expectedEarn);
    },
  },
  {
    id: "T3-03",
    feature: "F5, F6",
    name: "Customer order cancel refunds pointsRedeemed idempotently on repeat cancel",
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
          redeemPoints: 80,
        }),
        tracker
      );
      assert.equal(orderRes.status, 201);
      const order = orderRes.json.order;

      let dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      assert.equal(dbUser?.loyaltyPoints, 20);

      const c1 = await session.patch(
        `/api/client/account/orders/${order.id}/cancel`
      );
      assert.equal(c1.status, 200);

      const c2 = await session.patch(
        `/api/client/account/orders/${order.id}/cancel`
      );
      assert.equal(c2.status, 400);

      dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      assert.equal(dbUser?.loyaltyPoints, 100);

      const refundTxs = await prisma.loyaltyTransaction.findMany({
        where: {
          userId: user.id,
          orderId: order.id,
          type: "ORDER_REDEEM_REFUND",
        },
      });
      assert.equal(refundTxs.length, 1);
      assert.equal(refundTxs[0].points, 80);
    },
  },
  {
    id: "T3-04",
    feature: "F5, F6",
    name: "15m TTL expiry (backdated expiresAt + cron) refunds pointsRedeemed & restores stock idempotently",
    async run({ baseUrl, prisma, tracker, assert }) {
      const eph = await tracker.createEphemeralTour({
        priceNewAdult: 10_000_000,
        stockAdult: 5,
      });
      const { session, user, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });

      const orderRes = await session.createOrder(
        makeOrderPayload({
          fixture: eph,
          email,
          phone,
          paymentMethod: "MOMO",
          redeemPoints: 60,
        }),
        tracker
      );
      assert.equal(orderRes.status, 201);
      const order = orderRes.json.order;

      await prisma.order.update({
        where: { id: order.id },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });

      const cron1 = await triggerExpireOrdersCron(baseUrl);
      assert.equal(cron1.status, 200);
      assert.ok(cron1.json?.released >= 1);

      const cron2 = await triggerExpireOrdersCron(baseUrl);
      assert.equal(cron2.status, 200);

      const dbOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      assert.equal(dbOrder?.status, "CANCELLED");
      assert.equal(dbOrder?.cancelReason, "HOLD_EXPIRED");

      const dbDep = await prisma.tourDeparture.findUnique({
        where: { id: eph.departure.id },
      });
      assert.equal(dbDep?.stockAdult, 5);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      assert.equal(dbUser?.loyaltyPoints, 100);

      const refundTxs = await prisma.loyaltyTransaction.findMany({
        where: {
          userId: user.id,
          orderId: order.id,
          type: "ORDER_REDEEM_REFUND",
        },
      });
      assert.equal(refundTxs.length, 1);
      assert.equal(refundTxs[0].points, 60);
    },
  },
  {
    id: "T3-05",
    feature: "F4, F6",
    name: "Claiming already-PAID & APPROVED guest order via quick-register and link awards ORDER_EARN once",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      // Variant A: quick-register
      const g1 = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.tenMTier,
        paymentMethod: "BANK_TRANSFER",
      });
      await payOrderViaWebhook({ baseUrl, tracker, order: g1.order });
      const expected1 = Math.floor(g1.order.total / 100_000);

      const qrSess = createSession({ baseUrl, ip: freshIp() });
      const qrRes = await qrSess.post("/api/client/orders/claim", {
        mode: "quick-register",
        claimToken: g1.claimToken,
        password: "Password@123",
      });
      assert.equal(qrRes.status, 201);
      tracker.trackUser(qrRes.json.user.id);
      assert.equal(qrRes.json.pointsAwarded, expected1);
      assert.equal(qrRes.json.user.loyaltyPoints, 100 + expected1);

      // Variant B: link by existing member
      const g2 = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.tenMTier,
        paymentMethod: "BANK_TRANSFER",
      });
      await payOrderViaWebhook({ baseUrl, tracker, order: g2.order });
      const expected2 = Math.floor(g2.order.total / 100_000);

      const member = await registerFreshMember({ baseUrl, tracker });
      const linkRes = await member.session.post("/api/client/orders/claim", {
        mode: "link",
        orderCode: g2.order.code,
        phone: g2.phone,
      });
      assert.equal(linkRes.status, 200);
      assert.equal(linkRes.json.pointsAwarded, expected2);
      assert.equal(linkRes.json.user.loyaltyPoints, 100 + expected2);

      // Replay webhook should NOT double credit
      await payOrderViaWebhook({ baseUrl, tracker, order: g2.order });
      const dbUser2 = await prisma.user.findUnique({
        where: { id: member.user.id },
      });
      assert.equal(dbUser2?.loyaltyPoints, 100 + expected2);
    },
  },
  {
    id: "T3-06",
    feature: "F5, F6",
    name: "LATE_PAID_REAPPROVED reconciliation after TTL expiry awards ORDER_EARN cleanly",
    async run({ baseUrl, prisma, tracker, assert }) {
      const eph = await tracker.createEphemeralTour({
        priceNewAdult: 10_000_000,
        stockAdult: 5,
      });
      const { session, user, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });

      const orderRes = await session.createOrder(
        makeOrderPayload({
          fixture: eph,
          email,
          phone,
          paymentMethod: "BANK_TRANSFER",
          redeemPoints: 50,
        }),
        tracker
      );
      assert.equal(orderRes.status, 201);
      const order = orderRes.json.order;
      assert.equal(order.total, 9_950_000);

      await prisma.order.update({
        where: { id: order.id },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });
      const cronRes = await triggerExpireOrdersCron(baseUrl);
      assert.equal(cronRes.status, 200);

      const { res: lateWh } = await payOrderViaWebhook({
        baseUrl,
        tracker,
        order,
      });
      assert.equal(lateWh.status, 200);
      assert.equal(lateWh.json?.outcome, "LATE_PAID_REAPPROVED");

      const dbOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      assert.equal(dbOrder?.status, "APPROVED");
      assert.equal(dbOrder?.paymentStatus, "PAID");
      assert.equal(dbOrder?.pointsEarned, 99);

      const earnTxs = await prisma.loyaltyTransaction.findMany({
        where: { userId: user.id, orderId: order.id, type: "ORDER_EARN" },
      });
      assert.equal(earnTxs.length, 1);
      assert.equal(earnTxs[0].points, 99);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      assert.ok(dbUser.loyaltyPoints >= 0);
      assert.equal(dbUser.lifetimePoints, 199);
    },
  },
  {
    id: "T3-07",
    feature: "F6",
    name: "REFUNDED order revokes pointsEarned and clamps loyaltyPoints & lifetimePoints >= 0",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      const { session, user, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });
      // Place 10M order and pay -> +100 pts (total 200)
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
      const earned = Math.floor(o1.total / 100_000);
      await payOrderViaWebhook({ baseUrl, tracker, order: o1 });

      // Spend 190 pts on 2nd order so balance is only 10 (100 + earned - 190)
      const o2Res = await session.createOrder(
        makeOrderPayload({
          fixture: fixtures.tenMTier,
          email,
          phone,
          redeemPoints: 190,
        }),
        tracker
      );
      assert.equal(o2Res.status, 201);

      const adminSession = await createAdminSession(baseUrl);
      const r1 = await adminUpdateOrder(adminSession, o1, {
        paymentMethod: "BANK_TRANSFER",
        paymentStatus: "PAID",
        status: "CANCELLED",
        refundStatus: "REFUNDED",
      });
      assert.equal(r1.status, 200);

      // Repeat PUT REFUNDED must be idempotent
      const r2 = await adminUpdateOrder(adminSession, o1, {
        paymentMethod: "BANK_TRANSFER",
        paymentStatus: "PAID",
        status: "CANCELLED",
        refundStatus: "REFUNDED",
      });
      assert.equal(r2.status, 200);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      assert.equal(dbUser?.loyaltyPoints, 0);
      assert.ok(dbUser.lifetimePoints >= 0);

      const revokeTxs = await prisma.loyaltyTransaction.findMany({
        where: {
          userId: user.id,
          orderId: o1.id,
          type: "ORDER_REFUND_REVOKE",
        },
      });
      assert.equal(revokeTxs.length, 1);
      assert.equal(revokeTxs[0].points, -earned);
    },
  },
  {
    id: "T3-08",
    feature: "F3, F6",
    name: "Google OAuth auto-claim mixed guest orders (unpaid + paid) credits only paid order points",
    async run({ baseUrl, prisma, tracker, fixtures, assert, note }) {
      const probe = createSession({ baseUrl, ip: freshIp() });
      const check = await probe.get("/api/client/auth/oauth/google?check=1");
      if (check.status !== 200 || check.json?.mode !== "sandbox") {
        assert.equal(check.status, 403);
        const postBlocked = await probe.post("/api/client/auth/oauth/google", {
          email: "mix@test.travelvn.local",
          fullName: "Mix User",
        });
        assert.equal(postBlocked.status, 403);
        note(
          "OAuth sandbox disabled on server; verified 403 guard (start server with ENABLE_OAUTH_SANDBOX=true to run live OAuth mixed-order auto-claim)."
        );
        return;
      }

      const mixEmail = `Mix.OAuth.${uniqueTag("m")}@Test.TravelVN.local`;
      const o1 = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.midTier,
        email: mixEmail,
        paymentMethod: "CASH",
      });
      const o2 = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.tenMTier,
        email: mixEmail.toLowerCase(),
        paymentMethod: "BANK_TRANSFER",
      });
      await payOrderViaWebhook({ baseUrl, tracker, order: o2.order });
      const expectedEarn = Math.floor(o2.order.total / 100_000);

      const oauthSession = createSession({ baseUrl, ip: freshIp() });
      const oauthRes = await oauthSession.post("/api/client/auth/oauth/google", {
        email: mixEmail.toLowerCase(),
        fullName: "Mix OAuth User",
        providerId: `google-${uniqueTag("mix")}`,
      });
      assert.equal(oauthRes.status, 200);
      const userId = oauthRes.json.user.id;
      tracker.trackUser(userId);
      assert.equal(oauthRes.json.user.loyaltyPoints, 100 + expectedEarn);

      const dbO1 = await prisma.order.findUnique({ where: { id: o1.order.id } });
      const dbO2 = await prisma.order.findUnique({ where: { id: o2.order.id } });
      assert.equal(dbO1?.userId, userId);
      assert.equal(dbO2?.userId, userId);
      assert.equal(dbO1?.pointsEarned, 0);
      assert.equal(dbO2?.pointsEarned, expectedEarn);
    },
  },
  {
    id: "T3-09",
    feature: "F4",
    name: "Concurrent manual claim race (Promise.all): 1 returns 200, 1 returns 409",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      const userA = await registerFreshMember({ baseUrl, tracker });
      const userB = await registerFreshMember({ baseUrl, tracker });
      const { order, phone } = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.tenMTier,
        paymentMethod: "BANK_TRANSFER",
      });
      await payOrderViaWebhook({ baseUrl, tracker, order });

      const [resA, resB] = await Promise.all([
        userA.session.post("/api/client/orders/claim", {
          mode: "link",
          orderCode: order.code,
          phone,
        }),
        userB.session.post("/api/client/orders/claim", {
          mode: "link",
          orderCode: order.code,
          phone,
        }),
      ]);

      const statuses = [resA.status, resB.status].sort((a, b) => a - b);
      assert.deepEqual(statuses, [200, 409]);

      const dbOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      assert.ok(
        dbOrder.userId === userA.user.id || dbOrder.userId === userB.user.id
      );
      const earnCount = await prisma.loyaltyTransaction.count({
        where: { orderId: order.id, type: "ORDER_EARN" },
      });
      assert.equal(earnCount, 1);
    },
  },
  {
    id: "T3-10",
    feature: "F5, F6, F8",
    name: "End-to-end VIP500 unlock via paid order / tier upgrade & loyalty endpoint sync",
    async run({ baseUrl, tracker, fixtures, assert }) {
      const { session, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });
      const qty8M = fixtures.vipTier.unitAdult >= 8_000_000 ? 1 : 2;

      const blocked = await session.createOrder(
        makeOrderPayload({
          fixture: fixtures.vipTier,
          quantityAdult: qty8M,
          email,
          phone,
          couponCode: "VIP500",
        }),
        tracker
      );
      assert.inSet(blocked.status, [400, 403]);

      const qualifier = await session.createOrder(
        makeOrderPayload({
          fixture: fixtures.tenMTier,
          email,
          phone,
          paymentMethod: "BANK_TRANSFER",
        }),
        tracker
      );
      assert.equal(qualifier.status, 201);
      await payOrderViaWebhook({
        baseUrl,
        tracker,
        order: qualifier.json.order,
      });

      const loyalty = await session.get("/api/client/account/loyalty");
      assert.equal(loyalty.status, 200);
      assert.equal(loyalty.json.paidOrderCount, 1);
      const vipCard = loyalty.json.coupons.find((c) => c.code === "VIP500");
      assert.equal(vipCard?.eligibility?.eligible, true);

      const unlocked = await session.createOrder(
        makeOrderPayload({
          fixture: fixtures.vipTier,
          quantityAdult: qty8M,
          email,
          phone,
          couponCode: "VIP500",
        }),
        tracker
      );
      assert.equal(unlocked.status, 201);
      assert.equal(unlocked.json.order.discount, 500_000);
    },
  },
  {
    id: "T3-11",
    feature: "F3, F4, F5, F7",
    name: "Cross-feature flow: Guest order -> quick-register -> THANHVIEN200 + redeem + saveTravelers + webhook",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      const g1 = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.midTier,
      });
      const qrSess = createSession({ baseUrl, ip: freshIp() });
      const qrRes = await qrSess.post("/api/client/orders/claim", {
        mode: "quick-register",
        claimToken: g1.claimToken,
        password: "Password@123",
      });
      assert.equal(qrRes.status, 201);
      const user = qrRes.json.user;
      tracker.trackUser(user.id);

      const eph10M = await tracker.createEphemeralTour({
        priceNewAdult: 10_000_000,
      });
      const o2Res = await qrSess.createOrder(
        makeOrderPayload({
          fixture: eph10M,
          email: user.email,
          phone: g1.phone,
          couponCode: "THANHVIEN200",
          redeemPoints: 100,
          saveTravelers: true,
          paymentMethod: "BANK_TRANSFER",
          passengers: [
            {
              fullName: "Nguyễn Gia Hân",
              gender: "FEMALE",
              birthDate: "1996-04-12",
              tier: "ADULT",
              documentNumber: "079096005555",
            },
          ],
        }),
        tracker
      );
      assert.equal(o2Res.status, 201);
      const o2 = o2Res.json.order;
      assert.equal(o2.discount, 200_000);
      assert.equal(o2.pointsDiscount, 100_000);
      assert.equal(o2.total, 9_700_000);

      await payOrderViaWebhook({ baseUrl, tracker, order: o2 });

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      assert.equal(dbUser?.loyaltyPoints, 97);
      assert.equal(dbUser?.lifetimePoints, 197);

      const saved = await prisma.savedTraveler.findMany({
        where: { userId: user.id },
      });
      assert.equal(saved.length, 1);
      assert.equal(saved[0].fullName, "Nguyễn Gia Hân");
    },
  },
  {
    id: "T3-12",
    feature: "F5, F6",
    name: "LATE_PAID_REFUND_REQUIRED when stock exhausted does NOT award ORDER_EARN",
    async run({ baseUrl, prisma, tracker, assert }) {
      const eph = await tracker.createEphemeralTour({
        priceNewAdult: 10_000_000,
        stockAdult: 1,
        stockChild: 0,
        stockBaby: 0,
      });
      const { session, user, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });

      const o1Res = await session.createOrder(
        makeOrderPayload({
          fixture: eph,
          email,
          phone,
          paymentMethod: "MOMO",
          redeemPoints: 50,
        }),
        tracker
      );
      assert.equal(o1Res.status, 201);
      const o1 = o1Res.json.order;

      await prisma.order.update({
        where: { id: o1.id },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });
      await triggerExpireOrdersCron(baseUrl);

      // Guest consumes the last seat
      await createGuestOrder({
        baseUrl,
        tracker,
        fixture: eph,
      });

      const { res: lateWh } = await payOrderViaWebhook({
        baseUrl,
        tracker,
        order: o1,
      });
      assert.equal(lateWh.status, 200);
      assert.equal(lateWh.json?.outcome, "LATE_PAID_REFUND_REQUIRED");

      const dbO1 = await prisma.order.findUnique({ where: { id: o1.id } });
      assert.equal(dbO1?.status, "CANCELLED");
      assert.equal(dbO1?.paymentStatus, "PAID");
      assert.equal(dbO1?.refundStatus, "REFUND_REQUIRED");
      assert.equal(dbO1?.pointsEarned, 0);

      const earnCount = await prisma.loyaltyTransaction.count({
        where: { userId: user.id, orderId: o1.id, type: "ORDER_EARN" },
      });
      assert.equal(earnCount, 0);
    },
  },
];
