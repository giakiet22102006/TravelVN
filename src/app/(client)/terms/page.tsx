import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

export const metadata = {
  title: "Điều khoản dịch vụ | 28.TRAVEL",
};

export default function TermsPage() {
  return (
    <div className="max-w-[920px] mx-auto px-4 py-8 sm:py-12">
      <div className="bg-white rounded-[16px] border border-[#ECECEC] p-6 sm:p-10 shadow-sm space-y-6">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#ECECEC]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-[#4502C7]/10 text-[#4502C7] flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <h1 className="text-[22px] sm:text-[26px] font-bold text-[#4502C7]">
              Điều Khoản Dịch Vụ
            </h1>
          </div>
          <Link
            href="/tours"
            className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#4502C7] hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Xem Tour</span>
          </Link>
        </div>

        <div className="space-y-4 text-[14px] text-[#4F4F4F] leading-relaxed">
          <section className="space-y-1.5">
            <h2 className="text-[16px] font-bold text-[#25282B]">
              1. Quy định đặt tour và giữ chỗ
            </h2>
            <p>
              Khách hàng khi đặt tour trực tuyến tại 28.TRAVEL vui lòng cung cấp
              đầy đủ họ tên, số điện thoại liên hệ và số lượng hành khách theo độ
              tuổi (Người lớn, Trẻ em, Em bé) để bộ phận điều hành giữ chỗ chính xác.
            </p>
          </section>

          <section className="space-y-1.5">
            <h2 className="text-[16px] font-bold text-[#25282B]">
              2. Chính sách thanh toán và xác nhận đơn hàng
            </h2>
            <p>
              Hệ thống hỗ trợ thanh toán tiền mặt khi đi tour, ví điện tử MoMo
              hoặc chuyển khoản ngân hàng theo thông tin hiển thị tại bước thanh
              toán. Nhân viên tư vấn sẽ liên hệ xác nhận trong vòng 15–30 phút
              làm việc.
            </p>
          </section>

          <section className="space-y-1.5">
            <h2 className="text-[16px] font-bold text-[#25282B]">
              3. Điều kiện hoàn, hủy và đổi lịch khởi hành
            </h2>
            <p>
              Yêu cầu thay đổi ngày khởi hành hoặc hủy tour cần được thông báo
              trước ngày khởi hành tối thiểu 7 ngày đối với tour trong nước và
              14 ngày đối với tour nước ngoài để được hỗ trợ hoàn giữ chỗ theo
              quy định từng hành trình.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
