"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardList, LogOut, User, UserCircle } from "lucide-react";
import { useClientMeta } from "./ClientLayoutShell";
import { enhanceImageUrl } from "@/lib/image-quality";

export function AccountSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, logoutUser } = useClientMeta();

  async function handleLogout() {
    await logoutUser();
    router.push("/");
    router.refresh();
  }

  return (
    <aside className="bg-white rounded-[16px] border border-[#ECECEC] p-5 shadow-sm space-y-4">
      {currentUser && (
        <div className="flex items-center gap-3 pb-4 border-b border-[#ECECEC]">
          {currentUser.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={enhanceImageUrl(currentUser.avatar, 200, 90)}
              alt={currentUser.fullName}
              className="w-12 h-12 rounded-full object-cover border border-[#ECECEC] shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[#4502C7]/10 text-[#4502C7] flex items-center justify-center shrink-0">
              <UserCircle className="w-7 h-7" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-[#25282B] truncate">
              {currentUser.fullName}
            </p>
            <p className="text-[12px] text-[#667479] truncate">
              {currentUser.email}
            </p>
          </div>
        </div>
      )}

      <nav className="space-y-1 text-[14px] font-medium">
        <Link
          href="/account/orders"
          className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] transition-colors ${
            pathname === "/account/orders"
              ? "bg-[#4502C7] text-white font-semibold"
              : "text-[#25282B] hover:bg-[#4502C7]/5 hover:text-[#4502C7]"
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>Đơn hàng của tôi</span>
        </Link>

        <Link
          href="/account"
          className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] transition-colors ${
            pathname === "/account"
              ? "bg-[#4502C7] text-white font-semibold"
              : "text-[#25282B] hover:bg-[#4502C7]/5 hover:text-[#4502C7]"
          }`}
        >
          <User className="w-4 h-4" />
          <span>Hồ sơ &amp; Mật khẩu</span>
        </Link>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] text-[#DA0808] hover:bg-red-50 transition-colors text-left"
        >
          <LogOut className="w-4 h-4" />
          <span>Đăng xuất</span>
        </button>
      </nav>
    </aside>
  );
}
