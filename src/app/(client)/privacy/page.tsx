import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Chính sách bảo mật | VN.TRAVEL",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-[920px] mx-auto px-4 py-8 sm:py-12">
      <div className="bg-white rounded-[16px] border border-subtle p-6 sm:p-10 shadow-sm space-y-6">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-client-soft text-client-primary flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h1 className="text-[22px] sm:text-[26px] font-bold text-ink">
              Chính Sách Bảo Mật
            </h1>
          </div>
          <Link
            href="/tours"
            className="inline-flex items-center gap-1.5 text-[14px] font-medium text-client-primary hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Xem Tour</span>
          </Link>
        </div>

        <div className="space-y-4 text-[14px] text-ink-muted leading-relaxed">
          <section className="space-y-1.5">
            <h2 className="text-[16px] font-bold text-ink">
              1. Mục đích thu thập thông tin
            </h2>
            <p>
              VN.TRAVEL chỉ thu thập thông tin cá nhân cần thiết (họ tên, số điện
              thoại, email nhận bản tin, ghi chú yêu cầu riêng) nhằm phục vụ việc
              xác nhận đặt tour, xuất vé dịch vụ và hỗ trợ khách hàng trong suốt
              chuyến đi.
            </p>
          </section>

          <section className="space-y-1.5">
            <h2 className="text-[16px] font-bold text-ink">
              2. Phạm vi lưu trữ và bảo vệ dữ liệu
            </h2>
            <p>
              Mọi thông tin đặt tour được lưu trữ an toàn trên hệ thống cơ sở dữ
              liệu được mã hóa kết nối (TLS/SSL). Chúng tôi cam kết không chia sẻ,
              mua bán dữ liệu khách hàng cho bên thứ ba ngoài mục đích vận hành
              tour du lịch đã thỏa thuận.
            </p>
          </section>

          <section className="space-y-1.5">
            <h2 className="text-[16px] font-bold text-ink">
              3. Quyền kiểm tra và chỉnh sửa thông tin
            </h2>
            <p>
              Quý khách có thể liên hệ trực tiếp qua hotline hoặc email hỗ trợ
              của VN.TRAVEL để cập nhật hoặc yêu cầu xóa thông tin liên hệ bất
              kỳ lúc nào.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
