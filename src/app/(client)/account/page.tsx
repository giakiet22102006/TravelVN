"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ImagePlus,
  KeyRound,
  Loader2,
  Save,
  UserCheck,
  UserCircle,
  X,
} from "lucide-react";
import { useClientMeta } from "@/components/client/ClientLayoutShell";
import { AccountSidebar } from "@/components/client/AccountSidebar";
import { uploadImageFile } from "@/lib/client-image-upload";
import { enhanceImageUrl } from "@/lib/image-quality";

function ClientAvatarUploader({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    setPreviewError(false);
  }, [value]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setUploading(true);
    try {
      const result = await uploadImageFile(file);
      if (!result.ok || !result.url) {
        setError(result.message || "Tải ảnh thất bại");
        return;
      }
      onChange(result.url);
    } catch {
      setError("Không thể kết nối máy chủ tải ảnh");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <label
        htmlFor="account-avatar-url"
        className="block text-[13px] font-semibold text-[#25282B]"
      >
        Ảnh đại diện
      </label>

      <div className="flex flex-col sm:flex-row items-start gap-4">
        <div className="relative w-28 h-28 rounded-2xl border-2 border-dashed border-[#D6CCF4] bg-[#F8F7FC] overflow-hidden shrink-0">
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            aria-label="Chọn ảnh đại diện để tải lên"
            className="w-full h-full flex flex-col items-center justify-center hover:bg-[#F3EEFF] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4502C7]/50"
          >
            {uploading ? (
              <Loader2 className="w-6 h-6 text-[#4502C7] animate-spin" />
            ) : value && !previewError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={enhanceImageUrl(value, 320, 88)}
                alt="Ảnh đại diện hiện tại"
                onError={() => setPreviewError(true)}
                className="w-full h-full object-cover"
              />
            ) : value && previewError ? (
              <div className="flex flex-col items-center text-[#4502C7] px-2 text-center">
                <UserCircle className="w-8 h-8 mb-1 opacity-70" />
                <span className="text-[11px] font-medium">Ảnh lỗi, đổi ảnh</span>
              </div>
            ) : (
              <div className="flex flex-col items-center text-[#4502C7] px-2 text-center">
                <ImagePlus className="w-6 h-6 mb-1" />
                <span className="text-[11px] font-semibold">Tải ảnh lên</span>
              </div>
            )}
          </button>

          {value && !uploading && (
            <button
              type="button"
              onClick={() => onChange("")}
              aria-label="Xóa ảnh đại diện"
              title="Xóa ảnh đại diện"
              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/65 text-white flex items-center justify-center hover:bg-[#DA0808] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex-1 w-full space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="px-3.5 h-[38px] rounded-[8px] border border-[#4502C7] text-[#4502C7] hover:bg-[#4502C7] hover:text-white text-[13px] font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
            >
              <ImagePlus className="w-4 h-4" />
              <span>{uploading ? "Đang tải..." : "Chọn ảnh từ máy"}</span>
            </button>
          </div>
          <input
            id="account-avatar-url"
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => {
              if (value.trim()) {
                onChange(enhanceImageUrl(value, 1600, 90));
              }
            }}
            placeholder="Hoặc dán URL ảnh (https://...)"
            className="w-full h-[42px] px-3.5 rounded-[8px] border border-[#CCD1D2] bg-white text-[13px] text-[#25282B] placeholder:text-[#667085] focus:outline-none focus:border-[#4502C7] focus-visible:ring-2 focus-visible:ring-[#4502C7]/40"
          />
          <p className="text-[12px] text-[#667479]">
            Hỗ trợ PNG, JPG, WebP (tối đa 10MB).
          </p>
          {error && (
            <p role="alert" className="text-[12px] text-[#DA0808] font-medium">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

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

            <ClientAvatarUploader value={avatar} onChange={setAvatar} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="account-fullName"
                  className="block text-[13px] font-semibold text-[#25282B] mb-1.5"
                >
                  Họ và tên <span className="text-[#DA0808]">*</span>
                </label>
                <input
                  id="account-fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-[42px] px-3.5 rounded-[8px] border border-[#CCD1D2] text-[14px] focus:outline-none focus:border-[#4502C7] focus-visible:ring-2 focus-visible:ring-[#4502C7]/40"
                />
              </div>

              <div>
                <label
                  htmlFor="account-email"
                  className="block text-[13px] font-semibold text-[#25282B] mb-1.5"
                >
                  Email
                </label>
                <input
                  id="account-email"
                  type="email"
                  disabled
                  value={currentUser.email}
                  className="w-full h-[42px] px-3.5 rounded-[8px] border border-[#ECECEC] bg-[#F6F6F6] text-[#667479] text-[14px]"
                />
              </div>

              <div>
                <label
                  htmlFor="account-phone"
                  className="block text-[13px] font-semibold text-[#25282B] mb-1.5"
                >
                  Số điện thoại
                </label>
                <input
                  id="account-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ví dụ: 0912345678"
                  className="w-full h-[42px] px-3.5 rounded-[8px] border border-[#CCD1D2] text-[14px] placeholder:text-[#667085] focus:outline-none focus:border-[#4502C7] focus-visible:ring-2 focus-visible:ring-[#4502C7]/40"
                />
              </div>

              <div>
                <label
                  htmlFor="account-address"
                  className="block text-[13px] font-semibold text-[#25282B] mb-1.5"
                >
                  Địa chỉ
                </label>
                <input
                  id="account-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Địa chỉ liên hệ..."
                  className="w-full h-[42px] px-3.5 rounded-[8px] border border-[#CCD1D2] text-[14px] placeholder:text-[#667085] focus:outline-none focus:border-[#4502C7] focus-visible:ring-2 focus-visible:ring-[#4502C7]/40"
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
                  <label
                    htmlFor="account-current-password"
                    className="block text-[13px] font-semibold text-[#25282B] mb-1.5"
                  >
                    Mật khẩu hiện tại
                  </label>
                  <input
                    id="account-current-password"
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-[42px] px-3.5 rounded-[8px] border border-[#CCD1D2] text-[14px] focus:outline-none focus:border-[#4502C7] focus-visible:ring-2 focus-visible:ring-[#4502C7]/40"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="account-new-password"
                  className="block text-[13px] font-semibold text-[#25282B] mb-1.5"
                >
                  Mật khẩu mới
                </label>
                <input
                  id="account-new-password"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Ít nhất 6 ký tự"
                  className="w-full h-[42px] px-3.5 rounded-[8px] border border-[#CCD1D2] text-[14px] placeholder:text-[#667085] focus:outline-none focus:border-[#4502C7] focus-visible:ring-2 focus-visible:ring-[#4502C7]/40"
                />
              </div>

              <div>
                <label
                  htmlFor="account-confirm-password"
                  className="block text-[13px] font-semibold text-[#25282B] mb-1.5"
                >
                  Xác nhận mật khẩu mới
                </label>
                <input
                  id="account-confirm-password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  className="w-full h-[42px] px-3.5 rounded-[8px] border border-[#CCD1D2] text-[14px] placeholder:text-[#667085] focus:outline-none focus:border-[#4502C7] focus-visible:ring-2 focus-visible:ring-[#4502C7]/40"
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
