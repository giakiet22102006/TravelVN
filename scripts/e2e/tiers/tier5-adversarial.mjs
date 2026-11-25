import { makeOrderPayload } from "../lib/fixtures.mjs";
import {
  adminUpdateOrder,
  createAdminSession,
  createGuestOrder,
  payOrderViaWebhook,
  registerFreshMember,
  triggerExpireOrdersCron,
} from "../lib/helpers.mjs";
import { createSession, freshIp, uniqueEmail, uniqueTag } from "../lib/http.mjs";

export const tier5Cases = [
  {
    id: "T5-01",
    feature: "F4, Security",
    name: "Order claim rate limit (5 / 10m) cannot be bypassed by rotating X-Forwarded-For",
    async run({ baseUrl, tracker, fixtures, assert }) {
      const { session } = await registerFreshMember({ baseUrl, tracker });
      const { order, phone } = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.midTier,
      });

      for (let i = 1; i <= 5; i++) {
        const res = await session.post(
          "/api/client/orders/claim",
          {
            mode: "link",
            orderCode: order.code,
            phone: "0999999999",
          },
          { ip: `10.88.1.${i}` }
        );
        assert.equal(res.status, 403);
      }

      const sixth = await session.post(
        "/api/client/orders/claim",
        {
          mode: "link",
          orderCode: order.code,
          phone,
        },
        { ip: "10.88.1.99" }
      );
      assert.equal(sixth.status, 429);
      assert.ok(Number(sixth.headers.get("retry-after")) >= 1);
    },
  },
  {
    id: "T5-02",
    feature: "F5, F7, Concurrency",
    name: "Concurrent saveTravelers on checkout + POST /travelers never exceeds 20-traveler cap",
    async run({ baseUrl, prisma, tracker, assert }) {
      for (const delayMs of [0, 350, 500, 650]) {
        const { session, user, email, phone } = await registerFreshMember({
          baseUrl,
          tracker,
        });
        await prisma.savedTraveler.createMany({
          data: Array.from({ length: 19 }, (_, i) => ({
            userId: user.id,
            fullName: `Seed Cap ${i + 1}`,
            gender: "MALE",
            birthDate: "1990-01-01",
            defaultTier: "ADULT",
          })),
        });

        const eph = await tracker.createEphemeralTour({ stockAdult: 5 });
        const orderPromise = session.request("POST", "/api/client/orders", {
          ip: freshIp(),
          body: makeOrderPayload({
            fixture: eph,
            quantityAdult: 2,
            email,
            phone,
            saveTravelers: true,
            passengers: [
              {
                fullName: "Order Pax A",
                gender: "MALE",
                birthDate: "1991-01-01",
                tier: "ADULT",
              },
              {
                fullName: "Order Pax B",
                gender: "FEMALE",
                birthDate: "1992-02-02",
                tier: "ADULT",
              },
            ],
          }),
        });

        if (delayMs > 0) {
          await new Promise((r) => setTimeout(r, delayMs));
        }

        const travPromise = session.post("/api/client/account/travelers", {
          fullName: "API Pax 1",
          gender: "MALE",
          birthDate: "1993-03-03",
          defaultTier: "ADULT",
        });

        const [orderRes, travRes] = await Promise.all([
          orderPromise,
          travPromise,
        ]);
        if (orderRes.json?.order) tracker.trackOrder(orderRes.json.order);
        assert.equal(orderRes.status, 201);
        assert.inSet(travRes.status, [201, 400]);

        const count = await prisma.savedTraveler.count({
          where: { userId: user.id },
        });
        assert.equal(count, 20);
      }
    },
  },
  {
    id: "T5-03",
    feature: "F7, Concurrency",
    name: "Concurrent POST /api/client/account/travelers enforces cap=20 and deduplication",
    async run({ baseUrl, prisma, tracker, assert }) {
      const { session, user } = await registerFreshMember({ baseUrl, tracker });
      await prisma.savedTraveler.createMany({
        data: Array.from({ length: 19 }, (_, i) => ({
          userId: user.id,
          fullName: `Cap ${i + 1}`,
          gender: "MALE",
          birthDate: "1990-01-01",
          defaultTier: "ADULT",
        })),
      });

      const [a, b, c] = await Promise.all([
        session.post("/api/client/account/travelers", {
          fullName: "Race Traveler 1",
          gender: "MALE",
          birthDate: "1991-05-05",
          defaultTier: "ADULT",
        }),
        session.post("/api/client/account/travelers", {
          fullName: "Race Traveler 2",
          gender: "FEMALE",
          birthDate: "1992-06-06",
          defaultTier: "ADULT",
        }),
        session.post("/api/client/account/travelers", {
          fullName: "Race Traveler 1",
          gender: "MALE",
          birthDate: "1991-05-05",
          defaultTier: "ADULT",
        }),
      ]);

      const successes = [a, b, c].filter((r) => r.status === 201);
      assert.equal(successes.length, 1);

      const count = await prisma.savedTraveler.count({
        where: { userId: user.id },
      });
      assert.equal(count, 20);
    },
  },
  {
    id: "T5-04",
    feature: "F3, Concurrency",
    name: "Concurrent first-time Google OAuth login does not throw 500 or duplicate WELCOME_BONUS",
    async run({ baseUrl, prisma, tracker, fixtures, assert, note }) {
      const probe = createSession({ baseUrl, ip: freshIp() });
      const check = await probe.get("/api/client/auth/oauth/google?check=1");
      if (check.status !== 200 || check.json?.mode !== "sandbox") {
        assert.equal(check.status, 403);
        note(
          "OAuth sandbox disabled on server; skipped live concurrent OAuth race."
        );
        return;
      }

      const email = uniqueEmail("oauth-race");
      const providerId = `google-${uniqueTag("race")}`;
      const { order } = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.tenMTier,
        email,
        paymentMethod: "BANK_TRANSFER",
      });
      await payOrderViaWebhook({ baseUrl, tracker, order });
      const expectedEarn = Math.floor(order.total / 100_000);

      const s1 = createSession({ baseUrl, ip: freshIp() });
      const s2 = createSession({ baseUrl, ip: freshIp() });
      const [r1, r2] = await Promise.all([
        s1.post("/api/client/auth/oauth/google", {
          email,
          fullName: "Race OAuth User",
          providerId,
        }),
        s2.post("/api/client/auth/oauth/google", {
          email,
          fullName: "Race OAuth User",
          providerId,
        }),
      ]);

      assert.equal(r1.status, 200);
      assert.equal(r2.status, 200);
      const userId = r1.json?.user?.id || r2.json?.user?.id;
      assert.ok(userId);
      tracker.trackUser(userId);
      assert.equal(r1.json.user.id, r2.json.user.id);

      const dbUser = await prisma.user.findUnique({ where: { id: userId } });
      assert.equal(dbUser?.loyaltyPoints, 100 + expectedEarn);
      const bonusCount = await prisma.loyaltyTransaction.count({
        where: { userId, type: "WELCOME_BONUS" },
      });
      assert.equal(bonusCount, 1);
    },
  },
  {
    id: "T5-05",
    feature: "F6, Concurrency",
    name: "Concurrent Admin PUT cancel on same order never double-restores tour stock",
    async run({ baseUrl, prisma, tracker, assert }) {
      const eph = await tracker.createEphemeralTour({ stockAdult: 5 });
      const { order } = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: eph,
        quantityAdult: 2,
      });

      const adminSession = await createAdminSession(baseUrl);
      const [c1, c2] = await Promise.all([
        adminUpdateOrder(adminSession, order, { status: "CANCELLED" }),
        adminUpdateOrder(adminSession, order, { status: "CANCELLED" }),
      ]);
      assert.equal(c1.status, 200);
      assert.equal(c2.status, 200);

      const dbDep = await prisma.tourDeparture.findUnique({
        where: { id: eph.departure.id },
      });
      assert.equal(dbDep?.stockAdult, 5);
    },
  },
  {
    id: "T5-06",
    feature: "F4, Concurrency",
    name: "Concurrent quick-register + quick-register and quick-register + link races are atomic",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      // Case A: quick-register + quick-register
      const g1 = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.midTier,
      });
      const [qr1, qr2] = await Promise.all([
        createSession({ baseUrl, ip: freshIp() }).post(
          "/api/client/orders/claim",
          {
            mode: "quick-register",
            claimToken: g1.claimToken,
            password: "Password@123",
          }
        ),
        createSession({ baseUrl, ip: freshIp() }).post(
          "/api/client/orders/claim",
          {
            mode: "quick-register",
            claimToken: g1.claimToken,
            password: "Password@123",
          }
        ),
      ]);
      if (qr1.json?.user?.id) tracker.trackUser(qr1.json.user.id);
      if (qr2.json?.user?.id) tracker.trackUser(qr2.json.user.id);
      assert.deepEqual([qr1.status, qr2.status].sort((a, b) => a - b), [201, 409]);

      // Case B: quick-register vs link by another member -> zero orphan user on rollback
      const g2 = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.midTier,
      });
      const member = await registerFreshMember({ baseUrl, tracker });
      const [qrB, linkB] = await Promise.all([
        createSession({ baseUrl, ip: freshIp() }).post(
          "/api/client/orders/claim",
          {
            mode: "quick-register",
            claimToken: g2.claimToken,
            password: "Password@123",
          }
        ),
        member.session.post("/api/client/orders/claim", {
          mode: "link",
          orderCode: g2.order.code,
          phone: g2.phone,
        }),
      ]);
      if (qrB.json?.user?.id) tracker.trackUser(qrB.json.user.id);

      if (linkB.status === 200) {
        assert.equal(qrB.status, 409);
        const orphan = await prisma.user.findUnique({
          where: { email: g2.email.toLowerCase() },
        });
        if (orphan) tracker.trackUser(orphan.id);
        assert.equal(orphan, null);
      } else {
        assert.equal(qrB.status, 201);
        assert.equal(linkB.status, 409);
      }
    },
  },
  {
    id: "T5-07",
    feature: "F3, Security",
    name: "Google OAuth emailVerified=false never auto-claims matching guest orders",
    async run({ baseUrl, prisma, tracker, fixtures, assert, note }) {
      const probe = createSession({ baseUrl, ip: freshIp() });
      const check = await probe.get("/api/client/auth/oauth/google?check=1");
      if (check.status !== 200 || check.json?.mode !== "sandbox") {
        assert.equal(check.status, 403);
        note("OAuth sandbox disabled on server; skipped emailVerified=false probe.");
        return;
      }

      const guestEmail = uniqueEmail("unverified-oauth");
      const { order } = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.midTier,
        email: guestEmail,
      });

      const oauthRes = await probe.post("/api/client/auth/oauth/google", {
        email: guestEmail,
        fullName: "Unverified Google",
        providerId: `google-${uniqueTag("unv")}`,
        emailVerified: false,
      });
      assert.equal(oauthRes.status, 200);
      tracker.trackUser(oauthRes.json?.user?.id);
      assert.equal(oauthRes.json?.claimedOrderCount, 0);

      const dbOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      assert.equal(dbOrder?.userId, null);
    },
  },
  {
    id: "T5-08",
    feature: "F5",
    name: "VIP500 rejects UNPAID/CANCELLED/REFUNDED orders and enforces exact 2M & 8M boundaries + coupon normalization",
    async run({ baseUrl, prisma, tracker, assert }) {
      const { session, user, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });
      const tour1999 = await tracker.createEphemeralTour({
        priceNewAdult: 1_999_999,
      });
      const tour2M = await tracker.createEphemeralTour({
        priceNewAdult: 2_000_000,
      });
      const tour7999 = await tracker.createEphemeralTour({
        priceNewAdult: 7_999_999,
      });
      const tour8M = await tracker.createEphemeralTour({
        priceNewAdult: 8_000_000,
      });

      // 1. INITIAL UNPAID + CANCELLED orders do not unlock VIP500
      const unpaid = await session.request("POST", "/api/client/orders", {
        ip: freshIp(),
        body: makeOrderPayload({ fixture: tour2M, email, phone }),
      });
      assert.equal(unpaid.status, 201);
      tracker.trackOrder(unpaid.json.order);

      const cancelled = await session.request("POST", "/api/client/orders", {
        ip: freshIp(),
        body: makeOrderPayload({ fixture: tour2M, email, phone }),
      });
      assert.equal(cancelled.status, 201);
      tracker.trackOrder(cancelled.json.order);
      const cancelRes = await session.patch(
        `/api/client/account/orders/${cancelled.json.order.id}/cancel`
      );
      assert.equal(cancelRes.status, 200);

      // 2. PAID then REFUNDED order does not unlock VIP500
      const refunded = await session.request("POST", "/api/client/orders", {
        ip: freshIp(),
        body: makeOrderPayload({
          fixture: tour2M,
          email,
          phone,
          paymentMethod: "BANK_TRANSFER",
        }),
      });
      assert.equal(refunded.status, 201);
      tracker.trackOrder(refunded.json.order);
      await payOrderViaWebhook({ baseUrl, tracker, order: refunded.json.order });
      const adminSession = await createAdminSession(baseUrl);
      const refundAdminRes = await adminUpdateOrder(
        adminSession,
        refunded.json.order,
        {
          paymentMethod: "BANK_TRANSFER",
          paymentStatus: "PAID",
          status: "CANCELLED",
          refundStatus: "REFUNDED",
        }
      );
      assert.equal(refundAdminRes.status, 200);

      const vipBlocked = await session.request("POST", "/api/client/orders", {
        ip: freshIp(),
        body: makeOrderPayload({
          fixture: tour8M,
          email,
          phone,
          couponCode: "VIP500",
        }),
      });
      assert.equal(vipBlocked.status, 403);

      // 3. Exact THANHVIEN200 boundary (1,999,999 vs 2,000,000) + lowercase/spaces
      const tvUnder = await session.request("POST", "/api/client/orders", {
        ip: freshIp(),
        body: makeOrderPayload({
          fixture: tour1999,
          email,
          phone,
          couponCode: "  thanhvien200  ",
        }),
      });
      assert.equal(tvUnder.status, 400);

      const tvExact = await session.request("POST", "/api/client/orders", {
        ip: freshIp(),
        body: makeOrderPayload({
          fixture: tour2M,
          email,
          phone,
          couponCode: "  thanhvien200  ",
        }),
      });
      assert.equal(tvExact.status, 201);
      tracker.trackOrder(tvExact.json.order);
      assert.equal(tvExact.json.order.couponCode, "THANHVIEN200");
      assert.equal(tvExact.json.order.discount, 200_000);

      // 4. Exact VIP500 boundary (7,999,999 vs 8,000,000) for SILVER
      await prisma.user.update({
        where: { id: user.id },
        data: { lifetimePoints: 500 },
      });
      const vipUnder = await session.request("POST", "/api/client/orders", {
        ip: freshIp(),
        body: makeOrderPayload({
          fixture: tour7999,
          email,
          phone,
          couponCode: "  vip500 ",
        }),
      });
      assert.equal(vipUnder.status, 400);

      const vipExact = await session.request("POST", "/api/client/orders", {
        ip: freshIp(),
        body: makeOrderPayload({
          fixture: tour8M,
          email,
          phone,
          couponCode: "  vip500 ",
        }),
      });
      assert.equal(vipExact.status, 201);
      tracker.trackOrder(vipExact.json.order);
      assert.equal(vipExact.json.order.couponCode, "VIP500");
      assert.equal(vipExact.json.order.discount, 500_000);
    },
  },
  {
    id: "T5-09",
    feature: "F5, F7, Security",
    name: "IDOR on cancel/status, malformed order JSON/redeemPoints, and saveTravelers validation parity",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      const userA = await registerFreshMember({ baseUrl, tracker });
      const userB = await registerFreshMember({ baseUrl, tracker });

      const oA = await userA.session.createOrder(
        makeOrderPayload({
          fixture: fixtures.midTier,
          email: userA.email,
          phone: userA.phone,
        }),
        tracker
      );
      assert.equal(oA.status, 201);

      // Cross-user IDOR on cancel & status
      const idorCancel = await userB.session.patch(
        `/api/client/account/orders/${oA.json.order.id}/cancel`
      );
      assert.equal(idorCancel.status, 403);

      const idorStatus = await userB.session.get(
        `/api/client/orders/${oA.json.order.code}/status`
      );
      assert.equal(idorStatus.status, 403);

      // Malformed JSON / null body / invalid redeemPoints types -> 400 (never 500)
      for (const rawBody of ["null", "[]", "{bad-json"]) {
        const res = await userA.session.postRaw("/api/client/orders", rawBody, {
          ip: freshIp(),
        });
        assert.equal(res.status, 400);
      }

      const adminSession = await createAdminSession(baseUrl);
      const oauthProbe = createSession({ baseUrl, ip: freshIp() });
      const oauthCheck = await oauthProbe.get(
        "/api/client/auth/oauth/google?check=1"
      );
      const oauthSandboxEnabled =
        oauthCheck.status === 200 && oauthCheck.json?.mode === "sandbox";

      for (const rawBody of ["null", "[]", "{bad-json"]) {
        const regRes = await createSession({ baseUrl, ip: freshIp() }).postRaw(
          "/api/client/auth/register",
          rawBody
        );
        assert.equal(regRes.status, 400);

        const loginRes = await createSession({
          baseUrl,
          ip: freshIp(),
        }).postRaw("/api/client/auth/login", rawBody);
        assert.equal(loginRes.status, 400);

        const profRes = await userA.session.request(
          "PUT",
          "/api/client/account/profile",
          { rawBody, ip: freshIp() }
        );
        assert.equal(profRes.status, 400);

        const adminPutRes = await adminSession.request(
          "PUT",
          `/api/admin/orders/${oA.json.order.id}`,
          { rawBody, ip: freshIp() }
        );
        assert.equal(adminPutRes.status, 400);

        const oauthRes = await createSession({
          baseUrl,
          ip: freshIp(),
        }).postRaw("/api/client/auth/oauth/google", rawBody);
        assert.equal(oauthRes.status, oauthSandboxEnabled ? 400 : 403);
      }

      for (const badRedeem of ["100", true, {}, 10.5, -1]) {
        const res = await userA.session.request("POST", "/api/client/orders", {
          ip: freshIp(),
          body: makeOrderPayload({
            fixture: fixtures.midTier,
            email: userA.email,
            phone: userA.phone,
            redeemPoints: badRedeem,
          }),
        });
        assert.equal(res.status, 400);
      }

      // saveTravelers must reject invalid birthDate (400) and normalize whitespace/documentNumber <= 30
      const eph = await tracker.createEphemeralTour({ stockAdult: 5 });
      const saveBadDate = await userA.session.request(
        "POST",
        "/api/client/orders",
        {
          ip: freshIp(),
          body: makeOrderPayload({
            fixture: eph,
            email: userA.email,
            phone: userA.phone,
            saveTravelers: true,
            passengers: [
              {
                fullName: "Test   BadDate",
                gender: "MALE",
                birthDate: "9999-99-99",
                tier: "ADULT",
              },
            ],
          }),
        }
      );
      if (saveBadDate.json?.order) tracker.trackOrder(saveBadDate.json.order);
      assert.equal(saveBadDate.status, 400);

      const saveNormPax = await userA.session.request(
        "POST",
        "/api/client/orders",
        {
          ip: freshIp(),
          body: makeOrderPayload({
            fixture: eph,
            email: userA.email,
            phone: userA.phone,
            saveTravelers: true,
            passengers: [
              {
                fullName: "Test   Space",
                gender: "MALE",
                birthDate: "1992-03-15",
                tier: "ADULT",
                documentNumber: "D".repeat(45),
              },
            ],
          }),
        }
      );
      assert.equal(saveNormPax.status, 201);
      tracker.trackOrder(saveNormPax.json.order);

      const saved = await prisma.savedTraveler.findMany({
        where: { userId: userA.user.id },
      });
      assert.equal(saved.length, 1);
      assert.equal(saved[0].fullName, "Test Space");
      assert.equal(saved[0].documentNumber?.length, 30);

      for (const row of saved) {
        const putRes = await userA.session.put(
          `/api/client/account/travelers/${row.id}`,
          {
            fullName: row.fullName,
            gender: row.gender,
            birthDate: row.birthDate,
            defaultTier: row.defaultTier,
            documentNumber: row.documentNumber,
            relationship: "Gia đình",
          }
        );
        assert.equal(putRes.status, 200);
      }
    },
  },
  {
    id: "T5-10",
    feature: "F6, Concurrency",
    name: "Concurrent distinct-eventId webhooks on expired order re-reserve stock once (no double deduction)",
    async run({ baseUrl, prisma, tracker, assert }) {
      const eph = await tracker.createEphemeralTour({
        priceNewAdult: 10_000_000,
        stockAdult: 5,
      });
      const { session, user, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });

      const redeemed = 50;
      const orderRes = await session.createOrder(
        makeOrderPayload({
          fixture: eph,
          quantityAdult: 2,
          email,
          phone,
          paymentMethod: "BANK_TRANSFER",
          redeemPoints: redeemed,
        }),
        tracker
      );
      assert.equal(orderRes.status, 201);
      const order = orderRes.json.order;
      const earned = Math.floor(order.total / 100_000);

      await prisma.order.update({
        where: { id: order.id },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });
      const cronRes = await triggerExpireOrdersCron(baseUrl);
      assert.equal(cronRes.status, 200);

      const [w1, w2] = await Promise.all([
        payOrderViaWebhook({
          baseUrl,
          tracker,
          order,
          eventId: uniqueTag("t510-a"),
        }),
        payOrderViaWebhook({
          baseUrl,
          tracker,
          order,
          eventId: uniqueTag("t510-b"),
        }),
      ]);

      assert.equal(w1.res.status, 200);
      assert.equal(w2.res.status, 200);
      const outcomes = [w1.res.json?.outcome, w2.res.json?.outcome].sort();
      assert.deepEqual(outcomes, ["ALREADY_PAID", "LATE_PAID_REAPPROVED"]);

      const [dbDep, dbOrder, dbUser, earnCount, refundCount] =
        await Promise.all([
          prisma.tourDeparture.findUnique({
            where: { id: eph.departure.id },
          }),
          prisma.order.findUnique({ where: { id: order.id } }),
          prisma.user.findUnique({ where: { id: user.id } }),
          prisma.loyaltyTransaction.count({
            where: { userId: user.id, orderId: order.id, type: "ORDER_EARN" },
          }),
          prisma.loyaltyTransaction.count({
            where: {
              userId: user.id,
              orderId: order.id,
              type: "ORDER_REDEEM_REFUND",
            },
          }),
        ]);

      assert.equal(dbOrder?.status, "APPROVED");
      assert.equal(dbOrder?.paymentStatus, "PAID");
      assert.equal(dbDep?.stockAdult, 3);
      assert.equal(earnCount, 1);
      assert.equal(refundCount, 0);
      assert.equal(dbUser?.loyaltyPoints, 100 - redeemed + earned);
    },
  },
  {
    id: "T5-11",
    feature: "F6, Concurrency",
    name: "Concurrent webhook vs customer cancel and webhook vs admin cancel preserve stock & loyalty invariants",
    async run({ baseUrl, prisma, tracker, assert }) {
      const adminSession = await createAdminSession(baseUrl);
      const redeemed = 50;

      async function assertStateInvariant({
        orderId,
        userId,
        departureId,
        earned,
      }) {
        const [dbOrder, dbDep, dbUser, earnTxCount, refundTxCount, revokeTxCount] =
          await Promise.all([
            prisma.order.findUnique({ where: { id: orderId } }),
            prisma.tourDeparture.findUnique({ where: { id: departureId } }),
            prisma.user.findUnique({ where: { id: userId } }),
            prisma.loyaltyTransaction.count({
              where: { userId, orderId, type: "ORDER_EARN" },
            }),
            prisma.loyaltyTransaction.count({
              where: { userId, orderId, type: "ORDER_REDEEM_REFUND" },
            }),
            prisma.loyaltyTransaction.count({
              where: { userId, orderId, type: "ORDER_REFUND_REVOKE" },
            }),
          ]);

        assert.ok(dbOrder);
        assert.ok(dbDep);
        assert.ok(dbUser);
        assert.notEqual(dbUser.loyaltyPoints, 100 + earned);

        if (
          dbOrder.status === "APPROVED" &&
          dbOrder.paymentStatus === "PAID"
        ) {
          assert.equal(dbDep.stockAdult, 3);
          assert.equal(refundTxCount, 0);
          assert.equal(earnTxCount, 1);
          assert.equal(revokeTxCount, 0);
          assert.equal(dbUser.loyaltyPoints, 100 - redeemed + earned);
        } else if (
          dbOrder.status === "CANCELLED" &&
          dbOrder.paymentStatus === "UNPAID"
        ) {
          assert.equal(dbDep.stockAdult, 5);
          assert.equal(earnTxCount, 0);
          assert.equal(refundTxCount, 1);
          assert.equal(revokeTxCount, 0);
          assert.equal(dbUser.loyaltyPoints, 100);
        } else if (
          dbOrder.status === "CANCELLED" &&
          dbOrder.paymentStatus === "PAID"
        ) {
          assert.equal(dbDep.stockAdult, 5);
          assert.equal(refundTxCount, 1);
          const expectedPts =
            100 -
            redeemed +
            (earnTxCount > 0 ? earned : 0) +
            (refundTxCount > 0 ? redeemed : 0) -
            (revokeTxCount > 0 ? earned : 0);
          assert.equal(dbUser.loyaltyPoints, expectedPts);
          if (earnTxCount > 0) {
            assert.equal(revokeTxCount, 1);
            assert.equal(dbUser.loyaltyPoints, 100);
          }
        } else {
          assert.fail(
            `Unexpected order state: status=${dbOrder.status}, paymentStatus=${dbOrder.paymentStatus}`
          );
        }
      }

      // Part A: Webhook vs Customer PATCH cancel across staggers
      for (const delayMs of [0, 20, 50, 80]) {
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
            quantityAdult: 2,
            email,
            phone,
            paymentMethod: "BANK_TRANSFER",
            redeemPoints: redeemed,
          }),
          tracker
        );
        assert.equal(orderRes.status, 201);
        const order = orderRes.json.order;
        const earned = Math.floor(order.total / 100_000);

        const cancelPromise = session.patch(
          `/api/client/account/orders/${order.id}/cancel`
        );
        if (delayMs > 0) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
        const whPromise = payOrderViaWebhook({
          baseUrl,
          tracker,
          order,
          eventId: uniqueTag(`t511-cust-${delayMs}`),
        });

        const [cancelRes, whWrap] = await Promise.all([
          cancelPromise,
          whPromise,
        ]);
        assert.equal(whWrap.res.status, 200);
        assert.inSet(cancelRes.status, [200, 400, 409]);

        await assertStateInvariant({
          orderId: order.id,
          userId: user.id,
          departureId: eph.departure.id,
          earned,
        });
      }

      // Part B: Webhook vs Admin PUT cancel across staggers
      for (const delayMs of [0, 20, 50, 80]) {
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
            quantityAdult: 2,
            email,
            phone,
            paymentMethod: "BANK_TRANSFER",
            redeemPoints: redeemed,
          }),
          tracker
        );
        assert.equal(orderRes.status, 201);
        const order = orderRes.json.order;
        const earned = Math.floor(order.total / 100_000);

        const whPromise = payOrderViaWebhook({
          baseUrl,
          tracker,
          order,
          eventId: uniqueTag(`t511-adm-${delayMs}`),
        });
        if (delayMs > 0) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
        const adminPromise = adminUpdateOrder(adminSession, order, {
          status: "CANCELLED",
        });

        const [whWrap, adminRes] = await Promise.all([whPromise, adminPromise]);
        assert.equal(whWrap.res.status, 200);
        assert.inSet(adminRes.status, [200, 409]);

        await assertStateInvariant({
          orderId: order.id,
          userId: user.id,
          departureId: eph.departure.id,
          earned,
        });
      }

      // Part C: Paid order cancelled by Admin with REFUND_REQUIRED (before REFUNDED)
      const ephC = await tracker.createEphemeralTour({
        priceNewAdult: 10_000_000,
        stockAdult: 5,
      });
      const memC = await registerFreshMember({ baseUrl, tracker });
      const oCRes = await memC.session.createOrder(
        makeOrderPayload({
          fixture: ephC,
          quantityAdult: 2,
          email: memC.email,
          phone: memC.phone,
          paymentMethod: "BANK_TRANSFER",
          redeemPoints: redeemed,
        }),
        tracker
      );
      assert.equal(oCRes.status, 201);
      const oC = oCRes.json.order;
      const earnedC = Math.floor(oC.total / 100_000);

      const payC = await payOrderViaWebhook({
        baseUrl,
        tracker,
        order: oC,
        eventId: uniqueTag("t511-paid-cancel"),
      });
      assert.equal(payC.res.status, 200);

      const admCancelPaid = await adminUpdateOrder(adminSession, oC, {
        paymentMethod: "BANK_TRANSFER",
        paymentStatus: "PAID",
        status: "CANCELLED",
        refundStatus: "REFUND_REQUIRED",
      });
      assert.equal(admCancelPaid.status, 200);

      await assertStateInvariant({
        orderId: oC.id,
        userId: memC.user.id,
        departureId: ephC.departure.id,
        earned: earnedC,
      });
    },
  },
];
