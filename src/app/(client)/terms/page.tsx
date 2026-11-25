import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

export const metadata = {
  title: "Điều khoản dịch vụ | VN.TRAVEL",
};

export default function TermsPage() {
  return (
    <div className="max-w-[920px] mx-auto px-4 py-8 sm:py-12">
      <div className="bg-white rounded-[16px] border border-subtle p-6 sm:p-10 shadow-sm space-y-6">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-client-soft text-client-primary flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <h1 className="text-[22px] sm:text-[26px] font-bold text-ink">
              Điều Khoản Dịch Vụ
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
              1. Quy định đặt tour và giữ chỗ
            </h2>
            <p>
              Khách hàng khi đặt tour trực tuyến tại VN.TRAVEL vui lòng cung cấp
              đầy đủ họ tên, số điện thoại liên hệ và số lượng hành khách theo độ
              tuổi (Người lớn, Trẻ em, Em bé) để bộ phận điều hành giữ chỗ chính xác.
            </p>
          </section>

          <section className="space-y-1.5">
            <h2 className="text-[16px] font-bold text-ink">
              2. Chính sách thanh toán và xác nhận đơn hàng
            </h2>
            <p className="tabular-nums">
              Hệ thống hỗ trợ thanh toán tiền mặt khi đi tour, ví điện tử MoMo
              hoặc chuyển khoản ngân hàng theo thông tin hiển thị tại bước thanh
              toán. Nhân viên tư vấn sẽ liên hệ xác nhận trong vòng 15–30 phút
              làm việc.
            </p>
          </section>

          <section className="space-y-2 tabular-nums">
            <h2 className="text-[16px] font-bold text-ink">
              3. Điều kiện hoàn, hủy và đổi lịch khởi hành
            </h2>
            <p>
              Yêu cầu thay đổi ngày khởi hành hoặc hủy tour cần được thông báo
              trước ngày khởi hành tối thiểu <strong className="text-ink">7 ngày</strong> đối với
              tour trong nước và <strong className="text-ink">14 ngày</strong> đối với tour nước
              ngoài để được hỗ trợ giữ chỗ và đổi lịch thuận lợi nhất:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Hủy trước ngày khởi hành từ <strong className="text-ink">15 ngày</strong> trở lên:
                Hoàn 100% tiền cọc (hoặc hỗ trợ đổi ngày khởi hành miễn phí).
              </li>
              <li>
                Hủy trước từ <strong className="text-ink">7 đến 14 ngày</strong>: Phí hủy 30% tổng
                giá trị tour.
              </li>
              <li>
                Hủy trước từ <strong className="text-ink">3 đến 6 ngày</strong>: Phí hủy 50% tổng giá
                trị tour.
              </li>
              <li>
                Hủy trong vòng <strong className="text-ink">48 giờ</strong> trước khởi hành: Không
                hoàn phí cọc (trừ trường hợp bất khả kháng theo quy định).
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
