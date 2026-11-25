"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Award,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  Gift,
  History,
  ImagePlus,
  KeyRound,
  Loader2,
  Lock,
  Save,
  Tag,
  UserCheck,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { useClientMeta } from "@/components/client/ClientLayoutShell";
import { AccountSidebar } from "@/components/client/AccountSidebar";
import { uploadImageFile } from "@/lib/client-image-upload";
import { enhanceImageUrl } from "@/lib/image-quality";
import { formatCurrencyVND, formatDateTimeVN } from "@/lib/format";
import { computeMemberTier } from "@/lib/loyalty";
import type {
  LoyaltyTransactionItem,
  LoyaltyTransactionType,
  MemberTier,
  MemberTierInfo,
} from "@/types/ota";

interface MemberCouponItem {
  code: string;
  title: string;
  discountType: "fixed" | "percent";
  value: number;
  maxDiscountVND: number;
  description: string;
  memberOnly: boolean;
  minOrderVND: number | null;
  minTier: MemberTier | null;
  allowPaidOrderBypass: boolean;
  eligibility: {
    eligible: boolean;
    requiresAuth?: boolean;
    reason?: string;
  };
}

interface LoyaltySummaryResponse {
  loyaltyPoints: number;
  lifetimePoints: number;
  tierInfo: MemberTierInfo;
  paidOrderCount: number;
  coupons: MemberCouponItem[];
  transactions: LoyaltyTransactionItem[];
}

const TIER_STYLES: Record<MemberTier, { badgeCls: string; nextLabel: string }> = {
  BRONZE: {
    badgeCls: "bg-surface-muted border-strong text-ink-muted",
    nextLabel: "Thành viên Bạc",
  },
  SILVER: {
    badgeCls: "bg-client-soft border-client-border text-client-primary",
    nextLabel: "Thành viên Vàng",
  },
  GOLD: {
    badgeCls: "bg-client-sun/25 border-client-sun text-ink",
    nextLabel: "",
  },
};

const TX_TYPE_META: Record<
  LoyaltyTransactionType,
  { label: string; badgeCls: string }
> = {
  WELCOME_BONUS: {
    label: "Quà chào mừng",
    badgeCls:
      "bg-status-success-bg text-status-success border-status-success-border",
  },
  ORDER_EARN: {
    label: "Tích điểm",
    badgeCls:
      "bg-status-success-bg text-status-success border-status-success-border",
  },
  ORDER_REDEEM: {
    label: "Đổi điểm",
    badgeCls: "bg-client-soft text-client-primary border-client-border",
  },
  ORDER_REDEEM_REFUND: {
    label: "Hoàn điểm",
    badgeCls: "bg-status-warn-bg text-status-warn border-status-warn-border",
  },
  ORDER_REFUND_REVOKE: {
    label: "Thu hồi điểm",
    badgeCls:
      "bg-status-danger-bg text-status-danger border-status-danger-border",
  },
};

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
        className="block text-[13px] font-semibold text-ink"
      >
        Ảnh đại diện
      </label>

      <div className="flex flex-col sm:flex-row items-start gap-4">
        <div className="relative w-28 h-28 rounded-2xl border-2 border-dashed border-client-border bg-client-soft/50 overflow-hidden shrink-0">
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            aria-label="Chọn ảnh đại diện để tải lên"
            className="w-full h-full flex flex-col items-center justify-center hover:bg-client-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-client-primary/40"
          >
            {uploading ? (
              <Loader2 className="w-6 h-6 text-client-primary animate-spin" />
            ) : value && !previewError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={enhanceImageUrl(value, 320, 88)}
                alt="Ảnh đại diện hiện tại"
                onError={() => setPreviewError(true)}
                className="w-full h-full object-cover"
              />
            ) : value && previewError ? (
              <div className="flex flex-col items-center text-client-primary px-2 text-center">
                <UserCircle className="w-8 h-8 mb-1 opacity-70" />
                <span className="text-[11px] font-medium">Ảnh lỗi, đổi ảnh</span>
              </div>
            ) : (
              <div className="flex flex-col items-center text-client-primary px-2 text-center">
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
              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/65 text-white flex items-center justify-center hover:bg-status-danger transition-colors"
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
              className="px-3.5 h-[38px] rounded-[8px] border border-client-primary text-client-primary hover:bg-client-primary hover:text-white text-[13px] font-semibold inline-flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-client-primary/40 disabled:opacity-60"
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
            className="w-full h-[42px] px-3.5 rounded-[8px] border border-strong bg-white text-[13px] text-ink placeholder:text-ink-muted focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/40"
          />
          <p className="text-[12px] text-ink-muted tabular-nums">
            Hỗ trợ PNG, JPG, WebP (tối đa 10MB).
          </p>
          {error && (
            <p role="alert" className="text-[12px] text-status-danger font-medium">
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

  const [loyaltyData, setLoyaltyData] = useState<LoyaltySummaryResponse | null>(
    null
  );
  const [loyaltyLoading, setLoyaltyLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentUserId = currentUser?.id ?? null;

  const fetchLoyalty = useCallback(async () => {
    if (!currentUserId) {
      setLoyaltyData(null);
      setLoyaltyLoading(false);
      return;
    }
    setLoyaltyLoading(true);
    try {
      const res = await fetch("/api/client/account/loyalty");
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as LoyaltySummaryResponse;
      setLoyaltyData(data);
    } catch {
      // Keep graceful fallback from currentUser
    } finally {
      setLoyaltyLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchLoyalty();
  }, [fetchLoyalty]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.fullName || "");
      setPhone(currentUser.phone || "");
      setAddress(currentUser.address || "");
      setAvatar(currentUser.avatar || "");
    }
  }, [currentUser]);

  async function handleCopyCoupon(code: string) {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Clipboard API fallback ignored if denied
    }
    setCopiedCode(code);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => {
      setCopiedCode((prev) => (prev === code ? null : prev));
    }, 2000);
  }

  if (!currentUser) {
    return (
      <div className="max-w-[680px] mx-auto px-4 py-14 text-center">
        <div className="bg-white rounded-[16px] border border-subtle p-8 shadow-sm space-y-4">
          <UserCheck className="w-12 h-12 mx-auto text-client-primary" />
          <h1 className="text-[22px] font-bold text-ink">
            Vui lòng đăng nhập để quản lý tài khoản
          </h1>
          <p className="text-[14px] text-ink-muted">
            Đăng nhập bằng email hoặc tài khoản Google để cập nhật hồ sơ và theo
            dõi các tour bạn đã đặt.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <Link
              href="/login?next=/account"
              className="px-6 py-2.5 rounded-[10px] bg-client-primary text-white font-semibold text-[14px] hover:bg-client-primary-hover transition-colors"
            >
              Đăng Nhập
            </Link>
            <Link
              href="/register"
              className="px-6 py-2.5 rounded-[10px] border border-strong text-ink font-semibold text-[14px] hover:border-client-primary hover:text-client-primary transition-colors"
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

  const loyaltyPoints =
    loyaltyData?.loyaltyPoints ?? currentUser.loyaltyPoints ?? 0;
  const lifetimePoints =
    loyaltyData?.lifetimePoints ?? currentUser.lifetimePoints ?? 0;
  const tierInfo = loyaltyData?.tierInfo ?? computeMemberTier(lifetimePoints);
  const tierStyle = TIER_STYLES[tierInfo.tier];
  const paidOrderCount = loyaltyData?.paidOrderCount ?? 0;
  const coupons = loyaltyData?.coupons ?? [];
  const transactions = loyaltyData?.transactions ?? [];

  return (
    <div className="max-w-[1120px] mx-auto px-4 py-8 sm:py-10">
      <h1 className="text-[24px] sm:text-[28px] font-bold text-ink mb-6">
        Tài Khoản Cá Nhân
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4">
          <AccountSidebar />
        </div>

        <div className="lg:col-span-8 space-y-6">
          {/* Tier & Points Wallet Card */}
          <section className="bg-white rounded-[16px] border border-subtle p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-subtle">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-client-primary" />
                <h2 className="text-[18px] font-bold text-ink">
                  Hạng Thành Viên &amp; Ví Điểm
                </h2>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1 rounded-full border ${tierStyle.badgeCls}`}
              >
                <Award className="w-3.5 h-3.5 shrink-0" />
                <span>{tierInfo.label}</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-[12px] bg-client-soft/60 border border-client-border p-4 space-y-1">
                <p className="text-[12px] font-medium text-ink-muted">
                  Điểm khả dụng
                </p>
                <p className="text-[24px] font-extrabold text-client-primary tabular-nums">
                  {loyaltyPoints.toLocaleString("vi-VN")} điểm
                </p>
                <p className="text-[13px] font-bold text-client-accent tabular-nums">
                  = {formatCurrencyVND(loyaltyPoints * 1000)}
                </p>
              </div>

              <div className="rounded-[12px] bg-surface-page border border-subtle p-4 space-y-1">
                <p className="text-[12px] font-medium text-ink-muted">
                  Tổng điểm tích lũy
                </p>
                <p className="text-[22px] font-extrabold text-ink tabular-nums">
                  {lifetimePoints.toLocaleString("vi-VN")} điểm
                </p>
                <p className="text-[12px] text-ink-muted tabular-nums">
                  Đơn đã thanh toán: {paidOrderCount} đơn
                </p>
              </div>

              <div className="rounded-[12px] bg-surface-page border border-subtle p-4 flex flex-col justify-between gap-2">
                <p className="text-[12px] text-ink-muted">
                  Tích 1% giá trị mỗi đơn thanh toán, đổi 1 điểm = 1.000đ (tối đa
                  20% đơn hàng).
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/account/travelers"
                    className="inline-flex items-center gap-1 text-[12px] font-semibold text-client-primary hover:underline"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Sổ hành khách</span>
                  </Link>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                <span className="font-semibold text-ink">
                  {tierInfo.nextTier
                    ? `Tiến độ lên ${tierStyle.nextLabel}`
                    : "Bạn đã đạt hạng thành viên cao nhất"}
                </span>
                <span className="text-ink-muted tabular-nums font-medium">
                  {tierInfo.nextTier && tierInfo.nextTierMinPoints !== null
                    ? `${lifetimePoints.toLocaleString("vi-VN")} / ${tierInfo.nextTierMinPoints.toLocaleString("vi-VN")} điểm (${tierInfo.progressPercent}%)`
                    : `${tierInfo.progressPercent}%`}
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={tierInfo.progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Tiến độ nâng hạng thành viên"
                className="w-full h-2.5 rounded-full bg-surface-muted border border-subtle overflow-hidden"
              >
                <div
                  className="h-full rounded-full bg-client-primary transition-all"
                  style={{ width: `${tierInfo.progressPercent}%` }}
                />
              </div>
              <p className="text-[12px] text-ink-muted tabular-nums">
                {tierInfo.nextTier
                  ? `Cần thêm ${tierInfo.pointsToNext.toLocaleString("vi-VN")} điểm tích lũy để lên ${tierStyle.nextLabel}.`
                  : "Tận hưởng trọn vẹn mọi mã ưu đãi và đặc quyền Thành viên Vàng."}
              </p>
            </div>
          </section>

          {/* Member-Exclusive Coupons Card */}
          <section className="bg-white rounded-[16px] border border-subtle p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-subtle">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-client-primary" />
                <h2 className="text-[18px] font-bold text-ink">
                  Ưu Đãi Thành Viên
                </h2>
              </div>
              <Link
                href="/cart"
                className="text-[13px] font-semibold text-client-primary hover:underline"
              >
                Đặt tour ngay →
              </Link>
            </div>

            <span role="status" className="sr-only">
              {copiedCode ? `Đã sao chép mã ${copiedCode}` : ""}
            </span>

            {loyaltyLoading && coupons.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-[118px] rounded-[12px] bg-surface-muted border border-subtle animate-pulse"
                  />
                ))}
              </div>
            ) : coupons.length === 0 ? (
              <p className="text-[13px] text-ink-muted">
                Hiện chưa có mã ưu đãi khả dụng.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {coupons.map((coupon) => {
                  const unlocked = coupon.eligibility.eligible;
                  const isCopied = copiedCode === coupon.code;
                  return (
                    <div
                      key={coupon.code}
                      className={`rounded-[12px] border p-4 flex flex-col justify-between gap-3 ${
                        coupon.memberOnly
                          ? "bg-surface-page border-client-border"
                          : "bg-white border-subtle"
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[6px] bg-client-soft border border-client-border text-client-primary text-[12px] font-bold tracking-wide">
                            <Tag className="w-3.5 h-3.5 shrink-0" />
                            <span>{coupon.code}</span>
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                              unlocked
                                ? "bg-status-success-bg border-status-success-border text-status-success"
                                : "bg-status-warn-bg border-status-warn-border text-status-warn"
                            }`}
                          >
                            {!unlocked && <Lock className="w-3 h-3 shrink-0" />}
                            <span>
                              {unlocked ? "Sẵn sàng" : "Chưa mở khóa"}
                            </span>
                          </span>
                        </div>
                        <p className="text-[14px] font-bold text-ink">
                          {coupon.title}
                        </p>
                        <p className="text-[12px] text-ink-muted leading-relaxed">
                          {coupon.description}
                        </p>
                        {!unlocked && coupon.eligibility.reason && (
                          <p className="text-[11px] font-medium text-status-warn">
                            {coupon.eligibility.reason}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-subtle">
                        <button
                          type="button"
                          onClick={() => handleCopyCoupon(coupon.code)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-client-border bg-client-soft text-client-primary hover:bg-client-border/40 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-client-primary/40"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-status-success" />
                              <span>Đã sao chép</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Sao chép mã</span>
                            </>
                          )}
                        </button>
                        <Link
                          href="/cart"
                          className="text-[12px] font-semibold text-client-primary hover:underline"
                        >
                          Dùng ngay
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Loyalty Transaction Ledger Card */}
          <section className="bg-white rounded-[16px] border border-subtle p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-subtle">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-client-primary" />
                <h2 className="text-[18px] font-bold text-ink">
                  Lịch Sử Điểm Thưởng
                </h2>
              </div>
              <span className="text-[12px] text-ink-muted tabular-nums">
                20 giao dịch gần nhất
              </span>
            </div>

            {loyaltyLoading && transactions.length === 0 ? (
              <div className="space-y-2.5">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-[52px] rounded-[10px] bg-surface-muted border border-subtle animate-pulse"
                  />
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-[13px] text-ink-muted py-2">
                Chưa có giao dịch điểm thưởng nào. Đặt tour hoặc liên kết đơn
                hàng để bắt đầu tích điểm!
              </p>
            ) : (
              <div className="divide-y divide-subtle">
                {transactions.map((tx) => {
                  const meta = TX_TYPE_META[tx.type] ?? {
                    label: tx.type,
                    badgeCls:
                      "bg-surface-muted text-ink-muted border-subtle",
                  };
                  const isPositive = tx.points > 0;
                  return (
                    <div
                      key={tx.id}
                      className="py-3 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${meta.badgeCls}`}
                          >
                            {meta.label}
                          </span>
                          <span className="text-[12px] text-ink-muted tabular-nums">
                            {formatDateTimeVN(tx.createdAt)}
                          </span>
                        </div>
                        <p className="text-[13px] text-ink">
                          {tx.description}
                        </p>
                      </div>
                      <span
                        className={`text-[14px] font-bold tabular-nums shrink-0 ${
                          isPositive
                            ? "text-status-success"
                            : "text-status-danger"
                        }`}
                      >
                        {isPositive ? `+${tx.points.toLocaleString("vi-VN")}` : tx.points.toLocaleString("vi-VN")}{" "}
                        điểm
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Profile Card */}
          <form
            onSubmit={handleSaveProfile}
            className="bg-white rounded-[16px] border border-subtle p-6 shadow-sm space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-subtle">
              <h2 className="text-[18px] font-bold text-ink">
                Thông tin cá nhân
              </h2>
              <span className="text-[12px] px-2.5 py-1 rounded-full bg-client-soft border border-client-border text-client-primary font-semibold">
                Đăng nhập: {currentUser.provider}
              </span>
            </div>

            {profileMsg && (
              <div
                role="alert"
                className={`p-3 rounded-[10px] text-[13px] font-medium flex items-center gap-2 ${
                  profileMsg.type === "success"
                    ? "bg-status-success-bg text-status-success border border-status-success-border"
                    : "bg-status-danger-bg text-status-danger border border-status-danger-border"
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
                  className="block text-[13px] font-semibold text-ink mb-1.5"
                >
                  Họ và tên <span className="text-status-danger">*</span>
                </label>
                <input
                  id="account-fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-[42px] px-3.5 rounded-[8px] border border-strong text-[14px] text-ink focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/40"
                />
              </div>

              <div>
                <label
                  htmlFor="account-email"
                  className="block text-[13px] font-semibold text-ink mb-1.5"
                >
                  Email
                </label>
                <input
                  id="account-email"
                  type="email"
                  disabled
                  value={currentUser.email}
                  className="w-full h-[42px] px-3.5 rounded-[8px] border border-subtle bg-surface-muted text-ink-muted text-[14px]"
                />
              </div>

              <div>
                <label
                  htmlFor="account-phone"
                  className="block text-[13px] font-semibold text-ink mb-1.5"
                >
                  Số điện thoại
                </label>
                <input
                  id="account-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ví dụ: 0912345678"
                  className="w-full h-[42px] px-3.5 rounded-[8px] border border-strong text-[14px] text-ink tabular-nums placeholder:text-ink-muted focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/40"
                />
              </div>

              <div>
                <label
                  htmlFor="account-address"
                  className="block text-[13px] font-semibold text-ink mb-1.5"
                >
                  Địa chỉ
                </label>
                <input
                  id="account-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Địa chỉ liên hệ..."
                  className="w-full h-[42px] px-3.5 rounded-[8px] border border-strong text-[14px] text-ink placeholder:text-ink-muted focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/40"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="px-6 h-[42px] rounded-[10px] bg-client-primary hover:bg-client-primary-hover text-white text-[14px] font-semibold inline-flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-client-primary/40 disabled:opacity-60"
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
            className="bg-white rounded-[16px] border border-subtle p-6 shadow-sm space-y-4"
          >
            <h2 className="text-[18px] font-bold text-ink flex items-center gap-2 pb-3 border-b border-subtle">
              <KeyRound className="w-5 h-5 text-client-primary" />
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
                    ? "bg-status-success-bg text-status-success border border-status-success-border"
                    : "bg-status-danger-bg text-status-danger border border-status-danger-border"
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
                    className="block text-[13px] font-semibold text-ink mb-1.5"
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
                    className="w-full h-[42px] px-3.5 rounded-[8px] border border-strong text-[14px] text-ink focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/40"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="account-new-password"
                  className="block text-[13px] font-semibold text-ink mb-1.5"
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
                  className="w-full h-[42px] px-3.5 rounded-[8px] border border-strong text-[14px] text-ink placeholder:text-ink-muted focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/40"
                />
              </div>

              <div>
                <label
                  htmlFor="account-confirm-password"
                  className="block text-[13px] font-semibold text-ink mb-1.5"
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
                  className="w-full h-[42px] px-3.5 rounded-[8px] border border-strong text-[14px] text-ink placeholder:text-ink-muted focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/40"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingPassword}
              className="px-6 h-[42px] rounded-[10px] border border-client-primary text-client-primary hover:bg-client-primary hover:text-white text-[14px] font-semibold inline-flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-client-primary/40 disabled:opacity-60"
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
