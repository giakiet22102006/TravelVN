"use client";

export const BANK_TRANSFER_INFO = {
  bank: "Vietcombank — Chi nhánh TP.HCM",
  accountName: "CONG TY DU LICH 28.TRAVEL",
  accountNumber: "1028 6868 8888 (Demo)",
};

export function BankTransferInfoBox({ orderCode }: { orderCode?: string }) {
  return (
    <div className="mt-4 bg-[#F3F3F3] border border-[#CCD1D2] rounded-[10px] p-4 text-[14px] space-y-1 text-[#25282B]">
      <p className="font-bold text-[#4502C7] mb-1">
        Thông tin chuyển khoản (28.TRAVEL)
      </p>
      <p>Ngân hàng: {BANK_TRANSFER_INFO.bank}</p>
      <p>Chủ tài khoản: {BANK_TRANSFER_INFO.accountName}</p>
      <p>Số tài khoản: {BANK_TRANSFER_INFO.accountNumber}</p>
      <p className="text-[12px] text-[#667479] pt-1">
        Nội dung chuyển khoản:{" "}
        <strong className="text-[#25282B]">
          {orderCode || "28TRAVEL <Số điện thoại của bạn>"}
        </strong>
      </p>
    </div>
  );
}
