import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";

interface AdminForbiddenCardProps {
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
}

export function AdminForbiddenCard({
  title = "Bạn không có quyền truy cập trang này",
  description = "Tài khoản quản trị của bạn chưa được cấp quyền cho chức năng này. Vui lòng liên hệ Quản trị viên để được hỗ trợ.",
  backHref = "/admin/profile",
  backLabel = "Về thông tin cá nhân",
}: AdminForbiddenCardProps) {
  return (
    <div className="bg-white rounded-[14px] border border-[#E0E0E0] p-8 sm:p-12 flex flex-col items-center justify-center text-center min-h-[380px]">
      <div className="w-14 h-14 rounded-2xl bg-[#FEE2E2] text-[#B91C1C] flex items-center justify-center mb-4">
        <ShieldAlert className="w-7 h-7" />
      </div>
      <h1 className="text-xl sm:text-2xl font-bold text-[#202224]">{title}</h1>
      <p className="text-sm text-[#606060] mt-2 max-w-md leading-relaxed">
        {description}
      </p>
      <Link
        href={backHref}
        className="mt-6 h-11 px-6 rounded-xl bg-[#4880FF] hover:bg-[#3a6ce0] text-white text-sm font-bold inline-flex items-center gap-2 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {backLabel}
      </Link>
    </div>
  );
}
