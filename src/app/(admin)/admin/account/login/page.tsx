"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AdminAuthCard } from "@/components/admin/AdminAuthCard";

const SHOW_DEMO_HINT =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_SHOW_DEMO_LOGIN === "true";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberPassword, setRememberPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Đăng nhập thất bại");
        return;
      }
      router.push("/admin/tours");
      router.refresh();
    } catch {
      setError("Không thể kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminAuthCard
      title="Đăng Nhập"
      subtitle="Vui lòng nhập email và mật khẩu để tiếp tục"
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
            placeholder="example@vntravel.com"
            autoComplete="email"
            className="w-full h-12 px-4 rounded-lg bg-[#F1F4F9] border border-[#D8D8D8] text-[15px] text-[#202224] focus:outline-none focus:border-[#4880FF] focus:bg-white"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[15px] font-semibold text-[#202224]/80">
              Mật khẩu:
            </label>
            <Link
              href="/admin/account/forgot-password"
              className="text-sm font-semibold text-[#202224]/60 hover:text-[#4880FF]"
            >
              Quên mật khẩu?
            </Link>
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="w-full h-12 px-4 rounded-lg bg-[#F1F4F9] border border-[#D8D8D8] text-[15px] text-[#202224] focus:outline-none focus:border-[#4880FF] focus:bg-white"
          />
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={rememberPassword}
            onChange={(e) => setRememberPassword(e.target.checked)}
            className="w-4 h-4 rounded accent-[#4880FF]"
          />
          <span className="text-sm font-semibold text-[#202224]/70">
            Nhớ mật khẩu
          </span>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-lg bg-[#4880FF] hover:bg-[#3a6ce0] text-white font-bold text-base transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Đăng Nhập
        </button>

        {SHOW_DEMO_HINT && (
          <div className="rounded-lg bg-[#F5F6FA] border border-[#E0E0E0] px-4 py-2.5 text-xs text-[#667479] text-center">
            Môi trường Dev Local — sử dụng tài khoản quản trị đã seed để đăng nhập.
          </div>
        )}

        <p className="text-center text-sm font-semibold text-[#202224]/70 pt-1">
          Bạn chưa có tài khoản?{" "}
          <Link
            href="/admin/account/register"
            className="text-[#4880FF] hover:underline font-bold"
          >
            Tạo tài khoản
          </Link>
        </p>
      </form>
    </AdminAuthCard>
  );
}
