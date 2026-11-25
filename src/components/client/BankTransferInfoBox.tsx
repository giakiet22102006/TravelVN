"use client";

import { Printer } from "lucide-react";

export const BANK_TRANSFER_INFO = {
  bank: "MB Bank / Vietcombank — VN.TRAVEL",
  accountName: "CONG TY DU LICH VN TRAVEL",
  accountNumber: "0389 998 888",
};

export const MOMO_INFO = {
  walletName: "VN.TRAVEL OFFICIAL",
  phoneNumber: "1900 6868",
};

export function buildVietQrUrl(orderCode: string, amount: number): string {
  const safeAmount = Math.max(1000, Math.floor(amount));
  return `https://img.vietqr.io/image/MB-0389998888-compact2.png?amount=${safeAmount}&addInfo=${encodeURIComponent(
    orderCode
  )}&accountName=VN%20TRAVEL`;
}

export function BankTransferInfoBox({
  orderCode,
  amount,
}: {
  orderCode?: string;
  amount?: number;
}) {
  const showQr = Boolean(orderCode && amount && amount > 0);

  return (
    <div className="mt-4 bg-client-soft border border-client-border rounded-[12px] p-4 text-[14px] text-ink">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="font-bold text-client-primary mb-1">
            Thông tin chuyển khoản (VN.TRAVEL)
          </p>
          <p>Ngân hàng: {BANK_TRANSFER_INFO.bank}</p>
          <p>Chủ tài khoản: {BANK_TRANSFER_INFO.accountName}</p>
          <p className="tabular-nums">
            Số tài khoản: <strong>{BANK_TRANSFER_INFO.accountNumber}</strong>
          </p>
          <p className="text-[12px] text-ink-muted pt-1">
            Nội dung chuyển khoản:{" "}
            <strong className="text-ink tabular-nums">
              {orderCode || "VNTRAVEL <Số điện thoại của bạn>"}
            </strong>
          </p>
          {showQr && (
            <p className="text-[12px] text-client-primary font-medium pt-0.5">
              Quét mã VietQR bằng ứng dụng ngân hàng để tự động điền số tiền và
              nội dung.
            </p>
          )}
        </div>

        {showQr && orderCode && amount && (
          <div className="shrink-0 bg-white border border-client-border rounded-[10px] p-2.5 self-start sm:self-center shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={buildVietQrUrl(orderCode, amount)}
              alt={`Mã VietQR thanh toán đơn ${orderCode}`}
              className="w-[156px] h-auto object-contain rounded-[6px]"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function MomoInfoBox({ orderCode }: { orderCode?: string }) {
  return (
    <div className="mt-4 bg-client-soft border border-client-border rounded-[12px] p-4 text-[14px] space-y-1 text-ink">
      <p className="font-bold text-client-accent mb-1">
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
        và giữ chỗ trực tuyến trong 15 phút để bạn hoàn tất thanh toán.
      </p>
    </div>
  );
}

export function PrintVoucherButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-client-primary hover:bg-client-primary-hover text-white text-[13px] font-semibold transition-colors shadow-sm"
    >
      <Printer className="w-4 h-4" />
      <span>In / Lưu PDF</span>
    </button>
  );
}
