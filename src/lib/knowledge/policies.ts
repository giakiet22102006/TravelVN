export interface PolicySection {
  id: "booking" | "payment" | "cancellation" | "included_excluded";
  title: string;
  summary: string;
  rules: string[];
}

export const TRAVELVN_POLICIES: readonly PolicySection[] = [
  {
    id: "cancellation",
    title: "Chính sách hoàn, hủy và đổi lịch khởi hành",
    summary:
      "Áp dụng theo số ngày thông báo trước ngày khởi hành chính thức của tour.",
    rules: [
      "Hủy trước ngày khởi hành từ 15 ngày trở lên: Hoàn 100% tiền cọc (hoặc hỗ trợ đổi ngày khởi hành miễn phí).",
      "Hủy trước ngày khởi hành từ 7 đến 14 ngày: Phí hủy 30% tổng giá trị tour.",
      "Hủy trước ngày khởi hành từ 3 đến 6 ngày: Phí hủy 50% tổng giá trị tour.",
      "Hủy trong vòng 48 giờ trước giờ khởi hành: Không hoàn phí cọc (trừ trường hợp bất khả kháng theo quy định).",
      "Lưu ý chung tại Điều khoản dịch vụ (/terms): Khách hàng nên thông báo sớm tối thiểu 7 ngày (tour trong nước) và 14 ngày (tour nước ngoài) để được hỗ trợ giữ chỗ/đổi lịch thuận lợi nhất.",
    ],
  },
  {
    id: "payment",
    title: "Chính sách thanh toán & xác nhận đơn hàng",
    summary:
      "VN.TRAVEL hỗ trợ 3 phương thức thanh toán linh hoạt và xác nhận trong 15–30 phút làm việc.",
    rules: [
      "Tiền mặt (CASH): Thanh toán trực tiếp tại văn phòng VN.TRAVEL hoặc khi đi tour.",
      "Ví điện tử MoMo (MOMO): Thanh toán trực tuyến qua MoMo.",
      "Chuyển khoản ngân hàng (BANK_TRANSFER): Chuyển khoản theo thông tin hiển thị ở bước thanh toán.",
      "Nhân viên tư vấn sẽ liên hệ xác nhận đơn đặt tour trong vòng 15–30 phút làm việc.",
    ],
  },
  {
    id: "booking",
    title: "Quy định đặt tour và giữ chỗ",
    summary:
      "Cung cấp đầy đủ thông tin hành khách theo từng nhóm tuổi để giữ chỗ chính xác.",
    rules: [
      "Khách hàng cần cung cấp họ tên, số điện thoại liên hệ và số lượng hành khách theo độ tuổi: Người lớn, Trẻ em, Em bé.",
      "Có thể áp dụng mã giảm giá tại trang Giỏ hàng (/cart) trước khi xác nhận đặt tour.",
    ],
  },
  {
    id: "included_excluded",
    title: "Chi phí thường bao gồm & không bao gồm",
    summary:
      "Chi tiết có thể thay đổi theo từng tour, khách hàng kiểm tra mục Bao gồm / Không bao gồm trên trang chi tiết tour.",
    rules: [
      "Không bao gồm (mặc định): Chi phí cá nhân (giặt ủi, đồ uống ngoài thực đơn, mua sắm), phụ thu phòng đơn, vé cáp treo/trò chơi tự túc ngoài chương trình, tiền tip (không bắt buộc), thuế VAT 8–10% khi xuất hóa đơn GTGT doanh nghiệp.",
    ],
  },
] as const;

export const SUPPORT_CONTACT = {
  brand: "VN.TRAVEL",
  hotline: "1900 6868",
  email: "contact@vn.travel.com",
  address: "285 Cách Mạng Tháng Tám, Quận 10, TP.HCM",
  termsUrl: "/terms",
} as const;
