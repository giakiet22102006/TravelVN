"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AdminAuthCard } from "@/components/admin/AdminAuthCard";

export default function AdminResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Không thể đổi mật khẩu");
        return;
      }
      setSuccess(data.message);
      setTimeout(() => router.push("/admin/account/login"), 1200);
    } catch {
      setError("Không thể kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminAuthCard
      title="Đổi mật khẩu"
      subtitle="Vui lòng nhập mật khẩu để tiếp tục"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 font-medium">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 font-medium">
            {success}
          </div>
        )}

        <div>
          <label className="block text-[15px] font-semibold text-[#202224]/80 mb-2">
            Mật khẩu mới:
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nhập mật khẩu mới"
            className="w-full h-12 px-4 rounded-lg bg-[#F1F4F9] border border-[#D8D8D8] text-[15px] focus:outline-none focus:border-[#4880FF] focus:bg-white"
          />
        </div>

        <div>
          <label className="block text-[15px] font-semibold text-[#202224]/80 mb-2">
            Xác nhận mật khẩu:
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Nhập lại mật khẩu mới"
            className="w-full h-12 px-4 rounded-lg bg-[#F1F4F9] border border-[#D8D8D8] text-[15px] focus:outline-none focus:border-[#4880FF] focus:bg-white"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-lg bg-[#4880FF] hover:bg-[#3a6ce0] text-white font-bold text-base transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Thay đổi
        </button>

        <p className="text-center text-sm font-semibold text-[#202224]/70">
          Quay lại trang{" "}
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
