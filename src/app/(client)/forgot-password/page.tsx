"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";

type Step = "email" | "otp" | "reset" | "done";

export default function ClientForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Vui lòng nhập email tài khoản của bạn.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/client/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Không thể gửi mã OTP lúc này.");
        return;
      }
      setInfo(
        data.message ||
          "Nếu email tồn tại trong hệ thống, mã OTP khôi phục đã được gửi."
      );
      setStep("otp");
    } catch {
      setError("Không thể kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!otp.trim()) {
      setError("Vui lòng nhập mã OTP gồm 6 chữ số.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/client/auth/otp-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Mã OTP không đúng hoặc đã hết hạn.");
        return;
      }
      setInfo("Xác thực OTP thành công. Hãy đặt mật khẩu mới của bạn.");
      setStep("reset");
    } catch {
      setError("Không thể kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (password.length < 6) {
      setError("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/client/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Không thể đặt lại mật khẩu.");
        return;
      }
      setStep("done");
    } catch {
      setError("Không thể kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-[460px] mx-auto px-4 py-10 sm:py-14">
      <div className="bg-white rounded-[16px] border border-subtle p-6 sm:p-8 shadow-md">
        <div className="text-center mb-6">
          <h1 className="text-[24px] font-bold text-ink">
            Khôi Phục Mật Khẩu
          </h1>
          <p className="text-[13px] text-ink-muted mt-1.5">
            {step === "email" &&
              "Nhập email đã đăng ký để nhận mã OTP xác thực 6 chữ số."}
            {step === "otp" &&
              `Nhập mã OTP 6 chữ số đã được gửi tới ${email.trim()}.`}
            {step === "reset" &&
              "Thiết lập mật khẩu mới cho tài khoản VN.TRAVEL của bạn."}
            {step === "done" &&
              "Mật khẩu tài khoản của bạn đã được cập nhật thành công."}
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg bg-status-danger-bg border border-status-danger-border text-status-danger text-[13px] px-4 py-3 font-medium"
          >
            {error}
          </div>
        )}

        {info && step !== "done" && (
          <div
            role="status"
            className="mb-4 rounded-lg bg-client-soft border border-client-border text-client-primary text-[13px] px-4 py-3 font-medium"
          >
            {info}
          </div>
        )}

        {step === "email" && (
          <form noValidate onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label
                htmlFor="forgot-email"
                className="block text-[13px] font-semibold text-ink mb-1.5"
              >
                Email tài khoản
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="forgot-email"
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

            <button
              type="submit"
              disabled={loading}
              className="w-full h-[46px] rounded-[10px] bg-client-primary hover:bg-client-primary-hover text-white font-semibold text-[15px] inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Gửi Mã OTP
            </button>
          </form>
        )}

        {step === "otp" && (
          <form noValidate onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label
                htmlFor="forgot-otp"
                className="block text-[13px] font-semibold text-ink mb-1.5"
              >
                Mã OTP (6 chữ số)
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="forgot-otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  autoComplete="one-time-code"
                  className="w-full h-[44px] pl-10 pr-3.5 rounded-[10px] border border-strong text-[16px] tracking-[0.25em] font-semibold text-ink placeholder:tracking-normal placeholder:font-normal placeholder:text-ink-muted focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/40"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-[46px] rounded-[10px] bg-client-primary hover:bg-client-primary-hover text-white font-semibold text-[15px] inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Xác Thực OTP
            </button>

            <button
              type="button"
              onClick={() => {
                setError("");
                setInfo("");
                setStep("email");
              }}
              className="w-full text-center text-[13px] text-ink-muted hover:text-client-primary font-medium py-1"
            >
              Đổi email hoặc gửi lại mã OTP
            </button>
          </form>
        )}

        {step === "reset" && (
          <form noValidate onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label
                htmlFor="reset-password"
                className="block text-[13px] font-semibold text-ink mb-1.5"
              >
                Mật khẩu mới
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="reset-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  autoComplete="new-password"
                  className="w-full h-[44px] pl-10 pr-3.5 rounded-[10px] border border-strong text-[14px] text-ink placeholder:text-ink-muted focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/40"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="reset-confirm-password"
                className="block text-[13px] font-semibold text-ink mb-1.5"
              >
                Xác nhận mật khẩu mới
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="reset-confirm-password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  autoComplete="new-password"
                  className="w-full h-[44px] pl-10 pr-3.5 rounded-[10px] border border-strong text-[14px] text-ink placeholder:text-ink-muted focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/40"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-[46px] rounded-[10px] bg-client-primary hover:bg-client-primary-hover text-white font-semibold text-[15px] inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Đặt Lại Mật Khẩu
            </button>
          </form>
        )}

        {step === "done" && (
          <div className="text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-status-success-bg text-status-success mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-[14px] text-ink">
              Bạn có thể sử dụng mật khẩu mới để đăng nhập ngay bây giờ.
            </p>
            <Link
              href="/login"
              className="w-full h-[46px] rounded-[10px] bg-client-primary hover:bg-client-primary-hover text-white font-semibold text-[15px] inline-flex items-center justify-center transition-colors"
            >
              Về Trang Đăng Nhập
            </Link>
          </div>
        )}

        {step !== "done" && (
          <div className="mt-5 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-client-primary hover:underline min-h-[44px] px-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Quay lại đăng nhập
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
