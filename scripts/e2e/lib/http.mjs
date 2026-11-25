import crypto from "node:crypto";
import { getAdminCreds, getJwtSecret, getWebhookSecret } from "./env.mjs";

let ipCounter = 1;

export function freshIp() {
  const n = ipCounter++;
  const octet3 = Math.floor(n / 250) % 250;
  const octet4 = (n % 250) + 1;
  return `10.99.${octet3}.${octet4}`;
}

export function uniqueTag(prefix = "e2e") {
  const rand = crypto.randomBytes(4).toString("hex");
  return `${prefix}-${Date.now()}-${rand}`;
}

export function uniqueEmail(prefix = "e2e") {
  return `${uniqueTag(prefix)}@test.travelvn.local`;
}

export function uniquePhone() {
  const digits = String(crypto.randomInt(10_000_000, 99_999_999));
  return `09${digits}`;
}

export function signWebhookBody(rawBody, secret = getWebhookSecret()) {
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function signClaimToken(
  payload,
  { secret = getJwtSecret(), exp = Date.now() + 30 * 60 * 1000 } = {}
) {
  const normalized = {
    orderId: String(payload.orderId || "").trim(),
    orderCode: String(payload.orderCode || "").trim().toUpperCase(),
    email: String(payload.email || "").trim().toLowerCase(),
    phone: normalizePhoneValue(String(payload.phone || "")),
    exp,
  };
  const encoded = Buffer.from(JSON.stringify(normalized), "utf8").toString(
    "base64url"
  );
  const sig = crypto
    .createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function decodeClaimToken(token) {
  const [encoded, sig] = String(token || "").split(".");
  if (!encoded || !sig) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    );
    return { payload, encoded, sig };
  } catch {
    return null;
  }
}

export function verifyClaimTokenHmac(token, secret = getJwtSecret()) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(parts[0])
    .digest("base64url");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(parts[1], "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function normalizePhoneValue(phone) {
  const cleaned = String(phone || "")
    .trim()
    .replace(/[\s.-]/g, "");
  return cleaned
    .replace(/^\+840?/, "0")
    .replace(/^840?(?=\d{9,10}$)/, "0");
}

export class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  ingestResponse(res) {
    const setCookies =
      typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()
        : [];
    for (const raw of setCookies) {
      const [pair, ...attrs] = raw.split(";").map((s) => s.trim());
      const eq = pair.indexOf("=");
      if (eq <= 0) continue;
      const name = pair.slice(0, eq).trim();
      const val = pair.slice(eq + 1).trim();
      const lowerAttrs = attrs.map((a) => a.toLowerCase());
      const isExpired =
        !val ||
        lowerAttrs.some(
          (a) => a === "max-age=0" || a.startsWith("max-age=-")
        ) ||
        lowerAttrs.some((a) => a.includes("1970"));
      if (isExpired) {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, val);
      }
    }
  }

  headerValue() {
    if (this.cookies.size === 0) return "";
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  get(name) {
    return this.cookies.get(name) ?? null;
  }

  set(name, value) {
    if (value === null || value === undefined || value === "") {
      this.cookies.delete(name);
    } else {
      this.cookies.set(name, value);
    }
  }

  clear() {
    this.cookies.clear();
  }
}

export function createSession({ baseUrl, ip = freshIp() }) {
  const jar = new CookieJar();
  const normalizedBase = baseUrl.replace(/\/+$/, "");

  async function request(method, pathOrUrl, options = {}) {
    const url = pathOrUrl.startsWith("http")
      ? pathOrUrl
      : `${normalizedBase}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;

    const headers = new Headers(options.headers || {});
    const reqIp = options.ip ?? ip;
    if (reqIp && !headers.has("x-forwarded-for")) {
      headers.set("x-forwarded-for", reqIp);
    }
    const cookieHeader = jar.headerValue();
    if (cookieHeader && !headers.has("cookie")) {
      headers.set("cookie", cookieHeader);
    }

    let bodyToSend;
    if (options.rawBody !== undefined) {
      bodyToSend = options.rawBody;
      if (!headers.has("content-type")) {
        headers.set("content-type", "application/json");
      }
    } else if (options.body !== undefined) {
      bodyToSend = JSON.stringify(options.body);
      if (!headers.has("content-type")) {
        headers.set("content-type", "application/json");
      }
    }

    const res = await fetch(url, {
      method,
      headers,
      body: bodyToSend,
      redirect: options.redirect ?? "manual",
      signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
    });

    jar.ingestResponse(res);
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    return {
      status: res.status,
      ok: res.ok,
      headers: res.headers,
      location: res.headers.get("location"),
      text,
      json,
    };
  }

  return {
    baseUrl: normalizedBase,
    ip,
    jar,
    request,
    get: (p, opts) => request("GET", p, opts),
    post: (p, body, opts = {}) => request("POST", p, { ...opts, body }),
    put: (p, body, opts = {}) => request("PUT", p, { ...opts, body }),
    patch: (p, body, opts = {}) => request("PATCH", p, { ...opts, body }),
    del: (p, opts) => request("DELETE", p, opts),
    postRaw: (p, rawBody, opts = {}) =>
      request("POST", p, { ...opts, rawBody }),

    async register(payload, tracker) {
      const res = await request("POST", "/api/client/auth/register", {
        body: payload,
      });
      if (res.status === 201 && res.json?.user?.id && tracker) {
        tracker.trackUser(res.json.user.id);
      }
      return res;
    },

    async login(payload) {
      return request("POST", "/api/client/auth/login", { body: payload });
    },

    async logout() {
      return request("POST", "/api/client/auth/logout");
    },

    async me() {
      return request("GET", "/api/client/auth/me");
    },

    async adminLogin(creds = getAdminCreds()) {
      return request("POST", "/api/admin/auth/login", { body: creds });
    },

    async createOrder(payload, tracker) {
      const res = await request("POST", "/api/client/orders", {
        body: payload,
      });
      if (res.status === 201 && res.json?.order && tracker) {
        tracker.trackOrder(res.json.order);
      }
      return res;
    },

    async sendSignedWebhook(
      { eventId, orderCode, amount, provider = "SEPAY_VIETQR" },
      tracker,
      { secret, sigPrefix = "" } = {}
    ) {
      if (tracker && eventId) tracker.trackEventId(eventId);
      const rawBody = JSON.stringify({ eventId, orderCode, amount, provider });
      const sig = `${sigPrefix}${signWebhookBody(rawBody, secret)}`;
      return request("POST", "/api/webhooks/payment", {
        rawBody,
        headers: {
          "x-webhook-signature": sig,
        },
      });
    },
  };
}
