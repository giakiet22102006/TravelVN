interface OrderConfirmationEmailItem {
  name: string;
  departureLocation: string;
  departureDate?: Date | string | null;
  quantityAdult: number;
  quantityChild: number;
  quantityBaby: number;
}

export interface SendOrderConfirmationEmailInput {
  to?: string | null;
  orderCode: string;
  fullName: string;
  total: number;
  paymentStatus: string;
  voucherUrl: string;
  items: OrderConfirmationEmailItem[];
}

export interface SendEmailResult {
  sent: boolean;
  skipped?: boolean;
  error?: string;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount) + "đ";
}

export async function sendOrderConfirmationEmail(
  input: SendOrderConfirmationEmailInput
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const to = input.to?.trim();

  if (!apiKey || !to) {
    return { sent: false, skipped: true };
  }

  const fromEmail =
    process.env.RESEND_FROM_EMAIL?.trim() || "VN.TRAVEL <onboarding@resend.dev>";

  const isPaid = input.paymentStatus === "PAID";
  const statusText = isPaid ? "Đã thanh toán & Xác nhận" : "Đang chờ thanh toán";

  const itemsHtml = input.items
    .map((item) => {
      const safeName = escapeHtml(item.name);
      const safeLoc = escapeHtml(item.departureLocation || "Hà Nội");
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #E2E0D8;color:#162229;font-weight:600;">
            ${safeName}<br/>
            <span style="font-size:12px;color:#53626B;font-weight:400;">Khởi hành tại: ${safeLoc}</span>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #E2E0D8;color:#162229;text-align:right;font-size:13px;white-space:nowrap;">
            NL: ${item.quantityAdult} | TE: ${item.quantityChild} | EB: ${item.quantityBaby}
          </td>
        </tr>
      `;
    })
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#F8F7F3;padding:24px;border-radius:12px;">
      <div style="background:#FFFFFF;border:1px solid #E2E0D8;border-radius:12px;padding:24px;">
        <h1 style="margin:0 0 8px;font-size:20px;color:#1E6078;">VN.TRAVEL — Xác nhận đơn hàng #${escapeHtml(input.orderCode)}</h1>
        <p style="margin:0 0 16px;font-size:14px;color:#53626B;">
          Xin chào <strong style="color:#162229;">${escapeHtml(input.fullName)}</strong>, cảm ơn bạn đã đặt tour tại VN.TRAVEL.
        </p>

        <div style="background:#EAF2F5;border:1px solid #C4D9E2;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:14px;color:#162229;">
          <div><strong>Mã đơn hàng:</strong> ${escapeHtml(input.orderCode)}</div>
          <div style="margin-top:4px;"><strong>Trạng thái thanh toán:</strong> ${statusText}</div>
          <div style="margin-top:4px;"><strong>Tổng thanh toán:</strong> <span style="color:#BA4B2D;font-weight:700;">${formatVND(input.total)}</span></div>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px 12px;border-bottom:2px solid #E2E0D8;color:#53626B;font-size:12px;">Hành trình</th>
              <th style="text-align:right;padding:8px 12px;border-bottom:2px solid #E2E0D8;color:#53626B;font-size:12px;">Hành khách</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div style="text-align:center;">
          <a href="${escapeHtml(input.voucherUrl)}" style="display:inline-block;background:#1E6078;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;">
            Xem &amp; In e-Voucher (QR)
          </a>
        </div>
      </div>
    </div>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject: `[VN.TRAVEL] Xác nhận đơn hàng #${input.orderCode}`,
        html,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        sent: false,
        error: `Resend API ${res.status}: ${errText.slice(0, 200)}`,
      };
    }

    return { sent: true };
  } catch (err) {
    return {
      sent: false,
      error: err instanceof Error ? err.message : "Email send failed",
    };
  }
}
