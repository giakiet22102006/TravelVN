import Link from "next/link";
import { redirect } from "next/navigation";
import { Globe, ShieldCheck, UserCog } from "lucide-react";
import { getCurrentAdmin, hasAdminPermission } from "@/lib/auth";
import { AdminForbiddenCard } from "@/components/admin/AdminForbiddenCard";

export const dynamic = "force-dynamic";

const SETTINGS_CARDS = [
  {
    href: "/admin/settings/website-info",
    title: "Thông tin website",
    description:
      "Cấu hình tên thương hiệu, hotline, email, địa chỉ, logo và favicon.",
    icon: Globe,
    colorClass: "bg-[#4880FF]/15 text-[#4880FF]",
    permission: "setting_view",
  },
  {
    href: "/admin/settings/accounts",
    title: "Tài khoản quản trị",
    description:
      "Quản lý tài khoản nhân sự vận hành hệ thống và phân nhóm quyền.",
    icon: UserCog,
    colorClass: "bg-[#8280FF]/15 text-[#8280FF]",
    permission: "admin_view",
  },
  {
    href: "/admin/settings/roles",
    title: "Nhóm quyền",
    description:
      "Thiết lập vai trò RBAC và phân quyền chi tiết cho từng chức năng.",
    icon: ShieldCheck,
    colorClass: "bg-[#4AD991]/20 text-[#0F766E]",
    permission: "role_view",
  },
];

export default async function AdminSettingsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/account/login");

  const visibleCards = SETTINGS_CARDS.filter((card) =>
    hasAdminPermission(admin, card.permission)
  );

  if (visibleCards.length === 0) {
    return (
      <AdminForbiddenCard
        title="Bạn không có quyền xem Cài đặt chung"
        description="Tài khoản quản trị của bạn chưa được cấp quyền truy cập khu vực cài đặt hệ thống."
      />
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-[32px] font-bold text-[#202224]">
        Cài đặt chung
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {visibleCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group bg-white rounded-[14px] border border-[#E0E0E0] hover:border-[#4880FF] p-6 flex items-center gap-5 transition-all hover:shadow-sm"
            >
              <div
                className={`w-16 h-16 rounded-2xl shrink-0 flex items-center justify-center ${card.colorClass}`}
              >
                <Icon className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#202224] group-hover:text-[#4880FF] transition-colors">
                  {card.title}
                </h2>
                <p className="text-xs text-[#606060] mt-1 leading-relaxed">
                  {card.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
