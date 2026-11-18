"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, KeyRound, Loader2, Save, UserCheck } from "lucide-react";
import { useClientMeta } from "@/components/client/ClientLayoutShell";
import { AccountSidebar } from "@/components/client/AccountSidebar";
import { ImageUploadBox } from "@/components/admin/ImageUploadBox";

export default function CustomerAccountPage() {
  const { currentUser, setCurrentUser } = useClientMeta();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [avatar, setAvatar] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.fullName || "");
      setPhone(currentUser.phone || "");
      setAddress(currentUser.address || "");
      setAvatar(currentUser.avatar || "");
    }
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="max-w-[680px] mx-auto px-4 py-14 text-center">
        <div className="bg-white rounded-[16px] border border-[#ECECEC] p-8 shadow-sm space-y-4">
          <UserCheck className="w-12 h-12 mx-auto text-[#4502C7]" />
          <h1 className="text-[22px] font-bold text-[#25282B]">
            Vui lòng đăng nhập để quản lý tài khoản
          </h1>
          <p className="text-[14px] text-[#667479]">
            Đăng nhập bằng email hoặc tài khoản Google để cập nhật hồ sơ và theo
            dõi các tour bạn đã đặt.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <Link
              href="/login?next=/account"
              className="px-6 py-2.5 rounded-[10px] bg-[#4502C7] text-white font-semibold text-[14px] hover:bg-[#36019e]"
            >
              Đăng Nhập
            </Link>
            <Link
              href="/register"
              className="px-6 py-2.5 rounded-[10px] border border-[#CCD1D2] text-[#25282B] font-semibold text-[14px] hover:border-[#4502C7]"
            >
              Đăng Ký
            </Link>
          </div>
        </div>
      </div>
    );
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    setSavingProfile(true);
    try {
      const res = await fetch("/api/client/account/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          avatar: avatar.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProfileMsg({
          type: "error",
          text: data.message || "Không thể cập nhật hồ sơ",
        });
        return;
      }
      setCurrentUser(data.user);
      setProfileMsg({
        type: "success",
        text: data.message || "Cập nhật hồ sơ thành công!",
      });
    } catch {
      setProfileMsg({
        type: "error",
        text: "Không thể kết nối máy chủ",
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMsg(null);
    if (newPassword.length < 6) {
      setPasswordMsg({
        type: "error",
        text: "Mật khẩu mới phải có ít nhất 6 ký tự.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({
        type: "error",
        text: "Mật khẩu xác nhận không khớp.",
      });
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch("/api/client/account/change-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordMsg({
          type: "error",
          text: data.message || "Không thể cập nhật mật khẩu",
        });
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setCurrentUser((prev) => (prev ? { ...prev, hasPassword: true } : prev));
      setPasswordMsg({
        type: "success",
        text: data.message || "Cập nhật mật khẩu thành công!",
      });
    } catch {
      setPasswordMsg({
        type: "error",
        text: "Không thể kết nối máy chủ",
      });
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="max-w-[1120px] mx-auto px-4 py-8 sm:py-10">
      <h1 className="text-[24px] sm:text-[28px] font-bold text-[#4502C7] mb-6">
        Tài Khoản Cá Nhân
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4">
          <AccountSidebar />
        </div>

        <div className="lg:col-span-8 space-y-6">
          {/* Profile Card */}
          <form
            onSubmit={handleSaveProfile}
            className="bg-white rounded-[16px] border border-[#ECECEC] p-6 shadow-sm space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#ECECEC]">
              <h2 className="text-[18px] font-bold text-[#25282B]">
                Thông tin cá nhân
              </h2>
              <span className="text-[12px] px-2.5 py-1 rounded-full bg-[#4502C7]/10 text-[#4502C7] font-semibold">
                Đăng nhập: {currentUser.provider}
              </span>
            </div>

            {profileMsg && (
              <div
                role="alert"
                className={`p-3 rounded-[10px] text-[13px] font-medium flex items-center gap-2 ${
                  profileMsg.type === "success"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 text-[#DA0808] border border-red-200"
                }`}
              >
                {profileMsg.type === "success" && (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                )}
                <span>{profileMsg.text}</span>
              </div>
            )}

            <ImageUploadBox
              label="Ảnh đại diện"
              value={avatar}
              onChange={setAvatar}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-semibold text-[#25282B] mb-1.5">
                  Họ và tên <span className="text-[#DA0808]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-[42px] px-3.5 rounded-[8px] border border-[#CCD1D2] text-[14px] focus:outline-none focus:border-[#4502C7]"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#25282B] mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  disabled
                  value={currentUser.email}
                  className="w-full h-[42px] px-3.5 rounded-[8px] border border-[#ECECEC] bg-[#F6F6F6] text-[#667479] text-[14px]"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#25282B] mb-1.5">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ví dụ: 0912345678"
                  className="w-full h-[42px] px-3.5 rounded-[8px] border border-[#CCD1D2] text-[14px] focus:outline-none focus:border-[#4502C7]"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#25282B] mb-1.5">
                  Địa chỉ
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Địa chỉ liên hệ..."
                  className="w-full h-[42px] px-3.5 rounded-[8px] border border-[#CCD1D2] text-[14px] focus:outline-none focus:border-[#4502C7]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="px-6 h-[42px] rounded-[10px] bg-[#4502C7] hover:bg-[#36019e] text-white text-[14px] font-semibold inline-flex items-center gap-2 transition-colors disabled:opacity-60"
            >
              {savingProfile ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Lưu thay đổi</span>
            </button>
          </form>

          {/* Password Card */}
          <form
            onSubmit={handleSavePassword}
            className="bg-white rounded-[16px] border border-[#ECECEC] p-6 shadow-sm space-y-4"
          >
            <h2 className="text-[18px] font-bold text-[#25282B] flex items-center gap-2 pb-3 border-b border-[#ECECEC]">
              <KeyRound className="w-5 h-5 text-[#4502C7]" />
              <span>
                {currentUser.hasPassword
                  ? "Đổi mật khẩu đăng nhập"
                  : "Thiết lập mật khẩu bổ sung"}
              </span>
            </h2>

            {passwordMsg && (
              <div
                role="alert"
                className={`p-3 rounded-[10px] text-[13px] font-medium ${
                  passwordMsg.type === "success"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 text-[#DA0808] border border-red-200"
                }`}
              >
                {passwordMsg.text}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {currentUser.hasPassword && (
                <div className="sm:col-span-2">
                  <label className="block text-[13px] font-semibold text-[#25282B] mb-1.5">
                    Mật khẩu hiện tại
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-[42px] px-3.5 rounded-[8px] border border-[#CCD1D2] text-[14px] focus:outline-none focus:border-[#4502C7]"
                  />
                </div>
              )}

              <div>
                <label className="block text-[13px] font-semibold text-[#25282B] mb-1.5">
                  Mật khẩu mới
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Ít nhất 6 ký tự"
                  className="w-full h-[42px] px-3.5 rounded-[8px] border border-[#CCD1D2] text-[14px] focus:outline-none focus:border-[#4502C7]"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#25282B] mb-1.5">
                  Xác nhận mật khẩu mới
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  className="w-full h-[42px] px-3.5 rounded-[8px] border border-[#CCD1D2] text-[14px] focus:outline-none focus:border-[#4502C7]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingPassword}
              className="px-6 h-[42px] rounded-[10px] border border-[#4502C7] text-[#4502C7] hover:bg-[#4502C7] hover:text-white text-[14px] font-semibold inline-flex items-center gap-2 transition-colors disabled:opacity-60"
            >
              {savingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>
                {currentUser.hasPassword ? "Cập nhật mật khẩu" : "Đặt mật khẩu"}
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
