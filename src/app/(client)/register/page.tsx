"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Mail, Phone, User } from "lucide-react";
import { useClientMeta } from "@/components/client/ClientLayoutShell";
import { SocialOAuthButtons } from "@/components/client/SocialOAuthButtons";

export default function ClientRegisterPage() {
  const router = useRouter();
  const { setCurrentUser } = useClientMeta();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!fullName.trim()) {
      setError("Vui lòng nhập họ và tên.");
      return;
    }
    if (!email.trim()) {
      setError("Vui lòng nhập email.");
      return;
    }
    if (password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/client/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Đăng ký thất bại");
        return;
      }
      setCurrentUser(data.user);
      router.push("/account/orders");
      router.refresh();
    } catch {
      setError("Không thể kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-[480px] mx-auto px-4 py-10 sm:py-14">
      <div className="bg-white rounded-[16px] border border-[#ECECEC] p-6 sm:p-8 shadow-md">
        <div className="text-center mb-6">
          <h1 className="text-[24px] font-bold text-[#4502C7]">
            Tạo Tài Khoản Khách Hàng
          </h1>
          <p className="text-[13px] text-[#667479] mt-1.5">
            Đặt tour nhanh hơn và lưu toàn bộ lịch sử chuyến đi của bạn tại
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
              htmlFor="register-fullName"
              className="block text-[13px] font-semibold text-[#25282B] mb-1.5"
            >
              Họ và tên <span className="text-[#DA0808]">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-[#99A2A5] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="register-fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nguyễn Văn An"
                className="w-full h-[44px] pl-10 pr-3.5 rounded-[10px] border border-[#CCD1D2] text-[14px] focus:outline-none focus:border-[#4502C7]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="register-email"
              className="block text-[13px] font-semibold text-[#25282B] mb-1.5"
            >
              Email <span className="text-[#DA0808]">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#99A2A5] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="register-email"
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
              htmlFor="register-phone"
              className="block text-[13px] font-semibold text-[#25282B] mb-1.5"
            >
              Số điện thoại
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-[#99A2A5] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="register-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0912345678"
                className="w-full h-[44px] pl-10 pr-3.5 rounded-[10px] border border-[#CCD1D2] text-[14px] focus:outline-none focus:border-[#4502C7]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="register-password"
              className="block text-[13px] font-semibold text-[#25282B] mb-1.5"
            >
              Mật khẩu <span className="text-[#DA0808]">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#99A2A5] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="register-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ít nhất 6 ký tự"
                autoComplete="new-password"
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
            Đăng Ký Tài Khoản
          </button>
        </form>

        <div className="mt-5">
          <SocialOAuthButtons redirectTo="/account/orders" />
        </div>

        <p className="text-center text-[13px] text-[#667479] mt-6">
          Đã có tài khoản?{" "}
          <Link
            href="/login"
            className="text-[#4502C7] font-bold hover:underline"
          >
            Đăng nhập ngay
          </Link>
        </p>
      </div>
    </div>
  );
}
