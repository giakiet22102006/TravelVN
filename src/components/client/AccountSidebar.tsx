"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Award,
  ClipboardList,
  Coins,
  Heart,
  LogOut,
  User,
  UserCircle,
  Users,
} from "lucide-react";
import { useClientMeta } from "./ClientLayoutShell";
import { enhanceImageUrl } from "@/lib/image-quality";
import { computeMemberTier } from "@/lib/loyalty";
import type { MemberTier } from "@/types/ota";

const TIER_BADGE_MAP: Record<MemberTier, { label: string; cls: string }> = {
  GOLD: {
    label: "Thành viên Vàng",
    cls: "bg-client-sun/25 border-client-sun text-ink",
  },
  SILVER: {
    label: "Thành viên Bạc",
    cls: "bg-client-soft border-client-border text-client-primary",
  },
  BRONZE: {
    label: "Thành viên Đồng",
    cls: "bg-surface-muted border-strong text-ink-muted",
  },
};

export function AccountSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, logoutUser } = useClientMeta();
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setAvatarError(false);
  }, [currentUser?.avatar]);

  async function handleLogout() {
    await logoutUser();
    router.push("/");
    router.refresh();
  }

  const loyaltyPoints = currentUser?.loyaltyPoints ?? 0;
  const lifetimePoints = currentUser?.lifetimePoints ?? 0;
  const computedTier = computeMemberTier(lifetimePoints);
  const memberTier: MemberTier = currentUser?.memberTier ?? computedTier.tier;
  const tierBadge = TIER_BADGE_MAP[memberTier];

  return (
    <aside className="bg-white rounded-[16px] border border-subtle p-5 shadow-sm space-y-4">
      {currentUser && (
        <div className="pb-4 border-b border-subtle space-y-3">
          <div className="flex items-center gap-3">
            {currentUser.avatar && !avatarError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={enhanceImageUrl(currentUser.avatar, 200, 90)}
                alt={currentUser.fullName}
                onError={() => setAvatarError(true)}
                className="w-12 h-12 rounded-full object-cover border border-subtle shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-client-soft text-client-primary flex items-center justify-center shrink-0">
                <UserCircle className="w-7 h-7" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold text-ink truncate">
                {currentUser.fullName}
              </p>
              <p className="text-[12px] text-ink-muted truncate">
                {currentUser.email}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${tierBadge.cls}`}
            >
              <Award className="w-3.5 h-3.5 shrink-0" />
              <span>{tierBadge.label}</span>
            </span>
            <Link
              href="/account"
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-client-soft border border-client-border text-client-primary hover:bg-client-border/40 text-[12px] font-bold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-client-primary/40"
            >
              <Coins className="w-3.5 h-3.5 shrink-0" />
              <span>{loyaltyPoints.toLocaleString("vi-VN")} điểm</span>
            </Link>
          </div>
        </div>
      )}

      <nav className="space-y-1 text-[14px] font-medium">
        <Link
          href="/account/orders"
          className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-client-primary/40 ${
            pathname === "/account/orders"
              ? "bg-client-primary text-white font-semibold"
              : "text-ink hover:bg-client-soft hover:text-client-primary"
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>Đơn hàng của tôi</span>
        </Link>

        <Link
          href="/account/travelers"
          className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-client-primary/40 ${
            pathname === "/account/travelers"
              ? "bg-client-primary text-white font-semibold"
              : "text-ink hover:bg-client-soft hover:text-client-primary"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Sổ hành khách</span>
        </Link>

        <Link
          href="/account/wishlist"
          className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-client-primary/40 ${
            pathname === "/account/wishlist"
              ? "bg-client-primary text-white font-semibold"
              : "text-ink hover:bg-client-soft hover:text-client-primary"
          }`}
        >
          <Heart className="w-4 h-4" />
          <span>Tour yêu thích</span>
        </Link>

        <Link
          href="/account"
          className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-client-primary/40 ${
            pathname === "/account"
              ? "bg-client-primary text-white font-semibold"
              : "text-ink hover:bg-client-soft hover:text-client-primary"
          }`}
        >
          <User className="w-4 h-4" />
          <span>Hồ sơ &amp; Mật khẩu</span>
        </Link>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] text-status-danger hover:bg-status-danger-bg hover:text-status-danger transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-danger/40 text-left"
        >
          <LogOut className="w-4 h-4" />
          <span>Đăng xuất</span>
        </button>
      </nav>
    </aside>
  );
}
