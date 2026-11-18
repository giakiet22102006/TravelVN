import Link from "next/link";

export default function TourNotFoundPage() {
  return (
    <div className="max-w-[1184px] mx-auto px-4 py-16 text-center">
      <div className="bg-white rounded-[16px] border border-[#ECECEC] p-10 max-w-lg mx-auto shadow-sm">
        <p className="text-5xl font-black text-[#4502C7] mb-3">404</p>
        <h1 className="text-[22px] font-bold text-[#25282B]">
          Không tìm thấy Tour này
        </h1>
        <p className="text-[14px] text-[#667479] mt-2">
          Tour có thể đã tạm ngừng hoạt động hoặc đường dẫn không chính xác.
        </p>
        <Link
          href="/tours"
          className="mt-6 inline-flex items-center justify-center px-6 py-2.5 rounded-[8px] bg-[#4502C7] text-white text-[14px] font-semibold hover:bg-[#36019e] transition-colors"
        >
          Xem Tất Cả Tour
        </Link>
      </div>
    </div>
  );
}
