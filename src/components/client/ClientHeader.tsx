"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  ClipboardList,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Phone,
  ShoppingCart,
  User,
  UserCircle,
  X,
} from "lucide-react";
import { useCart } from "./CartContext";
import { useClientMeta } from "./ClientLayoutShell";
import { enhanceImageUrl } from "@/lib/image-quality";

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

export function ClientHeader({
  categoryTree,
  websiteInfo,
}: ClientHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { totalItemCount, hydrated } = useCart();
  const { currentUser, logoutUser } = useClientMeta();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openMobileCategory, setOpenMobileCategory] = useState<string | null>(
    null
  );
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(e.target as Node)
      ) {
        setAccountMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
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
      {/* Top Bar - Brand Purple #4502C7 */}
      <div className="bg-[#4502C7] text-white text-[12px] py-2">
        <div className="max-w-[1184px] mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
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
            <div ref={accountMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setAccountMenuOpen((v) => !v)}
                aria-expanded={accountMenuOpen}
                aria-label="Menu tài khoản khách hàng"
                className="inline-flex items-center gap-1.5 text-white hover:bg-white/20 bg-white/15 px-3 py-1 rounded-full font-medium transition-colors"
              >
                {currentUser.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={enhanceImageUrl(currentUser.avatar, 120, 85)}
                    alt={currentUser.fullName}
                    className="w-4 h-4 rounded-full object-cover"
                  />
                ) : (
                  <UserCircle className="w-4 h-4 shrink-0" />
                )}
                <span className="max-w-[150px] truncate">
                  Xin chào, {currentUser.fullName}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${
                    accountMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {accountMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-[220px] bg-white text-[#25282B] rounded-[12px] shadow-xl border border-[#ECECEC] py-1.5 z-50">
                  <div className="px-4 py-2 border-b border-[#ECECEC]">
                    <p className="text-[13px] font-bold truncate">
                      {currentUser.fullName}
                    </p>
                    <p className="text-[11px] text-[#667479] truncate">
                      {currentUser.email}
                    </p>
                  </div>
                  <Link
                    href="/account/orders"
                    onClick={() => setAccountMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-[13px] hover:bg-[#4502C7]/5 hover:text-[#4502C7] transition-colors"
                  >
                    <ClipboardList className="w-4 h-4" />
                    <span>Đơn hàng của tôi</span>
                  </Link>
                  <Link
                    href="/account"
                    onClick={() => setAccountMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-[13px] hover:bg-[#4502C7]/5 hover:text-[#4502C7] transition-colors"
                  >
                    <User className="w-4 h-4" />
                    <span>Tài khoản cá nhân</span>
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] text-[#DA0808] hover:bg-red-50 border-t border-[#ECECEC] transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              )}
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
      <div className="bg-white border-b border-[#ECECEC] shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
        <div className="max-w-[1184px] mx-auto px-4 h-[68px] flex items-center justify-between gap-4">
          {/* Mobile Menu Trigger */}
          <button
            type="button"
            aria-label="Mở menu điều hướng"
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden w-11 h-11 -ml-2 rounded-lg flex items-center justify-center text-[#25282B] hover:text-[#4502C7] hover:bg-[#4502C7]/5 transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Logo VN.TRAVEL */}
          <Link
            href="/"
            className="flex items-center gap-2 shrink-0"
          >
            {websiteInfo.logo ? (
              <img
                src={websiteInfo.logo}
                alt={websiteInfo.websiteName || "VN.TRAVEL"}
                className="h-9 w-auto object-contain"
              />
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-[#4502C7] text-white font-extrabold text-[14px] tracking-tight flex items-center justify-center shadow-sm">
                  VN
                </div>
                <span className="text-[22px] sm:text-[24px] font-extrabold tracking-tight text-[#4502C7]">
                  {websiteInfo.websiteName || "VN.TRAVEL"}
                </span>
              </div>
            )}
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-7 text-[15px] font-medium text-[#25282B]">
            <Link
              href="/"
              className={`py-2 transition-colors hover:text-[#4502C7] ${
                pathname === "/" ? "text-[#4502C7] font-semibold" : ""
              }`}
            >
              Trang Chủ
            </Link>

            {categoryTree.map((cat) => (
              <div key={cat.id} className="relative group py-2">
                <Link
                  href={`/tours?category=${encodeURIComponent(cat.slug)}`}
                  className="inline-flex items-center gap-1 text-[#25282B] hover:text-[#4502C7] transition-colors"
                >
                  <span>{cat.name}</span>
                  {cat.children.length > 0 && (
                    <ChevronDown className="w-4 h-4 transition-transform group-hover:rotate-180" />
                  )}
                </Link>

                {cat.children.length > 0 && (
                  <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity duration-75 absolute left-0 top-full pt-1 w-[240px] z-50">
                    <div className="bg-white rounded-[10px] shadow-[0_14px_34px_rgba(18,22,29,0.2)] border border-[#DCE0E5] py-2 overflow-hidden">
                      {cat.children.map((child) => (
                        <Link
                          key={child.id}
                          href={`/tours?category=${encodeURIComponent(child.slug)}`}
                          className="block px-4 py-2.5 text-[14px] text-[#25282B] hover:bg-[#4502C7] hover:text-white transition-colors"
                        >
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            <Link
              href="/tours"
              className={`py-2 transition-colors hover:text-[#4502C7] ${
                pathname === "/tours" ? "text-[#4502C7] font-semibold" : ""
              }`}
            >
              Tất Cả Tour
            </Link>

            <Link
              href="/#news-section"
              className="py-2 text-[#25282B] hover:text-[#4502C7] transition-colors"
            >
              Tin Tức
            </Link>

            <Link
              href="/#footer-newsletter"
              className="py-2 text-[#25282B] hover:text-[#4502C7] transition-colors"
            >
              Liên Hệ
            </Link>
          </nav>

          {/* Right Cart Trigger */}
          <Link
            href="/cart"
            aria-label="Giỏ hàng"
            className="relative inline-flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-[10px] hover:bg-[#4502C7]/5 text-[#4502C7] transition-colors shrink-0"
          >
            <ShoppingCart className="w-6 h-6" />
            <span
              className={`inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full bg-[#DA0808] text-white text-[11px] font-bold transition-opacity duration-150 ${
                hydrated ? "opacity-100" : "opacity-0"
              }`}
            >
              {hydrated ? totalItemCount : 0}
            </span>
          </Link>
        </div>
      </div>

      {/* Mobile Drawer Menu (375px optimized) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-[290px] max-w-[85vw] bg-white h-full shadow-2xl flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#ECECEC]">
              <span className="text-[20px] font-extrabold text-[#4502C7]">
                {websiteInfo.websiteName || "VN.TRAVEL"}
              </span>
              <button
                type="button"
                aria-label="Đóng menu"
                onClick={() => setMobileMenuOpen(false)}
                className="w-11 h-11 -mr-2 rounded-lg flex items-center justify-center text-[#667479] hover:text-[#25282B] hover:bg-[#F6F6F6] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-1 flex-1 text-[15px] font-medium">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-[#25282B] hover:bg-[#4502C7]/5 hover:text-[#4502C7]"
              >
                Trang Chủ
              </Link>

              {categoryTree.map((cat) => {
                const isOpen = openMobileCategory === cat.id;
                return (
                  <div key={cat.id}>
                    <div className="flex items-center justify-between rounded-lg hover:bg-[#4502C7]/5">
                      <Link
                        href={`/tours?category=${encodeURIComponent(cat.slug)}`}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex-1 px-3 py-2.5 text-[#25282B] hover:text-[#4502C7]"
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
                          className="p-2.5 text-[#667479]"
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
                      <div className="pl-5 space-y-1 mt-1 mb-2 border-l-2 border-[#ECECEC] ml-3">
                        {cat.children.map((child) => (
                          <Link
                            key={child.id}
                            href={`/tours?category=${encodeURIComponent(child.slug)}`}
                            onClick={() => setMobileMenuOpen(false)}
                            className="block px-3 py-2 text-[14px] text-[#667479] hover:text-[#4502C7]"
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
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-[#25282B] hover:bg-[#4502C7]/5 hover:text-[#4502C7]"
              >
                Tất Cả Tour
              </Link>

              <Link
                href="/#news-section"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-[#25282B] hover:bg-[#4502C7]/5 hover:text-[#4502C7]"
              >
                Tin Tức
              </Link>

              <Link
                href="/#footer-newsletter"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-[#25282B] hover:bg-[#4502C7]/5 hover:text-[#4502C7]"
              >
                Liên Hệ
              </Link>

              <Link
                href="/cart"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-[#25282B] hover:bg-[#4502C7]/5 hover:text-[#4502C7]"
              >
                Giỏ Hàng ({hydrated ? totalItemCount : 0})
              </Link>

              <div className="pt-3 mt-3 border-t border-[#ECECEC] space-y-1">
                {currentUser ? (
                  <>
                    <div className="px-3 py-2 text-[13px] font-bold text-[#4502C7] truncate">
                      {currentUser.fullName}
                    </div>
                    <Link
                      href="/account/orders"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-[#25282B] hover:bg-[#4502C7]/5 hover:text-[#4502C7]"
                    >
                      <ClipboardList className="w-4 h-4" />
                      <span>Đơn hàng của tôi</span>
                    </Link>
                    <Link
                      href="/account"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-[#25282B] hover:bg-[#4502C7]/5 hover:text-[#4502C7]"
                    >
                      <User className="w-4 h-4" />
                      <span>Tài khoản cá nhân</span>
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-[#DA0808] hover:bg-red-50 text-left"
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
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-[#4502C7] font-semibold hover:bg-[#4502C7]/5"
                    >
                      <User className="w-4 h-4" />
                      <span>Đăng nhập</span>
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-3 py-2.5 rounded-lg text-[#25282B] hover:bg-[#4502C7]/5 hover:text-[#4502C7]"
                    >
                      Đăng ký tài khoản
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-[#ECECEC] bg-[#F6F6F6] text-[12px] text-[#667479] space-y-1.5">
              <p className="font-semibold text-[#25282B]">Hỗ trợ khách hàng</p>
              <p>Hotline: {websiteInfo.phone}</p>
              <p>Email: {websiteInfo.email}</p>
            </div>
          </aside>
        </div>
      )}
    </header>
  );
}
