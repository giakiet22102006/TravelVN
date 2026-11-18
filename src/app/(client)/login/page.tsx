"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock, Mail } from "lucide-react";
import { useClientMeta } from "@/components/client/ClientLayoutShell";
import { SocialOAuthButtons } from "@/components/client/SocialOAuthButtons";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setCurrentUser } = useClientMeta();

  const nextParam = searchParams.get("next");
  const redirectTo =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/account/orders";

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
        body: JSON.stringify({ email: email.trim(), password }),
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
      <div className="bg-white rounded-[16px] border border-[#ECECEC] p-6 sm:p-8 shadow-md">
        <div className="text-center mb-6">
          <h1 className="text-[24px] font-bold text-[#4502C7]">
            Đăng Nhập Tài Khoản
          </h1>
          <p className="text-[13px] text-[#667479] mt-1.5">
            Theo dõi lịch trình, quản lý đơn đặt tour và nhận ưu đãi thành viên
            28.TRAVEL.
          </p>
        </div>

        <form noValidate onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-lg bg-red-50 border border-red-200 text-[#DA0808] text-[13px] px-4 py-3 font-medium"
            >
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="login-email"
              className="block text-[13px] font-semibold text-[#25282B] mb-1.5"
            >
              Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#99A2A5] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tenban@gmail.com"
                autoComplete="email"
                className="w-full h-[44px] pl-10 pr-3.5 rounded-[10px] border border-[#CCD1D2] text-[14px] focus:outline-none focus:border-[#4502C7]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-[13px] font-semibold text-[#25282B] mb-1.5"
            >
              Mật khẩu
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#99A2A5] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full h-[44px] pl-10 pr-3.5 rounded-[10px] border border-[#CCD1D2] text-[14px] focus:outline-none focus:border-[#4502C7]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-[46px] rounded-[10px] bg-[#4502C7] hover:bg-[#36019e] text-white font-semibold text-[15px] inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
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

        <p className="text-center text-[13px] text-[#667479] mt-6">
          Bạn chưa có tài khoản?{" "}
          <Link
            href="/register"
            className="text-[#4502C7] font-bold hover:underline"
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
          <div className="h-[420px] rounded-[16px] bg-white animate-pulse" />
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
