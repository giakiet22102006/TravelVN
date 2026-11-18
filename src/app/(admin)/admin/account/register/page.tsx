"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AdminAuthCard } from "@/components/admin/AdminAuthCard";

const ALLOW_PUBLIC_REGISTER =
  process.env.NEXT_PUBLIC_ALLOW_ADMIN_REGISTER === "true";

export default function AdminRegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (!ALLOW_PUBLIC_REGISTER) {
    return (
      <AdminAuthCard
        title="Đăng Ký Nội Bộ"
        subtitle="Tài khoản quản trị do Quản trị viên hệ thống cấp phát"
      >
        <div className="space-y-5 text-center">
          <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-4 font-medium leading-relaxed">
            Để đảm bảo an toàn hệ thống, chức năng tự đăng ký quản trị viên công khai đã được tắt. Vui lòng liên hệ Quản trị viên để được tạo tài khoản và phân quyền.
          </div>
          <Link
            href="/admin/account/login"
            className="w-full h-12 rounded-lg bg-[#4880FF] hover:bg-[#3a6ce0] text-white font-bold text-base transition-colors inline-flex items-center justify-center"
          >
            Quay lại Đăng nhập
          </Link>
        </div>
      </AdminAuthCard>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          phone,
          password,
          acceptTerms,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Đăng ký thất bại");
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
      title="Đăng Ký"
      subtitle="Tạo một tài khoản để tiếp tục"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
          <label className="block text-sm font-semibold text-[#202224]/80 mb-1.5">
            Họ tên:
          </label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ví dụ: Lê Văn A"
            className="w-full h-11 px-4 rounded-lg bg-[#F1F4F9] border border-[#D8D8D8] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#202224]/80 mb-1.5">
            Email:
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Ví dụ: levana@gmail.com"
            className="w-full h-11 px-4 rounded-lg bg-[#F1F4F9] border border-[#D8D8D8] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#202224]/80 mb-1.5">
            Số điện thoại:
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0123456789"
            className="w-full h-11 px-4 rounded-lg bg-[#F1F4F9] border border-[#D8D8D8] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#202224]/80 mb-1.5">
            Mật khẩu:
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Ít nhất 6 ký tự"
            className="w-full h-11 px-4 rounded-lg bg-[#F1F4F9] border border-[#D8D8D8] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
          />
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="w-4 h-4 rounded accent-[#4880FF]"
          />
          <span className="text-sm font-semibold text-[#202224]/75">
            Tôi chấp nhận các điều khoản và điều kiện
          </span>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-lg bg-[#4880FF] hover:bg-[#3a6ce0] text-white font-bold text-base transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Đăng Ký
        </button>

        <p className="text-center text-sm font-semibold text-[#202224]/70 pt-1">
          Bạn đã có tài khoản?{" "}
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
