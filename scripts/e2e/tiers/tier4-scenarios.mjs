import { makeOrderPayload, makePassengers } from "../lib/fixtures.mjs";
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
  uniqueEmail,
  uniquePhone,
  uniqueTag,
} from "../lib/http.mjs";

export const tier4Scenarios = [
  {
    id: "T4-S1",
    feature: "F3, F4, F5, F6, F7, F8, F10",
    name: "Guest checkout -> 1-click quick-register -> Saved Traveler -> repeat booking with THANHVIEN200 + points -> webhook earn",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      // 1. Guest checks out 4.89M-band tour
      const guestEmail = uniqueEmail("t4s1");
      const guestPhone = uniquePhone();
      const g = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.midTier,
        email: guestEmail,
        phone: guestPhone,
        paymentMethod: "BANK_TRANSFER",
      });
      assert.ok(g.claimToken);

      // 2. Post-checkout quick-register (+100 welcome bonus & claims order)
      const memberSession = createSession({ baseUrl, ip: freshIp() });
      const qrRes = await memberSession.post("/api/client/orders/claim", {
        mode: "quick-register",
        claimToken: g.claimToken,
        password: "Password@123",
        fullName: "Trần Thanh Hương",
      });
      assert.equal(qrRes.status, 201);
      const user = qrRes.json.user;
      tracker.trackUser(user.id);
      assert.equal(user.loyaltyPoints, 100);

      // 3. Verify claimed order appears in /api/client/account/orders
      const ordersRes = await memberSession.get("/api/client/account/orders");
      assert.equal(ordersRes.status, 200);
      assert.ok(ordersRes.json.orders.some((o) => o.code === g.order.code));

      // 4. Create Saved Traveler via /api/client/account/travelers
      const tRes = await memberSession.post("/api/client/account/travelers", {
        fullName: "Nguyễn Gia Hân",
        gender: "FEMALE",
        birthDate: "1996-05-18",
        defaultTier: "ADULT",
        documentNumber: "079096001122",
        relationship: "Gia đình",
      });
      assert.equal(tRes.status, 201);

      // 5. Repeat 10M booking using THANHVIEN200 + 100 points + saveTravelers
      const eph10M = await tracker.createEphemeralTour({
        priceNewAdult: 10_000_000,
      });
      const o2Res = await memberSession.createOrder(
        makeOrderPayload({
          fixture: eph10M,
          email: guestEmail,
          phone: guestPhone,
          couponCode: "THANHVIEN200",
          redeemPoints: 100,
          saveTravelers: true,
          paymentMethod: "BANK_TRANSFER",
          passengers: [
            {
              fullName: "Nguyễn Gia Hân",
              gender: "FEMALE",
              birthDate: "1996-05-18",
              tier: "ADULT",
              documentNumber: "079096001122",
            },
          ],
        }),
        tracker
      );
      assert.equal(o2Res.status, 201);
      const o2 = o2Res.json.order;
      assert.equal(o2.total, 9_700_000);

      // 6. Pay via signed webhook -> +97 ORDER_EARN
      await payOrderViaWebhook({ baseUrl, tracker, order: o2 });

      // 7. Verify wallet ledger & deduped Saved Travelers
      const loyaltyRes = await memberSession.get("/api/client/account/loyalty");
      assert.equal(loyaltyRes.status, 200);
      assert.equal(loyaltyRes.json.loyaltyPoints, 97);
      assert.equal(loyaltyRes.json.lifetimePoints, 197);
      const txTypes = loyaltyRes.json.transactions.map((t) => t.type);
      assert.includes(txTypes, "WELCOME_BONUS");
      assert.includes(txTypes, "ORDER_REDEEM");
      assert.includes(txTypes, "ORDER_EARN");

      const travelersCount = await prisma.savedTraveler.count({
        where: { userId: user.id },
      });
      assert.equal(travelersCount, 1);
    },
  },
  {
    id: "T4-S2",
    feature: "F3, F5, F6, F8",
    name: "Returning guest -> Google OAuth auto-claim (or fallback claim) -> VIP500 + points -> Refund clamping",
    async run({ baseUrl, prisma, tracker, fixtures, assert, note }) {
      const guestEmail = `Traveler.VIP.${uniqueTag("s2")}@Test.TravelVN.local`;
      const guestPhone = uniquePhone();

      // 1. Two pre-existing guest orders: O1 unpaid, O2 paid 10M
      const o1 = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.midTier,
        email: guestEmail,
        phone: guestPhone,
        paymentMethod: "CASH",
      });
      const o2 = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.tenMTier,
        email: guestEmail.toLowerCase(),
        phone: guestPhone,
        paymentMethod: "BANK_TRANSFER",
      });
      await payOrderViaWebhook({ baseUrl, tracker, order: o2.order });
      const o2Earn = Math.floor(o2.order.total / 100_000);

      // 2. Google OAuth login (sandbox if enabled, else explicit guard + token claim fallback)
      const session = createSession({ baseUrl, ip: freshIp() });
      const probe = await session.get("/api/client/auth/oauth/google?check=1");
      let userId;
      if (probe.status === 200 && probe.json?.mode === "sandbox") {
        const oauthRes = await session.post("/api/client/auth/oauth/google", {
          email: guestEmail.toLowerCase(),
          fullName: "Traveler VIP",
          providerId: `google-${uniqueTag("vip")}`,
        });
        assert.equal(oauthRes.status, 200);
        userId = oauthRes.json.user.id;
        tracker.trackUser(userId);
        assert.equal(oauthRes.json.user.loyaltyPoints, 100 + o2Earn);
      } else {
        assert.equal(probe.status, 403);
        note(
          "OAuth sandbox disabled on server; exercised 403 guard and continued VIP500 + refund clamping lifecycle via claimToken."
        );
        const regRes = await session.register(
          {
            fullName: "Traveler VIP",
            email: guestEmail.toLowerCase(),
            phone: guestPhone,
            password: "Password@123",
            claimToken: o2.claimToken,
          },
          tracker
        );
        assert.equal(regRes.status, 201);
        userId = regRes.json.user.id;
        await session.post("/api/client/orders/claim", {
          mode: "link",
          claimToken: o1.claimToken,
        });
      }

      // 3. Apply VIP500 (-500k) + redeem entire point balance on >= 8M tour
      const eph12M = await tracker.createEphemeralTour({
        priceNewAdult: 12_000_000,
      });
      const totalPts = 100 + o2Earn;
      const o3Res = await session.createOrder(
        makeOrderPayload({
          fixture: eph12M,
          email: guestEmail.toLowerCase(),
          phone: guestPhone,
          couponCode: "VIP500",
          redeemPoints: totalPts,
        }),
        tracker
      );
      assert.equal(o3Res.status, 201);
      assert.equal(o3Res.json.order.discount, 500_000);
      assert.equal(o3Res.json.order.pointsRedeemed, totalPts);

      // 4. Admin marks O2 as REFUNDED -> balance clamped at 0 (never negative)
      const adminSession = await createAdminSession(baseUrl);
      const refRes = await adminUpdateOrder(adminSession, o2.order, {
        paymentMethod: "BANK_TRANSFER",
        paymentStatus: "PAID",
        status: "CANCELLED",
        refundStatus: "REFUNDED",
      });
      assert.equal(refRes.status, 200);

      const dbUser = await prisma.user.findUnique({ where: { id: userId } });
      assert.equal(dbUser?.loyaltyPoints, 0);
      assert.ok(dbUser.lifetimePoints >= 0);
    },
  },
  {
    id: "T4-S3",
    feature: "F3, F4, F5, F6, F8",
    name: "Unclaimed guest order -> normal register (zero-hijack) -> manual claim -> 15m TTL expiry refund",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      const victimEmail = uniqueEmail("victim");
      const victimPhone = "0901234567";
      const g = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.midTier,
        email: victimEmail,
        phone: victimPhone,
        paymentMethod: "MOMO",
      });

      // 1. Normal register with same email must NOT auto-claim
      const { session, user, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
        email: victimEmail,
        phone: victimPhone,
      });
      const initialOrders = await session.get("/api/client/account/orders");
      assert.equal(initialOrders.status, 200);
      assert.equal(initialOrders.json.orders.length, 0);

      // 2. Manual claim: wrong phone fails 403, then normalized +84 succeeds 200
      const badClaim = await session.post("/api/client/orders/claim", {
        mode: "link",
        orderCode: g.order.code,
        phone: "0999888777",
      });
      assert.equal(badClaim.status, 403);

      const goodClaim = await session.post("/api/client/orders/claim", {
        mode: "link",
        orderCode: g.order.code,
        phone: "+84 901.234-567",
      });
      assert.equal(goodClaim.status, 200);

      // 3. Place 2nd MOMO order redeeming 100 pts, backdate expiresAt -> cron refunds 100 pts + restores stock
      const eph = await tracker.createEphemeralTour({
        priceNewAdult: 5_000_000,
        stockAdult: 3,
      });
      const o2Res = await session.createOrder(
        makeOrderPayload({
          fixture: eph,
          email,
          phone,
          paymentMethod: "MOMO",
          redeemPoints: 100,
        }),
        tracker
      );
      assert.equal(o2Res.status, 201);
      const o2 = o2Res.json.order;

      await prisma.order.update({
        where: { id: o2.id },
        data: { expiresAt: new Date(Date.now() - 120_000) },
      });
      const cronRes = await triggerExpireOrdersCron(baseUrl);
      assert.equal(cronRes.status, 200);

      const dbDep = await prisma.tourDeparture.findUnique({
        where: { id: eph.departure.id },
      });
      assert.equal(dbDep?.stockAdult, 3);

      const loyalty = await session.get("/api/client/account/loyalty");
      assert.equal(loyalty.status, 200);
      assert.equal(loyalty.json.loyaltyPoints, 100);
    },
  },
  {
    id: "T4-S4",
    feature: "F2, F5, F6, F8",
    name: "Tier progression journey (BRONZE -> SILVER -> GOLD) & ledger integrity",
    async run({ baseUrl, tracker, assert }) {
      const eph40M = await tracker.createEphemeralTour({
        priceNewAdult: 40_000_000,
        priceNewChild: 20_000_000,
        stockAdult: 10,
        stockChild: 5,
      });
      const { session, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });

      // Step 1: BRONZE (100 pts)
      let lRes = await session.get("/api/client/account/loyalty");
      assert.equal(lRes.status, 200);
      assert.equal(lRes.json.tierInfo.tier, "BRONZE");

      // Step 2: Pay 40M order -> +400 pts -> 500 lifetime -> SILVER (0%, 1000 to GOLD)
      const o1Res = await session.createOrder(
        makeOrderPayload({
          fixture: eph40M,
          email,
          phone,
          paymentMethod: "BANK_TRANSFER",
        }),
        tracker
      );
      assert.equal(o1Res.status, 201);
      await payOrderViaWebhook({
        baseUrl,
        tracker,
        order: o1Res.json.order,
      });

      lRes = await session.get("/api/client/account/loyalty");
      assert.equal(lRes.status, 200);
      assert.equal(lRes.json.lifetimePoints, 500);
      assert.equal(lRes.json.tierInfo.tier, "SILVER");
      assert.equal(lRes.json.tierInfo.label, "Thành viên Bạc");
      assert.equal(lRes.json.tierInfo.progressPercent, 0);
      assert.equal(lRes.json.tierInfo.pointsToNext, 1000);
      assert.equal(
        lRes.json.coupons.find((c) => c.code === "VIP500")?.eligibility?.eligible,
        true
      );

      // Step 3: Pay 100M order (2 adults + 1 child = 100M) -> +1000 pts -> 1500 -> GOLD
      const o2Res = await session.createOrder(
        makeOrderPayload({
          fixture: eph40M,
          quantityAdult: 2,
          quantityChild: 1,
          email,
          phone,
          paymentMethod: "BANK_TRANSFER",
        }),
        tracker
      );
      assert.equal(o2Res.status, 201);
      await payOrderViaWebhook({
        baseUrl,
        tracker,
        order: o2Res.json.order,
      });

      lRes = await session.get("/api/client/account/loyalty");
      assert.equal(lRes.status, 200);
      assert.equal(lRes.json.lifetimePoints, 1500);
      assert.equal(lRes.json.tierInfo.tier, "GOLD");
      assert.equal(lRes.json.tierInfo.label, "Thành viên Vàng");
      assert.equal(lRes.json.tierInfo.progressPercent, 100);
      assert.equal(lRes.json.tierInfo.nextTier, null);
      assert.equal(lRes.json.transactions.length, 3);
    },
  },
  {
    id: "T4-S5",
    feature: "F5, F7",
    name: "Saved Travelers 20-item capacity lifecycle & order passenger snapshot immutability",
    async run({ baseUrl, prisma, tracker, fixtures, assert }) {
      const { session, user, email, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });

      await prisma.savedTraveler.createMany({
        data: Array.from({ length: 19 }, (_, i) => ({
          userId: user.id,
          fullName: `Traveler ${i + 1}`,
          gender: "MALE",
          birthDate: "1990-01-01",
          defaultTier: "ADULT",
        })),
      });

      // Add #20 via API -> 201; #21 -> 400/409
      const t20 = await session.post("/api/client/account/travelers", {
        fullName: "Hành Khách Số 20",
        gender: "FEMALE",
        birthDate: "1994-04-04",
        defaultTier: "ADULT",
      });
      assert.equal(t20.status, 201);

      const t21 = await session.post("/api/client/account/travelers", {
        fullName: "Hành Khách Số 21",
        gender: "MALE",
        birthDate: "1995-05-05",
        defaultTier: "ADULT",
      });
      assert.inSet(t21.status, [400, 409]);

      // Edit #20 and delete one existing traveler
      const listRes = await session.get("/api/client/account/travelers");
      assert.equal(listRes.status, 200);
      const t1 = listRes.json.travelers.find((t) => t.fullName === "Traveler 1");
      assert.ok(t1);

      const editRes = await session.put(`/api/client/account/travelers/${t1.id}`, {
        fullName: "Nguyễn Snapshot Gốc",
        gender: "MALE",
        birthDate: "1990-01-01",
        defaultTier: "ADULT",
        documentNumber: "079090001111",
      });
      assert.equal(editRes.status, 200);

      const delRes = await session.del(
        `/api/client/account/travelers/${t20.json.traveler.id}`
      );
      assert.equal(delRes.status, 200);

      // Place order with Traveler #1's current snapshot
      const oRes = await session.createOrder(
        makeOrderPayload({
          fixture: fixtures.midTier,
          email,
          phone,
          passengers: [
            {
              fullName: "Nguyễn Snapshot Gốc",
              gender: "MALE",
              birthDate: "1990-01-01",
              tier: "ADULT",
              documentNumber: "079090001111",
            },
          ],
        }),
        tracker
      );
      assert.equal(oRes.status, 201);

      // Rename Traveler #1 afterward -> order snapshot must stay immutable
      const renameRes = await session.put(
        `/api/client/account/travelers/${t1.id}`,
        {
          fullName: "Nguyễn Đã Đổi Tên",
          gender: "MALE",
          birthDate: "1990-01-01",
          defaultTier: "ADULT",
          documentNumber: "079090999999",
        }
      );
      assert.equal(renameRes.status, 200);

      const orderItem = await prisma.orderItem.findFirst({
        where: { orderId: oRes.json.order.id },
      });
      const snap = Array.isArray(orderItem?.passengers)
        ? orderItem.passengers
        : [];
      assert.equal(snap[0]?.fullName, "Nguyễn Snapshot Gốc");
      assert.equal(snap[0]?.documentNumber, "079090001111");
    },
  },
  {
    id: "T4-S6",
    feature: "F3, F4, F8, F10",
    name: "Existing member checks out as guest -> logs in with claimToken -> order visible + voucher accessible",
    async run({ baseUrl, tracker, fixtures, assert }) {
      const { email, password, phone } = await registerFreshMember({
        baseUrl,
        tracker,
      });

      const guest = await createGuestOrder({
        baseUrl,
        tracker,
        fixture: fixtures.midTier,
        email,
        phone,
      });
      assert.ok(guest.claimToken);

      const loginPage = await createSession({ baseUrl, ip: freshIp() }).get(
        `/login?claimToken=${encodeURIComponent(
          guest.claimToken
        )}&next=/account/orders`
      );
      assert.equal(loginPage.status, 200);

      const loginSession = createSession({ baseUrl, ip: freshIp() });
      const loginRes = await loginSession.login({
        email,
        password,
        claimToken: guest.claimToken,
      });
      assert.equal(loginRes.status, 200);

      const ordersRes = await loginSession.get("/api/client/account/orders");
      assert.equal(ordersRes.status, 200);
      assert.ok(ordersRes.json.orders.some((o) => o.code === guest.order.code));

      const voucherRes = await loginSession.get(
        `/orders/${encodeURIComponent(guest.order.code)}/voucher?phone=${encodeURIComponent(
          phone
        )}`
      );
      assert.equal(voucherRes.status, 200);
      assert.includes(voucherRes.text, guest.order.code);
    },
  },
];
