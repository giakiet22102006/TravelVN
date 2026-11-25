"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, RotateCw } from "lucide-react";
import { AdminAuthCard } from "@/components/admin/AdminAuthCard";

function OtpPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") || "";

  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(initialEmail ? 60 : 0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/otp-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "Mã OTP không hợp lệ");
        return;
      }
      router.push("/admin/account/reset-password");
    } catch {
      setError("Không thể kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    if (!email.trim()) {
      setError("Vui lòng nhập email trước khi gửi lại mã OTP");
      return;
    }
    if (cooldown > 0 || resending) return;

    setError("");
    setNotice("");
    setResending(true);
    try {
      const res = await fetch("/api/admin/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "Không thể gửi lại mã OTP");
        return;
      }
      setNotice(
        data.message || "Đã gửi lại mã OTP mới. Vui lòng kiểm tra email."
      );
      setCooldown(60);
    } catch {
      setError("Không thể kết nối máy chủ");
    } finally {
      setResending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 font-medium">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 font-medium">
          {notice}
        </div>
      )}

      <div>
        <label
          htmlFor="otp-email"
          className="block text-[15px] font-semibold text-[#202224]/80 mb-2"
        >
          Email:
        </label>
        <input
          id="otp-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="levana@gmail.com"
          className="w-full h-12 px-4 rounded-lg bg-[#F1F4F9] border border-[#D8D8D8] text-[15px] focus:outline-none focus:border-[#4880FF] focus:bg-white"
        />
      </div>

      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <label
            htmlFor="otp-code"
            className="block text-[15px] font-semibold text-[#202224]/80"
          >
            Mã OTP:
          </label>
          <button
            type="button"
            disabled={cooldown > 0 || resending}
            onClick={handleResendOtp}
            className="text-xs font-bold text-[#4880FF] hover:underline disabled:text-[#667479] disabled:no-underline disabled:cursor-not-allowed inline-flex items-center gap-1"
          >
            {resending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RotateCw className="w-3.5 h-3.5" />
            )}
            <span>
              {cooldown > 0
                ? `Gửi lại mã OTP (${cooldown}s)`
                : "Gửi lại mã OTP"}
            </span>
          </button>
        </div>
        <input
          id="otp-code"
          type="text"
          required
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          placeholder="Ví dụ: 123456"
          className="w-full h-12 px-4 rounded-lg bg-[#F1F4F9] border border-[#D8D8D8] text-[15px] tracking-widest focus:outline-none focus:border-[#4880FF] focus:bg-white"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full h-12 rounded-lg bg-[#4880FF] hover:bg-[#3a6ce0] text-white font-bold text-base transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Xác thực
      </button>

      <p className="text-center text-sm font-semibold text-[#202224]/70">
        Bạn đã nhớ mật khẩu?{" "}
        <Link
          href="/admin/account/login"
          className="text-[#4880FF] hover:underline font-bold"
        >
          Đăng nhập
        </Link>
      </p>
    </form>
  );
}

export default function AdminOtpPasswordPage() {
  return (
    <AdminAuthCard
      title="Nhập mã OTP"
      subtitle="Vui lòng nhập mã OTP để tiếp tục"
    >
      <Suspense fallback={<div className="text-center py-4 text-sm">Đang tải...</div>}>
        <OtpPasswordForm />
      </Suspense>
    </AdminAuthCard>
  );
}
