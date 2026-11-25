"use client";

export const BANK_TRANSFER_INFO = {
  bank: "Vietcombank — Chi nhánh TP.HCM",
  accountName: "CONG TY DU LICH VN.TRAVEL",
  accountNumber: "1028 6868 8888",
};

export const MOMO_INFO = {
  walletName: "VN.TRAVEL OFFICIAL",
  phoneNumber: "1900 6868",
};

export function BankTransferInfoBox({ orderCode }: { orderCode?: string }) {
  return (
    <div className="mt-4 bg-client-soft border border-client-border rounded-[10px] p-4 text-[14px] space-y-1 text-ink">
      <p className="font-bold text-client-primary mb-1">
        Thông tin chuyển khoản (VN.TRAVEL)
      </p>
      <p>Ngân hàng: {BANK_TRANSFER_INFO.bank}</p>
      <p>Chủ tài khoản: {BANK_TRANSFER_INFO.accountName}</p>
      <p className="tabular-nums">
        Số tài khoản: {BANK_TRANSFER_INFO.accountNumber}
      </p>
      <p className="text-[12px] text-ink-muted pt-1">
        Nội dung chuyển khoản:{" "}
        <strong className="text-ink tabular-nums">
          {orderCode || "VNTRAVEL <Số điện thoại của bạn>"}
        </strong>
      </p>
    </div>
  );
}

export function MomoInfoBox({ orderCode }: { orderCode?: string }) {
  return (
    <div className="mt-4 bg-[#FDF2F8] border border-[#FBCFE8] rounded-[10px] p-4 text-[14px] space-y-1 text-ink">
      <p className="font-bold text-[#A50064] mb-1">
        Hướng dẫn thanh toán qua Ví MoMo
      </p>
      <p>Tài khoản nhận: {MOMO_INFO.walletName}</p>
      <p className="tabular-nums">
        Hotline / Ví doanh nghiệp: {MOMO_INFO.phoneNumber}
      </p>
      <p className="text-[12px] text-ink-muted pt-1">
        Sau khi bấm <strong>Đặt Tour</strong>, hệ thống sẽ cấp mã đơn hàng{" "}
        <strong className="text-ink tabular-nums">
          {orderCode || "ODxxxxxx"}
        </strong>{" "}
        và nhân viên tư vấn sẽ gửi mã QR MoMo xác thực trong ít phút.
      </p>
    </div>
  );
}
