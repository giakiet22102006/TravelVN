export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function formatCurrencyVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount) + "đ";
}

const VN_DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const VN_DATETIME_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour12: false,
});

export function formatDateTimeVN(
  dateInput: Date | string | null | undefined
): string {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "";
  const parts = VN_DATETIME_FMT.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return `${get("hour")}:${get("minute")} - ${get("day")}/${get("month")}/${get("year")}`;
}

export function formatDateVN(
  dateInput: Date | string | null | undefined
): string {
  if (!dateInput) return "Đang cập nhật";
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "Đang cập nhật";
  // Fixed Asia/Ho_Chi_Minh timezone prevents SSR (UTC) vs Browser (UTC+7) hydration mismatch (#418)
  return VN_DATE_FMT.format(d);
}

export function calcDiscountPercent(
  oldPrice: number,
  newPrice: number
): number {
  if (oldPrice <= newPrice || newPrice <= 0 || oldPrice <= 0) return 0;
  return Math.round(((oldPrice - newPrice) / oldPrice) * 100);
}
