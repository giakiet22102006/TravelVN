import crypto from "crypto";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  MapPin,
  Plane,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/client-auth";
import { PrintVoucherButton } from "@/components/client/BankTransferInfoBox";
import {
  formatCurrencyVND,
  formatDateTimeVN,
  formatDateVN,
} from "@/lib/format";
import type { OrderPassengerInput } from "@/types/ota";

export const dynamic = "force-dynamic";

function normalizePhone(input: string): string {
  return input.trim().replace(/[\s.-]/g, "");
}

function buildQrMatrix(payload: string, size = 25): boolean[][] {
  const matrix: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );
  const reserved: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );

  const stampFinder = (top: number, left: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = top + r;
        const cc = left + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        reserved[rr][cc] = true;
        if (r === -1 || r === 7 || c === -1 || c === 7) {
          matrix[rr][cc] = false;
        } else if (
          r === 0 ||
          r === 6 ||
          c === 0 ||
          c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          matrix[rr][cc] = true;
        } else {
          matrix[rr][cc] = false;
        }
      }
    }
  };

  stampFinder(0, 0);
  stampFinder(0, size - 7);
  stampFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    reserved[6][i] = true;
    reserved[i][6] = true;
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Deterministic SHA-256 stream for data modules
  let digest = crypto.createHash("sha256").update(payload).digest();
  let bitIndex = 0;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (reserved[r][c]) continue;
      if (bitIndex >= digest.length * 8) {
        digest = crypto.createHash("sha256").update(digest).digest();
        bitIndex = 0;
      }
      const byte = digest[Math.floor(bitIndex / 8)];
      const bit = (byte >> (bitIndex % 8)) & 1;
      matrix[r][c] = bit === 1;
      bitIndex++;
    }
  }

  return matrix;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Tiền mặt khi đi tour",
  MOMO: "Ví MoMo",
  BANK_TRANSFER: "Chuyển khoản ngân hàng (VietQR)",
};

const GENDER_LABELS: Record<string, string> = {
  MALE: "Nam",
  FEMALE: "Nữ",
  OTHER: "Khác",
};

const TIER_LABELS: Record<string, string> = {
  ADULT: "Người lớn",
  CHILD: "Trẻ em",
  BABY: "Em bé",
};

export default async function OrderVoucherPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ phone?: string }>;
}) {
  const [{ code }, sp, currentUser] = await Promise.all([
    params,
    searchParams,
    getCurrentUser(),
  ]);

  const orderCode = decodeURIComponent(code || "").trim();
  const phoneParam = (sp.phone || "").trim();

  const order = await prisma.order.findFirst({
    where: { code: orderCode, deleted: false },
    include: {
      items: true,
    },
  });

  if (!order) {
    return (
      <div className="max-w-[680px] mx-auto px-4 py-14 text-center">
        <div className="bg-white rounded-[16px] border border-subtle p-8 shadow-sm space-y-4">
          <Ticket className="w-12 h-12 mx-auto text-ink-muted" />
          <h1 className="text-[22px] font-bold text-ink">
            Không tìm thấy e-Voucher #{orderCode}
          </h1>
          <p className="text-[14px] text-ink-muted">
            Mã đơn hàng không tồn tại hoặc đã bị xóa khỏi hệ thống.
          </p>
          <Link
            href="/tours"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-client-primary text-white text-[14px] font-semibold hover:bg-client-primary-hover transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại trang Tour</span>
          </Link>
        </div>
      </div>
    );
  }

  const isUserOwner = Boolean(currentUser && order.userId === currentUser.id);
  const isPhoneOwner = Boolean(
    phoneParam && normalizePhone(phoneParam) === normalizePhone(order.phone)
  );

  if (!isUserOwner && !isPhoneOwner) {
    return (
      <div className="max-w-[520px] mx-auto px-4 py-14">
        <div className="bg-white rounded-[16px] border border-subtle p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-client-soft text-client-primary flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-[19px] font-bold text-ink">
                Xác thực e-Voucher #{order.code}
              </h1>
              <p className="text-[13px] text-ink-muted">
                Nhập số điện thoại bạn đã dùng khi đặt tour để xem phiếu xác
                nhận.
              </p>
            </div>
          </div>

          {phoneParam && (
            <p className="p-3 rounded-[8px] bg-status-danger-bg border border-status-danger-border text-status-danger text-[13px] font-medium">
              Số điện thoại chưa khớp với đơn hàng #{order.code}.
            </p>
          )}

          <form method="GET" className="space-y-3">
            <div>
              <label
                htmlFor="voucher-phone"
                className="block text-[13px] font-medium text-ink mb-1.5"
              >
                Số điện thoại đặt tour
              </label>
              <input
                id="voucher-phone"
                name="phone"
                type="tel"
                required
                defaultValue={phoneParam}
                placeholder="Ví dụ: 0912345678"
                className="w-full h-[44px] px-3.5 rounded-[8px] border border-strong text-[14px] text-ink tabular-nums focus:outline-none focus:border-client-primary"
              />
            </div>
            <button
              type="submit"
              className="w-full h-[44px] rounded-[8px] bg-client-primary hover:bg-client-primary-hover text-white font-semibold text-[14px] transition-colors"
            >
              Mở e-Voucher
            </button>
          </form>
        </div>
      </div>
    );
  }

  const qrPayload = `VNTRAVEL|${order.code}|${order.paymentStatus}|${order.status}|${order.total}`;
  const qrMatrix = buildQrMatrix(qrPayload, 25);

  const isPaid = order.paymentStatus === "PAID";
  const isCancelled = order.status === "CANCELLED";

  const stampLabel =
    order.refundStatus === "REFUND_REQUIRED"
      ? "CẦN HOÀN TIỀN"
      : isCancelled
        ? "ĐÃ HỦY"
        : isPaid
          ? "ĐÃ THANH TOÁN"
          : "CHỜ THANH TOÁN";

  const stampClass =
    order.refundStatus === "REFUND_REQUIRED"
      ? "bg-status-warn-bg border-status-warn-border text-status-warn"
      : isCancelled
        ? "bg-status-danger-bg border-status-danger-border text-status-danger"
        : isPaid
          ? "bg-status-success-bg border-status-success-border text-status-success"
          : "bg-status-warn-bg border-status-warn-border text-status-warn";

  return (
    <div className="max-w-[920px] mx-auto px-4 py-8 space-y-5">
      <style>{`@media print { header, footer { display: none !important; } body { background: #ffffff !important; } }`}</style>

      {/* Top Action Bar (hidden when printing) */}
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
        <Link
          href={currentUser ? "/account/orders" : "/tours"}
          className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-client-primary hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>
            {currentUser ? "Quay lại Đơn hàng của tôi" : "Về danh sách Tour"}
          </span>
        </Link>
        <PrintVoucherButton />
      </div>

      {/* Boarding Pass / e-Voucher Sheet */}
      <article
        className="bg-white rounded-[18px] border border-subtle overflow-hidden print:border-strong print:shadow-none"
        style={{ boxShadow: "0 12px 32px rgba(22,34,41,0.08)" }}
      >
        {/* Top Brand Banner */}
        <div className="bg-client-deep text-white px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[12px] tracking-widest font-semibold text-client-sun">
              VN.TRAVEL • E-VOUCHER ĐIỆN TỬ
            </p>
            <h1 className="text-[22px] sm:text-[26px] font-extrabold mt-0.5 tabular-nums">
              MÃ ĐẶT CHỖ #{order.code}
            </h1>
            <p className="text-[12.5px] text-white/80 mt-0.5 tabular-nums">
              Ngày xuất phiếu: {formatDateTimeVN(order.createdAt)}
            </p>
          </div>

          <div
            className={`px-4 py-2 rounded-[10px] border-2 font-extrabold text-[13px] tracking-wider ${stampClass}`}
          >
            {stampLabel}
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {/* Customer Info + Pure SVG QR Matrix */}
          <div className="flex flex-col md:flex-row justify-between gap-6 pb-6 border-b border-dashed border-strong">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 flex-1 text-[14px]">
              <div>
                <p className="text-[12px] text-ink-muted">Khách hàng đại diện</p>
                <p className="font-bold text-ink">{order.fullName}</p>
              </div>
              <div>
                <p className="text-[12px] text-ink-muted">Số điện thoại</p>
                <p className="font-bold text-ink tabular-nums">{order.phone}</p>
              </div>
              <div>
                <p className="text-[12px] text-ink-muted">Email</p>
                <p className="font-semibold text-ink">
                  {order.email || "Chưa cung cấp"}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-ink-muted">
                  Phương thức thanh toán
                </p>
                <p className="font-semibold text-ink">
                  {PAYMENT_METHOD_LABELS[order.paymentMethod] ||
                    order.paymentMethod}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-ink-muted">Tổng thanh toán</p>
                <p className="text-[18px] font-extrabold text-client-accent tabular-nums">
                  {formatCurrencyVND(order.total)}
                </p>
              </div>
              {order.paidAt && (
                <div>
                  <p className="text-[12px] text-ink-muted">
                    Thời điểm thanh toán
                  </p>
                  <p className="font-semibold text-status-success tabular-nums inline-flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{formatDateTimeVN(order.paidAt)}</span>
                  </p>
                </div>
              )}
            </div>

            <div className="shrink-0 flex flex-col items-center justify-center bg-surface-page border border-subtle rounded-[12px] p-3.5">
              <svg
                viewBox="0 0 25 25"
                className="w-[120px] h-[120px] bg-white p-1.5 rounded-[8px] border border-subtle"
                role="img"
                aria-label={`Mã QR xác thực e-Voucher ${order.code}`}
              >
                {qrMatrix.map((row, rIdx) =>
                  row.map((filled, cIdx) =>
                    filled ? (
                      <rect
                        key={`${rIdx}-${cIdx}`}
                        x={cIdx}
                        y={rIdx}
                        width={1}
                        height={1}
                        fill="#162229"
                      />
                    ) : null
                  )
                )}
              </svg>
              <span className="mt-2 text-[11px] font-bold text-ink-muted tabular-nums">
                {order.code}
              </span>
            </div>
          </div>

          {/* Itinerary & Passenger Manifests */}
          <div className="space-y-6">
            {order.items.map((item, itemIdx) => {
              const itemPassengers = Array.isArray(item.passengers)
                ? (item.passengers as unknown as OrderPassengerInput[])
                : [];

              return (
                <div
                  key={item.id}
                  className="rounded-[14px] border border-subtle overflow-hidden"
                >
                  <div className="bg-client-soft px-4 py-3.5 border-b border-client-border flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11.5px] font-bold text-client-primary">
                        HÀNH TRÌNH {order.items.length > 1 ? `#${itemIdx + 1}` : ""}
                        {item.departureCode ? ` • ${item.departureCode}` : ""}
                      </p>
                      <h2 className="text-[16px] font-bold text-ink mt-0.5">
                        {item.name}
                      </h2>
                    </div>

                    <div className="text-[12.5px] font-semibold text-client-primary tabular-nums">
                      NL: {item.quantityAdult} • TE: {item.quantityChild} • EB:{" "}
                      {item.quantityBaby}
                      {item.singleRoomCount > 0
                        ? ` • P.Đơn: ${item.singleRoomCount}`
                        : ""}
                    </div>
                  </div>

                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[13px]">
                      <div className="flex items-center gap-2 text-ink">
                        <Calendar className="w-4 h-4 text-client-primary shrink-0" />
                        <div>
                          <p className="text-[11px] text-ink-muted">
                            Ngày khởi hành
                          </p>
                          <p className="font-bold tabular-nums">
                            {formatDateVN(item.departureDate)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-ink">
                        <MapPin className="w-4 h-4 text-client-primary shrink-0" />
                        <div>
                          <p className="text-[11px] text-ink-muted">
                            Điểm khởi hành
                          </p>
                          <p className="font-bold">{item.departureLocation}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-ink">
                        <Plane className="w-4 h-4 text-client-primary shrink-0" />
                        <div>
                          <p className="text-[11px] text-ink-muted">
                            Hãng &amp; Chuyến bay
                          </p>
                          <p className="font-bold">
                            {item.airline || "Theo lịch trình đoàn"}
                            {item.flightOut ? ` (${item.flightOut}` : ""}
                            {item.flightBack ? ` / ${item.flightBack})` : item.flightOut ? ")" : ""}
                          </p>
                        </div>
                      </div>
                    </div>

                    {itemPassengers.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-[13px]">
                          <thead>
                            <tr className="bg-surface-page border-y border-subtle text-ink-muted text-[12px]">
                              <th className="py-2 px-3 font-semibold">STT</th>
                              <th className="py-2 px-3 font-semibold">
                                Họ và tên hành khách
                              </th>
                              <th className="py-2 px-3 font-semibold">Hạng vé</th>
                              <th className="py-2 px-3 font-semibold">
                                Giới tính
                              </th>
                              <th className="py-2 px-3 font-semibold">
                                Ngày sinh
                              </th>
                              <th className="py-2 px-3 font-semibold">
                                CCCD / Hộ chiếu
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-subtle">
                            {itemPassengers.map((p, idx) => (
                              <tr key={idx}>
                                <td className="py-2 px-3 tabular-nums text-ink-muted">
                                  {idx + 1}
                                </td>
                                <td className="py-2 px-3 font-semibold text-ink">
                                  {p.fullName}
                                </td>
                                <td className="py-2 px-3 text-client-primary font-medium">
                                  {TIER_LABELS[p.tier] || p.tier}
                                </td>
                                <td className="py-2 px-3 text-ink">
                                  {GENDER_LABELS[p.gender] || p.gender}
                                </td>
                                <td className="py-2 px-3 tabular-nums text-ink">
                                  {formatDateVN(p.birthDate)}
                                </td>
                                <td className="py-2 px-3 tabular-nums text-ink-muted">
                                  {p.documentNumber || "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-subtle text-[12px] text-ink-muted flex flex-wrap items-center justify-between gap-2">
            <span>
              Vui lòng mang theo giấy tờ tùy thân hợp lệ và xuất trình mã QR này
              khi làm thủ tục tại điểm tập trung.
            </span>
            <span className="font-semibold text-client-primary">
              Hotline hỗ trợ: 1900 6868
            </span>
          </div>
        </div>
      </article>
    </div>
  );
}
