import { getCronSecret } from "./env.mjs";
import { makeOrderPayload } from "./fixtures.mjs";
import {
  createSession,
  freshIp,
  uniqueEmail,
  uniquePhone,
  uniqueTag,
} from "./http.mjs";

export async function registerFreshMember({
  baseUrl,
  tracker,
  fullName = "E2E Thành Viên",
  password = "Password@123",
  phone = uniquePhone(),
  email = uniqueEmail("member"),
  claimToken,
} = {}) {
  const session = createSession({ baseUrl, ip: freshIp() });
  const body = { fullName, email, phone, password };
  if (claimToken !== undefined) body.claimToken = claimToken;

  const res = await session.register(body, tracker);
  if (res.status !== 201 || !res.json?.user?.id) {
    throw new Error(
      `Expected 201 registering fresh member, got ${res.status}: ${res.text}`
    );
  }
  return {
    session,
    user: res.json.user,
    email: res.json.user.email,
    password,
    phone,
    res,
  };
}

export async function createGuestOrder({
  baseUrl,
  tracker,
  fixture,
  email = uniqueEmail("guest"),
  phone = uniquePhone(),
  fullName = "E2E Khách Vãng Lai",
  paymentMethod = "CASH",
  couponCode,
  quantityAdult = 1,
  quantityChild = 0,
  quantityBaby = 0,
  singleRoomCount = 0,
  passengers,
} = {}) {
  const session = createSession({ baseUrl, ip: freshIp() });
  const payload = makeOrderPayload({
    fixture,
    fullName,
    phone,
    email,
    paymentMethod,
    couponCode,
    quantityAdult,
    quantityChild,
    quantityBaby,
    singleRoomCount,
    passengers,
  });
  const res = await session.createOrder(payload, tracker);
  if (res.status !== 201 || !res.json?.order?.id) {
    throw new Error(
      `Expected 201 creating guest order, got ${res.status}: ${res.text}`
    );
  }
  return {
    session,
    order: res.json.order,
    claimToken: res.json.claimToken,
    email,
    phone,
    res,
  };
}

export async function payOrderViaWebhook({
  baseUrl,
  tracker,
  order,
  eventId = uniqueTag("evt"),
  amount = order.total,
  provider = "SEPAY_VIETQR",
} = {}) {
  const session = createSession({ baseUrl, ip: freshIp() });
  const res = await session.sendSignedWebhook(
    {
      eventId,
      orderCode: order.code,
      amount,
      provider,
    },
    tracker
  );
  return { res, eventId };
}

export async function createAdminSession(baseUrl) {
  const session = createSession({ baseUrl, ip: freshIp() });
  const res = await session.adminLogin();
  if (res.status !== 200) {
    throw new Error(`Admin login failed (${res.status}): ${res.text}`);
  }
  return session;
}

export async function adminUpdateOrder(adminSession, order, overrides = {}) {
  return adminSession.put(`/api/admin/orders/${order.id}`, {
    fullName: order.fullName,
    phone: order.phone,
    email: order.email ?? null,
    note: order.note ?? null,
    paymentMethod: overrides.paymentMethod ?? order.paymentMethod ?? "CASH",
    paymentStatus: overrides.paymentStatus ?? order.paymentStatus ?? "UNPAID",
    refundStatus: overrides.refundStatus ?? order.refundStatus ?? "NONE",
    status: overrides.status ?? order.status ?? "INITIAL",
  });
}

export async function triggerExpireOrdersCron(baseUrl) {
  const session = createSession({ baseUrl, ip: freshIp() });
  const cronSecret = getCronSecret();
  const headers = {};
  if (cronSecret) {
    headers.authorization = `Bearer ${cronSecret}`;
  }
  return session.get("/api/cron/expire-orders", { headers });
}
