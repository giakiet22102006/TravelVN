"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Award,
  ChevronDown,
  ClipboardList,
  Coins,
  Heart,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Phone,
  ShoppingCart,
  User,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { useCart } from "./CartContext";
import { useWishlist } from "./WishlistContext";
import { useClientMeta } from "./ClientLayoutShell";
import { enhanceImageUrl } from "@/lib/image-quality";
import { computeMemberTier } from "@/lib/loyalty";
import type { MemberTier } from "@/types/ota";

export interface CategoryTreeItem {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  avatar: string | null;
  position: number;
  description: string | null;
  children: CategoryTreeItem[];
}

export interface WebsiteInfoData {
  id: string;
  websiteName: string;
  phone: string;
  email: string;
  address: string;
  logo: string | null;
  favicon: string | null;
}

interface ClientHeaderProps {
  categoryTree: CategoryTreeItem[];
  websiteInfo: WebsiteInfoData;
}

const HEADER_TIER_BADGES: Record<MemberTier, { label: string; cls: string }> = {
  GOLD: {
    label: "Hạng Vàng",
    cls: "bg-client-sun/25 border-client-sun text-ink",
  },
  SILVER: {
    label: "Hạng Bạc",
    cls: "bg-client-soft border-client-border text-client-primary",
  },
  BRONZE: {
    label: "Hạng Đồng",
    cls: "bg-surface-muted border-strong text-ink-muted",
  },
};

export function ClientHeader({
  categoryTree,
  websiteInfo,
}: ClientHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { totalItemCount, hydrated } = useCart();
  const { count: wishlistCount, hydrated: wishlistHydrated } = useWishlist();
  const { currentUser, logoutUser } = useClientMeta();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openMobileCategory, setOpenMobileCategory] = useState<string | null>(
    null
  );
  const [openDesktopCategory, setOpenDesktopCategory] = useState<string | null>(
    null
  );
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const desktopNavRef = useRef<HTMLElement>(null);

  const loyaltyPoints = currentUser?.loyaltyPoints ?? 0;
  const lifetimePoints = currentUser?.lifetimePoints ?? 0;
  const computedTier = computeMemberTier(lifetimePoints);
  const memberTier: MemberTier = currentUser?.memberTier ?? computedTier.tier;
  const tierBadge = HEADER_TIER_BADGES[memberTier];

  useEffect(() => {
    setAvatarError(false);
  }, [currentUser?.avatar]);

  useEffect(() => {
    setLogoError(false);
  }, [websiteInfo.logo]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (accountMenuRef.current && !accountMenuRef.current.contains(target)) {
        setAccountMenuOpen(false);
      }
      if (desktopNavRef.current && !desktopNavRef.current.contains(target)) {
        setOpenDesktopCategory(null);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setAccountMenuOpen(false);
        setOpenDesktopCategory(null);
        if (
          document.activeElement instanceof HTMLElement &&
          desktopNavRef.current?.contains(document.activeElement)
        ) {
          document.activeElement.blur();
        }
      }
    }
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileMenuOpen]);

  async function handleLogout() {
    setAccountMenuOpen(false);
    setMobileMenuOpen(false);
    await logoutUser();
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 w-full font-lexend-deca">
      {/* Top Bar */}
      <div className="bg-client-primary text-white text-[12px] py-2">
        <div className="max-w-[1184px] mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Phone className="w-3.5 h-3.5 shrink-0" />
              <span>{websiteInfo.phone || "1900 6868"}</span>
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 shrink-0" />
              <span>{websiteInfo.email || "contact@vn.travel.com"}</span>
            </span>
            <span className="hidden md:inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate max-w-[320px]">
                {websiteInfo.address || "285 Cách Mạng Tháng Tám, Quận 10, TP.HCM"}
              </span>
            </span>
          </div>

          {currentUser ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link
                href="/account"
                aria-label={`Ví điểm thưởng: ${loyaltyPoints.toLocaleString("vi-VN")} điểm`}
                className="inline-flex items-center gap-1 bg-white/15 hover:bg-white/25 text-white px-2.5 py-1 rounded-full font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <Coins className="w-3.5 h-3.5 text-client-sun shrink-0" />
                <span>{loyaltyPoints.toLocaleString("vi-VN")} điểm</span>
              </Link>

              <div ref={accountMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen((v) => !v)}
                  aria-expanded={accountMenuOpen}
                  aria-label="Menu tài khoản khách hàng"
                  className="inline-flex items-center gap-1.5 text-white hover:bg-white/20 bg-white/15 px-3 py-1 rounded-full font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  {currentUser.avatar && !avatarError ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={enhanceImageUrl(currentUser.avatar, 120, 85)}
                      alt={currentUser.fullName}
                      onError={() => setAvatarError(true)}
                      className="w-4 h-4 rounded-full object-cover"
                    />
                  ) : (
                    <UserCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span className="max-w-[105px] sm:max-w-[150px] truncate">
                    Xin chào, {currentUser.fullName}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${
                      accountMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {accountMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-[240px] bg-white text-ink rounded-[12px] shadow-[0_14px_34px_rgba(22,34,41,0.14)] border border-border-subtle py-1.5 z-50">
                    <div className="px-4 py-2.5 border-b border-border-subtle">
                      <p className="text-[13px] font-bold truncate">
                        {currentUser.fullName}
                      </p>
                      <p className="text-[11px] text-ink-muted truncate">
                        {currentUser.email}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-semibold ${tierBadge.cls}`}
                        >
                          <Award className="w-3 h-3 shrink-0" />
                          <span>{tierBadge.label}</span>
                        </span>
                        <span className="font-bold text-client-primary tabular-nums">
                          {loyaltyPoints.toLocaleString("vi-VN")} điểm
                        </span>
                      </div>
                    </div>
                    <Link
                      href="/account/orders"
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-[13px] hover:bg-client-soft hover:text-client-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-client-primary/40"
                    >
                      <ClipboardList className="w-4 h-4" />
                      <span>Đơn hàng của tôi</span>
                    </Link>
                    <Link
                      href="/account/travelers"
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-[13px] hover:bg-client-soft hover:text-client-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-client-primary/40"
                    >
                      <Users className="w-4 h-4" />
                      <span>Sổ hành khách</span>
                    </Link>
                    <Link
                      href="/account/wishlist"
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-[13px] hover:bg-client-soft hover:text-client-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-client-primary/40"
                    >
                      <Heart className="w-4 h-4" />
                      <span>Tour yêu thích</span>
                    </Link>
                    <Link
                      href="/account"
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-[13px] hover:bg-client-soft hover:text-client-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-client-primary/40"
                    >
                      <User className="w-4 h-4" />
                      <span>Tài khoản cá nhân</span>
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] text-status-danger hover:bg-status-danger-bg border-t border-border-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-danger/40"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-white/95 hover:text-white font-medium bg-white/15 hover:bg-white/25 px-3 py-0.5 rounded-full transition-colors"
              >
                <User className="w-3.5 h-3.5" />
                <span>Đăng nhập</span>
              </Link>
              <Link
                href="/register"
                className="hidden sm:inline-flex items-center text-white/90 hover:text-white font-medium hover:underline px-1.5 py-0.5 transition-colors"
              >
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="bg-white border-b border-border-subtle shadow-[0_2px_10px_rgba(22,34,41,0.04)]">
        <div className="max-w-[1184px] mx-auto px-4 h-[68px] flex items-center justify-between gap-4">
          {/* Mobile Menu Trigger */}
          <button
            type="button"
            aria-label="Mở menu điều hướng"
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden w-11 h-11 -ml-2 rounded-lg flex items-center justify-center text-ink hover:text-client-primary hover:bg-client-soft transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Logo VN.TRAVEL */}
          <Link
            href="/"
            className="flex items-center gap-2 shrink-0"
          >
            {websiteInfo.logo && !logoError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={websiteInfo.logo}
                alt={websiteInfo.websiteName || "VN.TRAVEL"}
                onError={() => setLogoError(true)}
                className="h-9 w-auto object-contain"
              />
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-client-primary text-white font-extrabold text-[14px] tracking-tight flex items-center justify-center shadow-sm">
                  VN
                </div>
                <span className="text-[22px] sm:text-[24px] font-extrabold tracking-tight text-client-primary">
                  {websiteInfo.websiteName || "VN.TRAVEL"}
                </span>
              </div>
            )}
          </Link>

          {/* Desktop Navigation */}
          <nav
            ref={desktopNavRef}
            className="hidden lg:flex items-center gap-7 text-[15px] font-medium text-ink"
          >
            <Link
              href="/"
              className={`py-2 transition-colors hover:text-client-primary ${
                pathname === "/" ? "text-client-primary font-semibold" : ""
              }`}
            >
              Trang Chủ
            </Link>

            {categoryTree.map((cat) => {
              const isCatOpen = openDesktopCategory === cat.id;
              return (
                <div key={cat.id} className="relative group py-2 flex items-center gap-0.5">
                  <Link
                    href={`/tours?category=${encodeURIComponent(cat.slug)}`}
                    onClick={() => setOpenDesktopCategory(null)}
                    className="inline-flex items-center text-ink hover:text-client-primary transition-colors"
                  >
                    <span>{cat.name}</span>
                  </Link>
                  {cat.children.length > 0 && (
                    <button
                      type="button"
                      aria-label={`Danh mục con ${cat.name}`}
                      aria-expanded={isCatOpen}
                      onClick={() =>
                        setOpenDesktopCategory(isCatOpen ? null : cat.id)
                      }
                      className="p-1 rounded text-ink hover:text-client-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-client-primary/40"
                    >
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${
                          isCatOpen
                            ? "rotate-180"
                            : "group-hover:rotate-180 group-focus-within:rotate-180"
                        }`}
                      />
                    </button>
                  )}

                  {cat.children.length > 0 && (
                    <div
                      className={`transition-opacity duration-75 absolute left-0 top-full pt-1 w-[240px] z-50 ${
                        isCatOpen
                          ? "visible opacity-100"
                          : "invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
                      }`}
                    >
                      <div className="bg-white rounded-[10px] shadow-[0_14px_34px_rgba(22,34,41,0.14)] border border-border-subtle py-2 overflow-hidden">
                        {cat.children.map((child) => (
                          <Link
                            key={child.id}
                            href={`/tours?category=${encodeURIComponent(child.slug)}`}
                            onClick={() => setOpenDesktopCategory(null)}
                            className="block px-4 py-2.5 text-[14px] text-ink hover:bg-client-soft hover:text-client-primary focus:bg-client-soft focus:text-client-primary transition-colors"
                          >
                            {child.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <Link
              href="/tours"
              prefetch={false}
              className={`py-2 transition-colors hover:text-client-primary ${
                pathname === "/tours" ? "text-client-primary font-semibold" : ""
              }`}
            >
              Tất Cả Tour
            </Link>

            <Link
              href="/news"
              className={`py-2 transition-colors hover:text-client-primary ${
                pathname === "/news" || pathname.startsWith("/news/")
                  ? "text-client-primary font-semibold"
                  : "text-ink"
              }`}
            >
              Tin Tức
            </Link>

            <Link
              href="/#footer-newsletter"
              className="py-2 text-ink hover:text-client-primary transition-colors"
            >
              Liên Hệ
            </Link>
          </nav>

          {/* Right Wishlist & Cart Triggers */}
          <div className="flex items-center gap-1 shrink-0">
            <Link
              href="/account/wishlist"
              aria-label="Tour yêu thích"
              className="relative inline-flex items-center gap-1.5 px-2.5 py-2 min-h-[44px] rounded-[10px] hover:bg-client-soft text-client-primary transition-colors shrink-0"
            >
              <Heart className="w-5 h-5" />
              <span
                className={`inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full bg-client-primary text-white text-[11px] font-bold tabular-nums transition-opacity duration-150 ${
                  wishlistHydrated && wishlistCount > 0 ? "opacity-100" : "opacity-0"
                }`}
              >
                {wishlistHydrated ? wishlistCount : 0}
              </span>
            </Link>

            <Link
              href="/cart"
              aria-label="Giỏ hàng"
              className="relative inline-flex items-center gap-2 px-2.5 sm:px-3 py-2 min-h-[44px] rounded-[10px] hover:bg-client-soft text-client-primary transition-colors shrink-0"
            >
              <ShoppingCart className="w-6 h-6" />
              <span
                className={`inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full bg-client-accent text-white text-[11px] font-bold tabular-nums transition-opacity duration-150 ${
                  hydrated ? "opacity-100" : "opacity-0"
                }`}
              >
                {hydrated ? totalItemCount : 0}
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu (375px optimized) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Menu điều hướng"
            className="relative z-10 w-[290px] max-w-[85vw] bg-white h-full shadow-2xl flex flex-col overflow-y-auto"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
              <span className="text-[20px] font-extrabold text-client-primary">
                {websiteInfo.websiteName || "VN.TRAVEL"}
              </span>
              <button
                type="button"
                aria-label="Đóng menu"
                onClick={() => setMobileMenuOpen(false)}
                className="w-11 h-11 -mr-2 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-1 flex-1 text-[15px] font-medium">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2.5 rounded-lg hover:bg-client-soft hover:text-client-primary transition-colors ${
                  pathname === "/"
                    ? "bg-client-soft text-client-primary font-semibold"
                    : "text-ink"
                }`}
              >
                Trang Chủ
              </Link>

              {categoryTree.map((cat) => {
                const isOpen = openMobileCategory === cat.id;
                return (
                  <div key={cat.id}>
                    <div className="flex items-center justify-between rounded-lg hover:bg-client-soft transition-colors">
                      <Link
                        href={`/tours?category=${encodeURIComponent(cat.slug)}`}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex-1 px-3 py-2.5 text-ink hover:text-client-primary transition-colors"
                      >
                        {cat.name}
                      </Link>
                      {cat.children.length > 0 && (
                        <button
                          type="button"
                          aria-label={
                            isOpen
                              ? `Thu gọn danh mục ${cat.name}`
                              : `Mở rộng danh mục ${cat.name}`
                          }
                          aria-expanded={isOpen}
                          onClick={() =>
                            setOpenMobileCategory(isOpen ? null : cat.id)
                          }
                          className="p-2.5 text-ink-muted hover:text-client-primary transition-colors"
                        >
                          <ChevronDown
                            className={`w-4 h-4 transition-transform ${
                              isOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                      )}
                    </div>
                    {isOpen && cat.children.length > 0 && (
                      <div className="pl-5 space-y-1 mt-1 mb-2 border-l-2 border-client-border ml-3">
                        {cat.children.map((child) => (
                          <Link
                            key={child.id}
                            href={`/tours?category=${encodeURIComponent(child.slug)}`}
                            onClick={() => setMobileMenuOpen(false)}
                            className="block px-3 py-2 text-[14px] text-ink-muted hover:text-client-primary transition-colors"
                          >
                            {child.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              <Link
                href="/tours"
                prefetch={false}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2.5 rounded-lg hover:bg-client-soft hover:text-client-primary transition-colors ${
                  pathname === "/tours"
                    ? "bg-client-soft text-client-primary font-semibold"
                    : "text-ink"
                }`}
              >
                Tất Cả Tour
              </Link>

              <Link
                href="/news"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2.5 rounded-lg hover:bg-client-soft hover:text-client-primary transition-colors ${
                  pathname === "/news" || pathname.startsWith("/news/")
                    ? "text-client-primary font-semibold bg-client-soft"
                    : "text-ink"
                }`}
              >
                Tin Tức
              </Link>

              <Link
                href="/#footer-newsletter"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-ink hover:bg-client-soft hover:text-client-primary transition-colors"
              >
                Liên Hệ
              </Link>

              <Link
                href="/account/wishlist"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-ink hover:bg-client-soft hover:text-client-primary transition-colors tabular-nums"
              >
                Tour Yêu Thích ({wishlistHydrated ? wishlistCount : 0})
              </Link>

              <Link
                href="/cart"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-ink hover:bg-client-soft hover:text-client-primary transition-colors tabular-nums"
              >
                Giỏ Hàng ({hydrated ? totalItemCount : 0})
              </Link>

              <div className="pt-3 mt-3 border-t border-border-subtle space-y-1">
                {currentUser ? (
                  <>
                    <div className="px-3 py-2 space-y-1.5">
                      <p className="text-[13px] font-bold text-client-primary truncate">
                        {currentUser.fullName}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-semibold ${tierBadge.cls}`}
                        >
                          <Award className="w-3 h-3 shrink-0" />
                          <span>{tierBadge.label}</span>
                        </span>
                        <Link
                          href="/account"
                          onClick={() => setMobileMenuOpen(false)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-client-soft border border-client-border text-client-primary font-bold tabular-nums"
                        >
                          <Coins className="w-3 h-3 shrink-0" />
                          <span>{loyaltyPoints.toLocaleString("vi-VN")} điểm</span>
                        </Link>
                      </div>
                    </div>
                    <Link
                      href="/account/orders"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-ink hover:bg-client-soft hover:text-client-primary transition-colors"
                    >
                      <ClipboardList className="w-4 h-4" />
                      <span>Đơn hàng của tôi</span>
                    </Link>
                    <Link
                      href="/account/travelers"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-ink hover:bg-client-soft hover:text-client-primary transition-colors"
                    >
                      <Users className="w-4 h-4" />
                      <span>Sổ hành khách</span>
                    </Link>
                    <Link
                      href="/account"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-ink hover:bg-client-soft hover:text-client-primary transition-colors"
                    >
                      <User className="w-4 h-4" />
                      <span>Tài khoản cá nhân</span>
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-status-danger hover:bg-status-danger-bg transition-colors text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Đăng xuất</span>
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-client-primary font-semibold hover:bg-client-soft transition-colors"
                    >
                      <User className="w-4 h-4" />
                      <span>Đăng nhập</span>
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-3 py-2.5 rounded-lg text-ink hover:bg-client-soft hover:text-client-primary transition-colors"
                    >
                      Đăng ký tài khoản
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-border-subtle bg-surface-muted text-[12px] text-ink-muted space-y-1.5">
              <p className="font-semibold text-ink">Hỗ trợ khách hàng</p>
              <p className="tabular-nums">Hotline: {websiteInfo.phone}</p>
              <p>Email: {websiteInfo.email}</p>
            </div>
          </aside>
        </div>
      )}
    </header>
  );
}
