"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  Compass,
  FolderTree,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Newspaper,
  Settings,
  ShoppingBag,
  Star,
  UserCircle,
  Users,
  X,
} from "lucide-react";

export interface CurrentAdminInfo {
  id: string;
  fullName: string;
  email: string;
  avatar: string | null;
  roleName: string;
  permissions?: string[];
}

interface AdminNotificationItem {
  id: string;
  type: "order" | "contact";
  title: string;
  description: string;
  href: string;
  createdAt: string;
}

interface AdminNotificationsResponse {
  totalCount: number;
  pendingOrdersCount: number;
  newContactsCount: number;
  items: AdminNotificationItem[];
}

interface AdminShellProps {
  admin: CurrentAdminInfo;
  children: React.ReactNode;
}

const PRIMARY_NAV = [
  {
    href: "/admin/dashboard",
    label: "Tổng quan",
    icon: LayoutDashboard,
    requiredPermissions: ["dashboard_view"],
  },
  {
    href: "/admin/categories",
    label: "Quản lý danh mục",
    icon: FolderTree,
    requiredPermissions: ["category_view"],
  },
  {
    href: "/admin/tours",
    label: "Quản lý tour",
    icon: Compass,
    requiredPermissions: ["tour_view"],
  },
  {
    href: "/admin/orders",
    label: "Quản lý đơn hàng",
    icon: ShoppingBag,
    requiredPermissions: ["order_view"],
  },
  {
    href: "/admin/reviews",
    label: "Quản lý đánh giá",
    icon: Star,
    requiredPermissions: ["review_view"],
  },
  {
    href: "/admin/news",
    label: "Quản lý tin tức",
    icon: Newspaper,
    requiredPermissions: ["news_view"],
  },
  {
    href: "/admin/users",
    label: "Quản lý người dùng",
    icon: Users,
    requiredPermissions: ["user_view"],
  },
  {
    href: "/admin/contacts",
    label: "Thông tin liên hệ",
    icon: Mail,
    requiredPermissions: ["contact_view"],
  },
];

const SECONDARY_NAV = [
  {
    href: "/admin/settings",
    label: "Cài đặt chung",
    icon: Settings,
    requiredPermissions: ["setting_view", "role_view", "admin_view"],
  },
  {
    href: "/admin/profile",
    label: "Thông tin cá nhân",
    icon: UserCircle,
    requiredPermissions: [],
  },
];

export function AdminShell({ admin, children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [notifications, setNotifications] =
    useState<AdminNotificationsResponse>({
      totalCount: 0,
      pendingOrdersCount: 0,
      newContactsCount: 0,
      items: [],
    });

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const permSet = new Set(admin.permissions || []);
  const canAccessNav = (required: string[]) =>
    required.length === 0 ||
    permSet.size === 0 ||
    required.some((key) => permSet.has(key));

  const visiblePrimaryNav = PRIMARY_NAV.filter((item) =>
    canAccessNav(item.requiredPermissions)
  );
  const visibleSecondaryNav = SECONDARY_NAV.filter((item) =>
    canAccessNav(item.requiredPermissions)
  );

  // Fetch live pending notifications on mount and navigation
  useEffect(() => {
    let active = true;
    fetch("/api/admin/notifications")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: AdminNotificationsResponse | null) => {
        if (active && data) {
          setNotifications(data);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [pathname]);

  // Lock body scroll when mobile drawer is open & close on Escape
  useEffect(() => {
    if (!sidebarOpen && !notifOpen && !profileOpen) return;

    const prevOverflow = document.body.style.overflow;
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSidebarOpen(false);
        setNotifOpen(false);
        setProfileOpen(false);
      }
    }

    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target as Node)
      ) {
        setProfileOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      if (sidebarOpen) {
        document.body.style.overflow = prevOverflow;
      }
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [sidebarOpen, notifOpen, profileOpen]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
      router.push("/admin/account/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="min-h-screen bg-[#F5F6FA] flex flex-col">
      {/* Top Bar (70px height matching Figma) */}
      <header className="h-[70px] bg-white border-b border-[#E0E0E0] sticky top-0 z-30 flex items-center justify-between px-4 lg:px-7">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="lg:hidden w-11 h-11 rounded-xl hover:bg-[#F5F6FA] text-[#202224] inline-flex items-center justify-center"
            aria-label={sidebarOpen ? "Đóng menu" : "Mở menu"}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>

          <Link
            href="/admin/dashboard"
            className="text-2xl font-extrabold tracking-tight flex items-center"
          >
            <span className="text-[#4880FF]">VN.</span>
            <span className="text-[#202224]">TRAVEL</span>
          </Link>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          {/* Live Notifications Popover */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => {
                setNotifOpen((v) => !v);
                setProfileOpen(false);
              }}
              className="relative w-11 h-11 rounded-full hover:bg-[#F5F6FA] text-[#202224] inline-flex items-center justify-center transition-colors"
              title="Thông báo"
              aria-label="Thông báo"
              aria-expanded={notifOpen}
            >
              <Bell className="w-5 h-5" />
              {notifications.totalCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#F93C65] text-white text-[10px] font-bold flex items-center justify-center">
                  {notifications.totalCount > 99
                    ? "99+"
                    : notifications.totalCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-[#E0E0E0] shadow-xl overflow-hidden z-40">
                <div className="px-4 py-3 border-b border-[#E0E0E0] flex items-center justify-between bg-[#FCFDFD]">
                  <span className="text-sm font-bold text-[#202224]">
                    Thông báo cần xử lý
                  </span>
                  <span className="text-xs font-semibold text-[#4880FF]">
                    {notifications.pendingOrdersCount} đơn •{" "}
                    {notifications.newContactsCount} liên hệ
                  </span>
                </div>

                {notifications.items.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-[#667479]">
                    Hiện không có đơn chờ duyệt hay liên hệ mới.
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto divide-y divide-[#F0F0F0]">
                    {notifications.items.map((item) => (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={() => setNotifOpen(false)}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-[#F5F6FA] transition-colors"
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            item.type === "order"
                              ? "bg-[#4880FF]/10 text-[#4880FF]"
                              : "bg-amber-50 text-amber-600"
                          }`}
                        >
                          {item.type === "order" ? (
                            <ShoppingBag className="w-4 h-4" />
                          ) : (
                            <Mail className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-[#202224] truncate">
                            {item.title}
                          </div>
                          <div className="text-xs text-[#606060] truncate mt-0.5">
                            {item.description}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                <div className="px-4 py-2.5 border-t border-[#E0E0E0] bg-[#FCFDFD] flex items-center justify-between text-xs font-bold">
                  <Link
                    href="/admin/orders"
                    onClick={() => setNotifOpen(false)}
                    className="text-[#4880FF] hover:underline"
                  >
                    Xem tất cả đơn hàng
                  </Link>
                  <Link
                    href="/admin/contacts"
                    onClick={() => setNotifOpen(false)}
                    className="text-[#606060] hover:text-[#202224]"
                  >
                    Liên hệ mới
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Clickable Profile Dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => {
                setProfileOpen((v) => !v);
                setNotifOpen(false);
              }}
              aria-expanded={profileOpen}
              aria-label="Menu tài khoản quản trị"
              className="flex items-center gap-2.5 min-h-[44px] px-1.5 sm:px-2.5 py-1 rounded-xl hover:bg-[#F5F6FA] transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full overflow-hidden bg-[#4880FF]/15 flex items-center justify-center border border-[#E0E0E0] shrink-0">
                {admin.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={admin.avatar}
                    alt={admin.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-bold text-sm text-[#4880FF]">
                    {admin.fullName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="hidden sm:block leading-tight">
                <div className="text-sm font-bold text-[#202224]">
                  {admin.fullName}
                </div>
                <div className="text-xs font-semibold text-[#565656]">
                  {admin.roleName}
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-[#667479] hidden sm:block" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-white border border-[#E0E0E0] shadow-xl overflow-hidden z-40 py-1.5">
                <div className="px-4 py-2.5 border-b border-[#F0F0F0]">
                  <div className="text-sm font-bold text-[#202224] truncate">
                    {admin.fullName}
                  </div>
                  <div className="text-xs text-[#606060] truncate">
                    {admin.email}
                  </div>
                </div>

                <Link
                  href="/admin/profile"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-[#202224] hover:bg-[#F5F6FA]"
                >
                  <UserCircle className="w-4 h-4 text-[#4880FF]" />
                  <span>Thông tin cá nhân</span>
                </Link>

                <Link
                  href="/admin/profile/change-password"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-[#202224] hover:bg-[#F5F6FA]"
                >
                  <KeyRound className="w-4 h-4 text-[#4880FF]" />
                  <span>Đổi mật khẩu</span>
                </Link>

                <div className="my-1 border-t border-[#F0F0F0]" />

                <button
                  type="button"
                  disabled={loggingOut}
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-[#F93C65] hover:bg-red-50 text-left"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{loggingOut ? "Đang đăng xuất..." : "Đăng xuất"}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 relative">
        {/* Mobile Backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/35 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar (240px width matching Figma) */}
        <aside
          className={`fixed lg:sticky top-0 lg:top-[70px] left-0 z-50 lg:z-20 h-screen lg:h-[calc(100vh-70px)] w-[260px] lg:w-[240px] shrink-0 bg-white border-r border-[#E0E0E0] flex flex-col justify-between transition-transform duration-200 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <div className="lg:hidden h-[70px] px-4 border-b border-[#E0E0E0] flex items-center justify-between shrink-0">
            <span className="text-base font-extrabold text-[#202224]">
              Menu Quản Trị
            </span>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="w-11 h-11 rounded-xl hover:bg-[#F5F6FA] text-[#202224] inline-flex items-center justify-center"
              aria-label="Đóng menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
            {visiblePrimaryNav.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`relative flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${
                    active
                      ? "bg-[#4880FF] text-white shadow-sm"
                      : "text-[#202224] hover:bg-[#F5F6FA]"
                  }`}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <div className="my-4 border-t border-[#E0E0E0]" />

            {visibleSecondaryNav.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${
                    active
                      ? "bg-[#4880FF] text-white shadow-sm"
                      : "text-[#202224] hover:bg-[#F5F6FA]"
                  }`}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <button
              type="button"
              disabled={loggingOut}
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold text-[#F93C65] hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-[18px] h-[18px] shrink-0" />
              <span>{loggingOut ? "Đang đăng xuất..." : "Đăng xuất"}</span>
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-7">{children}</main>
      </div>
    </div>
  );
}
