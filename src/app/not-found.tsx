import Link from "next/link";

export default function GlobalNotFoundPage() {
  return (
    <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-[#E0E0E0] p-10 sm:p-14 max-w-lg w-full text-center shadow-sm">
        <div className="text-7xl sm:text-8xl font-black tracking-tight text-[#4502C7] select-none">
          404
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#202224] mt-4">
          Trang này không tồn tại...
        </h1>
        <p className="text-sm text-[#606060] mt-2">
          Rất tiếc, nội dung bạn tìm kiếm không khả dụng hoặc đường dẫn đã thay đổi.
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="h-11 px-6 rounded-xl bg-[#4502C7] hover:bg-[#36019e] text-white text-sm font-bold inline-flex items-center justify-center transition-colors"
          >
            Về trang chủ
          </Link>
          <Link
            href="/tours"
            className="h-11 px-6 rounded-xl border border-[#D5D5D5] hover:border-[#4502C7] text-[#202224] text-sm font-bold inline-flex items-center justify-center transition-colors"
          >
            Khám phá tour
          </Link>
        </div>
      </div>
    </div>
  );
}
