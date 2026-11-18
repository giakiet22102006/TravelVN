"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AdminAuthCard } from "@/components/admin/AdminAuthCard";

function OtpPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") || "";

  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/otp-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
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

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 font-medium">
          {error}
        </div>
      )}

      <div>
        <label className="block text-[15px] font-semibold text-[#202224]/80 mb-2">
          Email:
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="levana@gmail.com"
          className="w-full h-12 px-4 rounded-lg bg-[#F1F4F9] border border-[#D8D8D8] text-[15px] focus:outline-none focus:border-[#4880FF] focus:bg-white"
        />
      </div>

      <div>
        <label className="block text-[15px] font-semibold text-[#202224]/80 mb-2">
          Mã OTP:
        </label>
        <input
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
