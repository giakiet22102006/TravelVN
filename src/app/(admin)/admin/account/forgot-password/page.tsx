"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AdminAuthCard } from "@/components/admin/AdminAuthCard";

export default function AdminForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Không thể gửi mã OTP");
        return;
      }
      const query = new URLSearchParams({ email });
      if (data.demoOtp) {
        query.set("demoOtp", data.demoOtp);
      }
      router.push(`/admin/account/otp-password?${query.toString()}`);
    } catch {
      setError("Không thể kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminAuthCard
      title="Quên mật khẩu"
      subtitle="Vui lòng nhập email để tiếp tục"
    >
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
            placeholder="Ví dụ: levana@gmail.com"
            className="w-full h-12 px-4 rounded-lg bg-[#F1F4F9] border border-[#D8D8D8] text-[15px] focus:outline-none focus:border-[#4880FF] focus:bg-white"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-lg bg-[#4880FF] hover:bg-[#3a6ce0] text-white font-bold text-base transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Gửi mã OTP
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
    </AdminAuthCard>
  );
}
