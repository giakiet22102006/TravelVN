"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock, Mail, Ticket } from "lucide-react";
import { useClientMeta } from "@/components/client/ClientLayoutShell";
import { SocialOAuthButtons } from "@/components/client/SocialOAuthButtons";

const DUMMY_ORIGIN = "http://localhost";
const SENTINEL_ORIGIN = "http://sentinel.invalid";

function sanitizeNextPath(raw: string | null | undefined): string | null {
  const rawNext = (raw || "").trim();
  if (
    !rawNext.startsWith("/") ||
    rawNext.startsWith("//") ||
    rawNext.startsWith("/\\") ||
    rawNext.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(rawNext)
  ) {
    return null;
  }

  try {
    const parsed = new URL(rawNext, DUMMY_ORIGIN);
    if (
      parsed.origin !== DUMMY_ORIGIN ||
      parsed.host !== "localhost" ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      !parsed.pathname.startsWith("/") ||
      parsed.pathname.startsWith("//") ||
      parsed.pathname.startsWith("/\\") ||
      /%5c/i.test(parsed.pathname)
    ) {
      return null;
    }

    const candidate = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (
      !candidate.startsWith("/") ||
      candidate.startsWith("//") ||
      candidate.startsWith("/\\") ||
      candidate.includes("\\") ||
      /[\u0000-\u001f\u007f]/.test(candidate) ||
      /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(candidate)
    ) {
      return null;
    }

    const reparsed = new URL(candidate, SENTINEL_ORIGIN);
    if (
      reparsed.origin !== SENTINEL_ORIGIN ||
      reparsed.host !== "sentinel.invalid" ||
      reparsed.username !== "" ||
      reparsed.password !== "" ||
      !reparsed.pathname.startsWith("/") ||
      reparsed.pathname.startsWith("//") ||
      reparsed.pathname.startsWith("/\\")
    ) {
      return null;
    }

    return candidate;
  } catch {
    return null;
  }
}

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setCurrentUser } = useClientMeta();

  const safeNext = sanitizeNextPath(searchParams.get("next"));
  const redirectTo = safeNext || "/account/orders";
  const claimToken = searchParams.get("claimToken")?.trim() || null;

  const registerParams = new URLSearchParams();
  if (safeNext) registerParams.set("next", safeNext);
  if (claimToken) registerParams.set("claimToken", claimToken);
  const registerQuery = registerParams.toString();
  const registerHref = registerQuery
    ? `/register?${registerQuery}`
    : "/register";

  const oauthSandboxRaw = searchParams.get("oauth_sandbox");
  const oauthSandbox = oauthSandboxRaw === "google" ? "google" : null;

  const oauthError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    oauthError ? "Đăng nhập mạng xã hội không thành công, vui lòng thử lại." : ""
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Vui lòng nhập đầy đủ email và mật khẩu.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/client/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          ...(claimToken ? { claimToken } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Đăng nhập thất bại");
        return;
      }
      setCurrentUser(data.user);
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Không thể kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-[460px] mx-auto px-4 py-10 sm:py-14">
      <div className="bg-white rounded-[16px] border border-subtle p-6 sm:p-8 shadow-md">
        <div className="text-center mb-6">
          <h1 className="text-[24px] font-bold text-ink">
            Đăng Nhập Tài Khoản
          </h1>
          <p className="text-[13px] text-ink-muted mt-1.5">
            Theo dõi lịch trình, quản lý đơn đặt tour và nhận ưu đãi thành viên
            VN.TRAVEL.
          </p>
        </div>

        {claimToken && (
          <div
            role="status"
            className="mb-5 rounded-[12px] bg-client-soft border border-client-border px-4 py-3 flex items-start gap-2.5 text-[13px] text-ink"
          >
            <Ticket className="w-4 h-4 text-client-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-client-primary">
                Liên kết đơn đặt tour sau khi đăng nhập
              </p>
              <p className="text-ink-muted text-[12.5px] mt-0.5">
                Đơn đặt tour vừa tạo sẽ được tự động lưu vào tài khoản của bạn
                ngay khi đăng nhập thành công.
              </p>
            </div>
          </div>
        )}

        <form noValidate onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-lg bg-status-danger-bg border border-status-danger-border text-status-danger text-[13px] px-4 py-3 font-medium"
            >
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="login-email"
              className="block text-[13px] font-semibold text-ink mb-1.5"
            >
              Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tenban@gmail.com"
                autoComplete="email"
                className="w-full h-[44px] pl-10 pr-3.5 rounded-[10px] border border-strong text-[14px] text-ink placeholder:text-ink-muted focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/40"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="login-password"
                className="block text-[13px] font-semibold text-ink"
              >
                Mật khẩu
              </label>
              <Link
                href="/forgot-password"
                className="text-[12.5px] font-semibold text-client-primary hover:underline"
              >
                Quên mật khẩu?
              </Link>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full h-[44px] pl-10 pr-3.5 rounded-[10px] border border-strong text-[14px] text-ink placeholder:text-ink-muted focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/40"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-[46px] rounded-[10px] bg-client-primary hover:bg-client-primary-hover text-white font-semibold text-[15px] inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-client-primary/40 disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Đăng Nhập
          </button>
        </form>

        <div className="mt-5">
          <SocialOAuthButtons
            redirectTo={redirectTo}
            initialSandboxProvider={oauthSandbox}
          />
        </div>

        <p className="text-center text-[13px] text-ink-muted mt-4">
          Bạn chưa có tài khoản?{" "}
          <Link
            href={registerHref}
            className="text-client-primary font-bold hover:underline inline-flex items-center min-h-[44px] px-1.5"
          >
            Đăng ký ngay
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ClientLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[460px] mx-auto px-4 py-14">
          <div className="h-[420px] rounded-[16px] bg-surface-muted border border-subtle animate-pulse" />
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
