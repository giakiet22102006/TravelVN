"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardList, Heart, LogOut, User, UserCircle } from "lucide-react";
import { useClientMeta } from "./ClientLayoutShell";
import { enhanceImageUrl } from "@/lib/image-quality";

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

  return (
    <aside className="bg-white rounded-[16px] border border-subtle p-5 shadow-sm space-y-4">
      {currentUser && (
        <div className="flex items-center gap-3 pb-4 border-b border-subtle">
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
