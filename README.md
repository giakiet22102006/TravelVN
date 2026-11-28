# TravelVN (`VN.TRAVEL`) — Nền Tảng Đặt Tour Du Lịch (Mini-OTA) & Cổng Quản Trị Toàn Diện

[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748.svg?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1.svg?logo=postgresql)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-06B6D4.svg?logo=tailwindcss)](https://tailwindcss.com/)
[![Gemini AI](https://img.shields.io/badge/AI-Google%20Gemini-8E75B2.svg)](https://ai.google.dev/)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel%20(sin1)-brightgreen.svg)](https://travel-vn-kappa.vercel.app)

**TravelVN (`VN.TRAVEL`)** là nền tảng thương mại điện tử đặt tour du lịch trực tuyến (mini-OTA) kết hợp cổng quản trị RBAC chuyên biệt, được xây dựng full-stack trên **Next.js 15 App Router**, **Prisma ORM**, **PostgreSQL**, **Google OAuth 2.0**, **Resend Transactional Email** và **Google Gemini AI (Tool Calling)**.

- **Live Production (Singapore `sin1`):** https://travel-vn-kappa.vercel.app
- **Source Repository:** https://github.com/giakiet22102006/TravelVN
- **API Specification (OpenAPI 3.0):** [`openapi.json`](./openapi.json)

---

## 1. Điểm Nhấn Kỹ Thuật (Engineering Highlights)

- **Multi-Departure Inventory & 15-Min TTL Seat Hold (`src/lib/order-holds.ts`):**
  - Tách riêng `Tour` và `TourDeparture` (nhiều ngày khởi hành, mã chuyến bay đi/về, phụ thu phòng đơn, tồn chỗ theo nhóm tuổi Người lớn/Trẻ em/Em bé).
  - Trừ chỗ nguyên tử (**atomic conditional `updateMany` với `gte`**) chống oversell / TOCTOU race condition; tự động nhả chỗ sau 15 phút bằng cơ chế **Just-in-Time lazy expiration** kết hợp Vercel Cron (`/api/cron/expire-orders`).
- **Idempotent Signed Payment Webhook & Late-Payment Compensation (`src/lib/payment-webhook.ts`):**
  - Xác thực chữ ký **HMAC-SHA256** bằng `crypto.timingSafeEqual` (chống timing attack) và chống xử lý trùng bằng `PaymentWebhookLog.eventId @unique`.
  - Dùng **pessimistic row-level locking (`SELECT ... FOR UPDATE`)** để xử lý cả tình huống **thanh toán muộn (late webhook)**: nếu đơn đã hết hạn giữ chỗ nhưng khách vẫn chuyển khoản thành công, hệ thống tự động thử giữ lại chỗ (`LATE_PAID_REAPPROVED`), hoặc rollback sạch giao dịch và gắn cờ `REFUND_REQUIRED` (`LATE_PAID_REFUND_REQUIRED`) để kế toán hoàn tiền mà không bao giờ lệch tồn kho.
- **Member Retention Suite (`src/lib/loyalty.ts`, `src/lib/order-claim.ts`):**
  - **Loyalty Ledger:** Phân hạng Đồng / Bạc / Vàng (`BRONZE` / `SILVER` / `GOLD`), thưởng chào mừng `+100` điểm, tích `1%`, quy đổi tối đa `20%` giá trị sau coupon với sổ cái bất biến `LoyaltyTransaction` (`@@unique([userId, orderId, type])`) chống cộng/trừ trùng.
  - **Zero-Hijack Guest Order Claim:** Liên kết đơn đặt của khách vãng lai vào tài khoản sau đăng nhập bằng token ký số an toàn.
  - **Saved Travelers & Wishlist:** Lưu hồ sơ hành khách đi cùng để tự động điền khi đặt tour.
- **Dual-Portal Security & RBAC (`src/lib/jwt.ts`, `src/lib/otp.ts`, `src/lib/permissions.ts`):**
  - Tách biệt hoàn toàn JWT `HttpOnly` cookie, `purpose` claim và namespace OTP giữa Khách hàng (`client_token`, `client_reset_token`) và Quản trị viên (`admin_token`, `admin_reset_token`).
  - Khôi phục mật khẩu OTP 6 số (SHA-256 + `timingSafeEqual`, khóa sau 5 lần sai, `pwdSig` vô hiệu hóa token cũ ngay khi đổi mật khẩu) gửi qua **Resend API** (`src/lib/email.ts`).
  - Security headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Permissions-Policy`, CSP sandbox riêng cho `/uploads`).
- **AI Concierge + Auto-Moderation + Denormalized Summaries (`src/lib/ai.ts`, `src/lib/ai-tools.ts`):**
  - **Gemini Model Fallback Chain** kèm **Tool Calling** truy vấn catalog & chính sách thực tế, fallback mượt sang Heuristic NLP khi thiếu API key.
  - Denormalize `aiReviewSummary`, `ratingAvg`, `reviewCount` trực tiếp lên bảng `Tour` để trang chi tiết tải tức thì không tốn truy vấn `GROUP BY` hay gọi LLM lúc đọc.
- **Caching, Testing & DevOps:**
  - Server-side caching bằng `unstable_cache` + `revalidateTag` tức thời; pin Vercel Serverless Region về **Singapore (`sin1`)**.
  - **CI Automated Gate (`.github/workflows/ci.yml`):** TypeScript check → Unit Test Suite (`npm test`) → Production Next.js build + Multi-stage `Dockerfile` (non-root user `nextjs` + `HEALTHCHECK`).
  - **5-Tier Opaque-Box E2E Suite (`scripts/e2e/run-all.mjs`):** Phủ từ tính năng, biên, đồng thời (concurrency), kịch bản end-to-end đến adversarial security.

---

## 2. Kiến Trúc Hệ Thống & Luồng Xử Lý Cốt Lõi

### 2.1. Tổng quan kiến trúc

```text
Browser (Client Storefront / Admin Portal)
   │
   ├──► Next.js 15 App Router (RSC + Client Components)
   │       ├── Client Storefront: /, /tours, /tours/[slug], /cart, /news, /account/*, /login, /forgot-password
   │       └── Admin Portal:      /admin/* (RBAC Protected + News CMS + Departures + Reviews)
   │
   ├──► API Route Handlers (/api/client/*, /api/admin/*, /api/webhooks/payment, /api/cron/*)
   │       ├── Auth & Security:   JWT HttpOnly + Google OAuth 2.0 + OTP Recovery + RBAC
   │       ├── Core OTA Engine:   Atomic Seat Holds (15m TTL) + Signed Webhook + Loyalty Ledger
   │       ├── Cache Layer:       unstable_cache + revalidateTag
   │       └── AI Engine:         Gemini Tool Calling Fallback Chain -> Heuristic NLP
   │
   └──► PostgreSQL (Neon Serverless + Prisma 6) + Cloudinary + Resend Email
```

### 2.2. Sequence Diagram: Giữ chỗ 15 phút & Xử lý Late Payment Webhook

```mermaid
sequenceDiagram
    actor User as Khách hàng
    participant API as Next.js API
    participant DB as PostgreSQL (Prisma)
    participant Bank as Payment Webhook (SePay/VietQR)

    User->>API: POST /api/client/orders (chọn ngày khởi hành & số khách)
    API->>DB: BEGIN TX -> updateMany TourDeparture (stock >= qty)
    alt Hết chỗ (count = 0)
        DB-->>API: Rollback
        API-->>User: 409 Conflict (Không đủ chỗ)
    else Đủ chỗ
        API->>DB: Tạo Order (INITIAL, UNPAID, expiresAt = +15m)
        DB-->>API: COMMIT
        API-->>User: 201 Created + VietQR / Hướng dẫn thanh toán
    end

    Note over API,DB: Sau 15 phút chưa thanh toán -> Lazy Expire / Cron hủy đơn & hoàn chỗ

    Bank->>API: POST /api/webhooks/payment (X-Webhook-Signature)
    API->>API: Verify HMAC-SHA256 (timingSafeEqual) & check eventId idempotency
    API->>DB: BEGIN TX -> SELECT Order ... FOR UPDATE
    alt Đơn còn INITIAL
        API->>DB: Update APPROVED + PAID, cộng điểm Loyalty, ghi WebhookLog
        DB-->>API: COMMIT
        API-->>Bank: 200 OK (PAID_APPROVED) + Gửi Email e-Voucher (Resend)
    else Đơn đã CANCELLED (Late Payment)
        API->>DB: Thử reserveOrderItemStock + reconcile điểm
        alt Còn đủ chỗ
            API->>DB: Update APPROVED + PAID (LATE_PAID_REAPPROVED)
            API-->>Bank: 200 OK + Gửi Email e-Voucher
        else Hết chỗ (Rollback)
            API->>DB: Ghi PAID + REFUND_REQUIRED (LATE_PAID_REFUND_REQUIRED)
            API-->>Bank: 200 OK (Cờ hoàn tiền cho Admin)
        end
    end
```

### 2.3. Sequence Diagram: Khôi Phục Mật Khẩu OTP (Domain-Separated)

```mermaid
sequenceDiagram
    actor User as Khách hàng / Admin
    participant API as Auth API
    participant DB as PostgreSQL (ForgotPassword)
    participant Email as Resend API

    User->>API: POST /forgot-password { email }
    API->>API: Rate limit (3 req / 5m) + Generate 6-digit OTP
    API->>DB: Lưu SHA-256(scope:email:otp) + TTL 5 phút (tách namespace admin vs client)
    API->>Email: Gửi email OTP (fallback console log ở dev)
    API-->>User: 200 OK (Generic anti-enumeration message)

    User->>API: POST /otp-password { email, otp }
    API->>DB: Lấy bản ghi OTP còn hạn
    API->>API: timingSafeEqual(hash) — sai >= 5 lần tự xóa bản ghi
    API-->>User: Set HttpOnly Reset Cookie (JWT purpose riêng + pwdSig, TTL 10m)

    User->>API: POST /reset-password { password, confirmPassword }
    API->>API: Verify Reset Cookie + đối chiếu pwdSig (chống dùng lại token)
    API->>DB: Update bcrypt hash mật khẩu mới
    API-->>User: Xóa Reset Cookie + 200 OK
```

---

## 3. Phân Hệ Tính Năng Chính

| Phân hệ | Route tiêu biểu | Tính năng nổi bật |
| --- | --- | --- |
| **Storefront & Search** | `/`, `/tours`, `/tours/[slug]` | Tìm kiếm autocomplete, lọc đa chiều (danh mục, giá, ngày khởi hành, phương tiện), so sánh tour (`CompareDrawer`), lịch khởi hành (`TourDepartureCalendar`), bản đồ lộ trình (`TourRouteMap`), tour đã xem gần đây. |
| **Checkout & e-Voucher** | `/cart`, `/orders/[code]/voucher` | Validate giỏ hàng thời gian thực, áp coupon + quy đổi điểm thưởng, tạo đơn giữ chỗ 15 phút, trang e-Voucher QR có thể in và gửi kèm qua email Resend. |
| **Member Retention** | `/account`, `/account/orders`, `/account/travelers`, `/account/wishlist` | Theo dõi đơn hàng & hủy đơn trực tuyến, sổ điểm thưởng & hạng thành viên, sổ hành khách đã lưu, danh sách yêu thích, khôi phục mật khẩu OTP (`/forgot-password`). |
| **News & Cẩm nang** | `/news`, `/news/[slug]` | Trang tin tức/cẩm nang du lịch kết hợp bộ đếm lượt xem và gợi ý điểm đến liên quan. |
| **Gemini AI Suite** | `/api/client/ai/chat`, `/api/client/tours/[slug]/reviews` | Trợ lý du lịch AI có Tool Calling tìm tour theo ngân sách; tự động kiểm duyệt bình luận (`422 AI_MODERATION_BLOCKED`); tóm tắt ưu/nhược điểm đánh giá theo tour. |
| **Admin RBAC Portal** | `/admin/*` | Dashboard doanh thu, CRUD Tour & Multi-Departures, Thùng rác & khôi phục, Quản lý Đơn hàng & hoàn tiền, Quản lý Đánh giá (ẩn/hiện, phản hồi, regenerate AI summary), News CMS, Khách hàng, Liên hệ, Vai trò & Phân quyền RBAC. |

---

## 4. Cấu Trúc Thư Mục Dự Án

```text
TravelVN/
├── .github/workflows/ci.yml    # GitHub Actions CI (typecheck -> unit tests -> build)
├── prisma/
│   ├── schema.prisma           # 14 models (Tour, TourDeparture, Order, User, Loyalty, WebhookLog...)
│   └── seed.ts                 # Seed catalog, multi-departures, RBAC roles, reviews, news
├── scripts/e2e/                # Bộ E2E 5-tier (features, boundaries, concurrency, scenarios, adversarial)
├── tests/unit/                 # Unit tests chạy trong CI (OTP, JWT, HMAC webhook, coupons, loyalty, rate-limit)
├── src/
│   ├── app/
│   │   ├── (client)/           # Storefront, /forgot-password, /account/*, /news/*, /orders/[code]/voucher
│   │   ├── (admin)/admin/      # Admin Dashboard & CRUD modules (RBAC protected)
│   │   └── api/                # /api/client/*, /api/admin/*, /api/webhooks/payment, /api/cron/*, /api/health
│   ├── components/             # UI components tách biệt client/ và admin/
│   ├── lib/                    # Core domain services (order-holds, payment-webhook, loyalty, otp, ai, email...)
│   └── middleware.ts           # Edge route guard & session normalization
├── Dockerfile                  # Multi-stage standalone build (non-root + HEALTHCHECK)
├── next.config.mjs             # Security headers & image remotePatterns
├── openapi.json                # Đặc tả OpenAPI 3.0.3 cho toàn bộ 70 API routes
└── vercel.json                 # Pin region sin1 + cron /api/cron/expire-orders
```

---

## 5. Architectural Trade-offs & Lộ Trình Production Scaling

Các đánh đổi kỹ thuật được lựa chọn có chủ đích cho giai đoạn MVP/Đồ án và hướng nâng cấp khi chạy thương mại tải cao:

| Thành phần | Hiện tại (MVP / Serverless) | Trade-off | Lộ trình nâng cấp Production |
| --- | --- | --- | --- |
| **Rate Limiting** | In-memory sliding window (`src/lib/rate-limit.ts`) | Không tốn chi phí infra ngoài, nhưng state không đồng bộ giữa nhiều serverless instance. | Chuyển sang **Upstash Redis** sliding window / fixed window phân tán. |
| **DB Schema Sync** | `prisma db push` | Nhanh khi lặp prototype trên Neon dev DB, không có lịch sử migration versioned. | Chuyển sang **`prisma migrate deploy`** có kiểm soát rollback trong CI/CD. |
| **Coupon Catalog** | Khai báo tập trung trong `src/lib/knowledge/coupons.ts` | Đảm bảo type-safe và đọc `O(1)` không tốn query DB; cần deploy khi thêm mã mới. | Đưa bảng `Coupon` + `CouponRedemption` vào DB kèm Admin CRUD & giới hạn lượt dùng. |
| **Hold Expiry Cron** | Lazy expiration + Vercel Cron hằng ngày (`0 2 * * *`) | Tương thích Vercel Hobby plan; tồn kho luôn chính xác lúc đọc/ghi nhờ lazy expire. | Nâng tần suất cron lên mỗi 5 phút (Vercel Pro / QStash / GitHub Actions schedule). |

---

## 6. Cài Đặt, Kiểm Thử & Khởi Chạy

### 6.1. Yêu cầu môi trường
- **Node.js** `>= 20.0.0` (LTS)
- **PostgreSQL** (local hoặc Neon Serverless PostgreSQL)

### 6.2. Cấu hình `.env`
```bash
git clone https://github.com/giakiet22102006/TravelVN.git
cd TravelVN
npm install
cp .env.example .env
```

Các biến môi trường chính:
```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/neondb?sslmode=require"
JWT_SECRET="replace-with-strong-random-secret-at-least-32-chars"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
PAYMENT_WEBHOOK_SECRET=""   # Tùy chọn; fallback JWT_SECRET
RESEND_API_KEY=""           # Gửi email e-Voucher & OTP (để trống sẽ log OTP ở dev)
RESEND_FROM_EMAIL=""        # Ví dụ: "VN.TRAVEL <no-reply@yourdomain.com>"
CLOUDINARY_URL=""           # Lưu ảnh production (để trống fallback /public/uploads)
GOOGLE_CLIENT_ID=""         # Để trống tự bật OAuth Sandbox local
GOOGLE_CLIENT_SECRET=""
GEMINI_API_KEY=""           # Để trống tự chuyển Heuristic NLP Fallback
```

### 6.3. Đồng bộ DB, Chạy Test & Khởi chạy

```bash
# 1. Đồng bộ schema & nạp dữ liệu mẫu
npm run db:push
npm run db:seed

# 2. Chạy Unit Tests (OTP, JWT, HMAC Webhook, Coupons, Loyalty, Rate-limit)
npm test

# 3. Chạy Development server
npm run dev

# 4. Chạy 5-Tier Opaque-Box E2E Suite (yêu cầu server đang chạy ở localhost:3000)
node scripts/e2e/run-all.mjs

# 5. Build & chạy Production local
npm run build
npm run start
```

### 6.4. Chạy bằng Docker
```bash
docker build -t travelvn .
docker run -p 3000:3000 --env-file .env travelvn
```

---

## 7. Tài Khoản Demo (Sau Khi Seed)

- **Admin (`/admin/account/login`):** `levana@gmail.com` / `Admin@123` (hoặc `admin@vntravel.com` / `Admin@123`)
- **Khách hàng (`/login`):** `levana@gmail.com` / `Admin@123` hoặc đăng nhập nhanh qua **Google OAuth / OAuth Sandbox** (`minhanh.google@gmail.com`)
