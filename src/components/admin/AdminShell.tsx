"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Compass,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
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
}

interface AdminShellProps {
  admin: CurrentAdminInfo;
  children: React.ReactNode;
}

const PRIMARY_NAV = [
  { href: "/admin/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/admin/categories", label: "Quản lý danh mục", icon: FolderTree },
  { href: "/admin/tours", label: "Quản lý tour", icon: Compass },
  { href: "/admin/orders", label: "Quản lý đơn hàng", icon: ShoppingBag },
  { href: "/admin/reviews", label: "Quản lý đánh giá", icon: Star },
  { href: "/admin/users", label: "Quản lý người dùng", icon: Users },
  { href: "/admin/contacts", label: "Thông tin liên hệ", icon: Mail },
];

const SECONDARY_NAV = [
  { href: "/admin/settings", label: "Cài đặt chung", icon: Settings },
  { href: "/admin/profile", label: "Thông tin cá nhân", icon: UserCircle },
];

export function AdminShell({ admin, children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

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
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="lg:hidden p-2 rounded-lg hover:bg-[#F5F6FA] text-[#202224]"
            aria-label="Mở menu"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <Link
            href="/admin/dashboard"
            className="text-2xl font-extrabold tracking-tight flex items-center"
          >
            <span className="text-[#4880FF]">28.</span>
            <span className="text-[#202224]">TRAVEL</span>
          </Link>
        </div>

        <div className="flex items-center gap-5">
          <button
            type="button"
            className="relative p-2 rounded-full hover:bg-[#F5F6FA] text-[#202224]"
            title="Thông báo"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#F93C65] text-white text-[10px] font-bold flex items-center justify-center">
              6
            </span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-[#4880FF]/15 flex items-center justify-center border border-[#E0E0E0]">
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
          </div>
        </div>
      </header>

      <div className="flex flex-1 relative">
        {/* Mobile Backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar (240px width matching Figma) */}
        <aside
          className={`fixed lg:sticky top-[70px] left-0 z-20 h-[calc(100vh-70px)] w-[240px] shrink-0 bg-white border-r border-[#E0E0E0] py-5 flex flex-col justify-between transition-transform duration-200 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <nav className="space-y-1 px-3 overflow-y-auto">
            {PRIMARY_NAV.map((item) => {
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

            {SECONDARY_NAV.map((item) => {
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
        <main className="flex-1 min-w-0 p-5 sm:p-7">{children}</main>
      </div>
    </div>
  );
}
