import Link from "next/link";

export default function AdminNotFoundCatchAllPage() {
  return (
    <div className="bg-white rounded-[14px] border border-[#E0E0E0] p-10 sm:p-16 flex flex-col items-center justify-center text-center min-h-[540px]">
      <div className="mb-6">
        <div className="text-7xl sm:text-8xl font-black tracking-tight text-[#4880FF] select-none">
          404
        </div>
        <div className="mt-2 h-1.5 w-24 mx-auto rounded-full bg-[#4880FF]/20" />
      </div>

      <h1 className="text-xl sm:text-2xl font-bold text-[#202224]">
        Trang này không tồn tại...
      </h1>
      <p className="text-sm text-[#606060] mt-2 max-w-md">
        Đường dẫn bạn truy cập không có trong hệ thống quản trị hoặc đã bị xóa.
      </p>

      <Link
        href="/admin/dashboard"
        className="mt-7 h-12 px-8 rounded-xl bg-[#4880FF] hover:bg-[#3a6ce0] text-white text-sm font-bold inline-flex items-center justify-center transition-colors shadow-sm"
      >
        Trở về trang tổng quan
      </Link>
    </div>
  );
}
