# TravelVN (`VN.TRAVEL`) - Nền Tảng Đặt Tour Du Lịch & Cổng Quản Trị Toàn Diện

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black.svg?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748.svg?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1.svg?logo=postgresql)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-06B6D4.svg?logo=tailwindcss)](https://tailwindcss.com/)
[![Gemini AI](https://img.shields.io/badge/AI-Google%20Gemini-8E75B2.svg)](https://ai.google.dev/)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel%20(sin1)-brightgreen.svg)](https://travel-vn-kappa.vercel.app)

**TravelVN (`VN.TRAVEL`)** là nền tảng thương mại điện tử đặt tour du lịch trực tuyến (tour trong nước & quốc tế) kết hợp cổng quản trị RBAC chuyên biệt, được xây dựng full-stack trên **Next.js 15 App Router**, **Prisma ORM**, **PostgreSQL**, **Google OAuth 2.0** và bộ 3 tính năng **Google Gemini AI**.

- **Live Production (Singapore `sin1`):** https://travel-vn-kappa.vercel.app
- **Source Repository:** https://github.com/giakiet22102006/TravelVN

---

## 1. Công Nghệ Sử Dụng (Tech Stack)

- **Frontend & SSR/RSC:** Next.js 15 App Router, React 19, TypeScript 5.7, Tailwind CSS 3.4, Lucide Icons.
- **Backend & API Layer:** Next.js Route Handlers (`src/app/api/**`) kết hợp Next.js Middleware (`src/middleware.ts`) bảo vệ route và chuẩn hóa phiên đăng nhập.
- **Database & ORM:** PostgreSQL (Neon Serverless) với **Prisma 6** (`prisma/schema.prisma`), thiết kế index tối ưu cho truy vấn catalog, đơn hàng và đánh giá (`@@index([tourId, deleted, status, createdAt])`).
- **Xác Thực & Bảo Mật:**
  - **JWT (`jose`)** lưu qua `HttpOnly` cookie tách biệt giữa phân hệ Khách hàng và Quản trị viên.
  - Mật khẩu băm bằng **`bcryptjs`**.
  - **Google OAuth 2.0** (`src/lib/oauth.ts`) tích hợp xác thực một chạm, tự động chuyển sang chế độ **OAuth Sandbox** khi chạy local chưa cấu hình `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
  - **RBAC (Role-Based Access Control)** (`src/lib/permissions.ts`): phân quyền chi tiết theo từng module (`tour_*`, `category_*`, `order_*`, `user_*`, `review_*`, `role_*`, `account_*`, `website_*`).
- **Tích Hợp AI (`src/lib/ai.ts`):**
  - **Dual-Engine + Model Fallback Chain:** Gọi Gemini REST API theo chuỗi ưu tiên `gemini-3.5-flash-lite` → `gemini-3.8-flash` → `gemini-3.7-flash` (tự động chuyển model khi gặp `404` / `429` / `5xx` hoặc timeout) và fallback mượt mà sang bộ xử lý NLP/Heuristic tiếng Việt khi vắng API key.
- **Hiệu Năng & Caching (`src/lib/cache-tags.ts`, `src/lib/client-data.ts`):**
  - Pin Vercel Serverless Region về **Singapore (`sin1`)** trong `vercel.json` để giảm độ trễ mạng tới database khu vực Đông Nam Á.
  - Server-side caching bằng `unstable_cache` kèm cơ chế `revalidateTag` tức thời mỗi khi Admin/Client ghi dữ liệu.
- **Lưu Trữ Media (`src/lib/storage.ts`):** Hỗ trợ **Cloudinary** (`CLOUDINARY_URL`) trên production hoặc fallback lưu cục bộ `/public/uploads` khi dev.
- **DevOps & CI/CD:** Docker multi-stage build (`Dockerfile`, `.dockerignore`), GitHub Actions CI (`.github/workflows/ci.yml`), Vercel CLI deployment.

---

## 2. Kiến Trúc Hệ Thống & Tính Năng Chính

### 2.1. Kiến trúc tổng quan
```text
Browser (Client / Admin)
   │
   ├──► Next.js App Router (RSC + Client Components)
   │       ├── Client Storefront: /, /tours, /tours/[slug], /cart, /account
   │       └── Admin Dashboard:   /admin/* (RBAC Protected)
   │
   ├──► API Route Handlers (/api/client/*, /api/admin/*)
   │       ├── Cache Layer: unstable_cache + revalidateTag
   │       ├── Auth Layer:  JWT HttpOnly + Google OAuth 2.0 + RBAC
   │       └── AI Engine:   Gemini Fallback Chain -> Heuristic NLP Fallback
   │
   └──► PostgreSQL (Prisma ORM) + Cloudinary Media Storage
```

### 2.2. Phân hệ Khách hàng (Client Storefront)
- **Trang chủ & Catalog Tour (`/`, `/tours`):** Lọc đa điều kiện (danh mục trong nước/nước ngoài, mức giá, ngày khởi hành, phương tiện, sắp xếp theo giá/độ phổ biến), hiển thị điểm đánh giá thực tế `ratingAvg (reviewCount)` hoặc badge `Mới`.
- **Chi tiết Tour & Đánh giá (`/tours/[slug]`):**
  - Lịch trình chi tiết theo ngày, giá theo độ tuổi (Người lớn / Trẻ em / Em bé), chọn điểm khởi hành & số lượng.
  - **Hệ thống Đánh giá & Bình luận (`TourReviewsSection.tsx`):** Gửi đánh giá 1–5 sao, thanh thống kê phân bố sao (5★ → 1★), lọc theo số sao hoặc chỉ khách đã đi tour, hiển thị huy hiệu xanh **`Đã trải nghiệm tour`** (xác minh tự động từ lịch sử `Order` không bị hủy) và **`Phản hồi từ VN.TRAVEL`**.
- **Giỏ hàng & Đặt tour (`/cart`, `/account/orders`):** Hỗ trợ thanh toán Tiền mặt / Chuyển khoản ngân hàng (kèm QR/thông tin chuyển khoản) / VNPay, theo dõi trạng thái đơn và hủy đơn trực tuyến.

### 2.3. Bộ 3 Tính Năng Gemini AI (`src/lib/ai.ts`)
1. **AI Auto-Moderation (`POST /api/client/tours/[slug]/reviews`):** Kiểm duyệt nội dung bình luận ngay tại server-side trước khi lưu DB; chặn ngôn từ thô tục, spam, link quảng cáo/cá độ (`422 AI_MODERATION_BLOCKED`) và tự động gán nhãn cảm xúc (`POSITIVE` / `NEUTRAL` / `NEGATIVE`).
2. **AI Review Summary (`src/lib/review-service.ts`):** Tổng hợp toàn bộ đánh giá của từng tour thành cấu trúc JSON (`overview`, `pros`, `cons`, `tips`) và **denormalize** trực tiếp lên cột `Tour.aiReviewSummary`, `Tour.ratingAvg`, `Tour.reviewCount` để trang chi tiết tải tức thì không tốn truy vấn `GROUP BY` hay gọi LLM lúc đọc.
3. **AI Travel Assistant (`AiTravelAssistant.tsx`, `POST /api/client/ai/chat`):** Trợ lý chat nổi tư vấn lịch trình theo ngân sách (ví dụ: *"Tour biển dưới 5 triệu"*), đối chiếu catalog thực tế và trả về top 3 thẻ tour gợi ý kèm link đặt ngay.

### 2.4. Cổng Quản Trị Admin (`/admin`)
- **Dashboard (`/admin/dashboard`):** Tổng quan doanh thu, đơn hàng, biểu đồ trạng thái.
- **Quản lý Tour & Danh mục (`/admin/tours`, `/admin/tours/trash`, `/admin/categories`):** CRUD đầy đủ, hỗ trợ thao tác hàng loạt (bulk actions), xóa mềm & khôi phục từ thùng rác.
- **Quản lý Đánh giá (`/admin/reviews`):** Lọc bình luận theo trạng thái/từ khóa, ẩn/hiện (`ACTIVE` / `INACTIVE`), gửi phản hồi chính thức, xóa mềm và kích hoạt làm mới tóm tắt AI (`regenerate_summary`).
- **Quản lý Đơn hàng, Khách hàng, Liên hệ & Hệ thống RBAC (`/admin/orders`, `/admin/users`, `/admin/contacts`, `/admin/settings/*`).**

---

## 3. Cấu Trúc Thư Mục Dự Án

```text
TravelVN/
├── .github/
│   └── workflows/ci.yml        # GitHub Actions CI pipeline
├── prisma/
│   ├── schema.prisma           # Data models (Tour, Category, Order, User, Review, Role, AdminAccount...)
│   └── seed.ts                 # Database seeding (tours, categories, RBAC roles, sample reviews)
├── public/
│   └── uploads/                # Thư mục lưu ảnh local fallback
├── src/
│   ├── app/
│   │   ├── (client)/           # Storefront pages (/, /tours, /tours/[slug], /cart, /account, /login)
│   │   ├── (admin)/admin/      # Admin dashboard & management pages
│   │   └── api/
│   │       ├── client/         # Public & Customer APIs (tours, reviews, ai/chat, auth/oauth, orders)
│   │       ├── admin/          # RBAC-protected Admin APIs (tours, reviews, orders, users, settings)
│   │       ├── health/         # Healthcheck endpoint (/api/health)
│   │       └── upload/         # Media upload endpoint (/api/upload)
│   ├── components/
│   │   ├── client/             # TourCard, TourReviewsSection, AiTravelAssistant, SocialOAuthButtons...
│   │   └── admin/              # AdminShell, TourForm, CategoryForm, RoleForm...
│   ├── lib/
│   │   ├── ai.ts               # Gemini Fallback Chain + Heuristic NLP (Moderation, Summary, Chat)
│   │   ├── review-service.ts   # Sync ratingAvg, reviewCount, aiReviewSummary & Verified Booking check
│   │   ├── client-data.ts      # Cached server queries (unstable_cache)
│   │   ├── cache-tags.ts       # Cache tag invalidation helpers
│   │   ├── oauth.ts            # Google OAuth 2.0 + Sandbox provider
│   │   ├── permissions.ts      # RBAC permission matrix
│   │   ├── auth.ts / jwt.ts    # JWT signing/verification & session helpers
│   │   └── prisma.ts           # PrismaClient singleton
│   └── middleware.ts           # Route protection middleware
├── .env.example                # Mẫu biến môi trường chuẩn
├── Dockerfile                  # Multi-stage Docker production build
├── next.config.mjs             # Next.js config
├── vercel.json                 # Pin region Singapore (sin1)
└── package.json                # Dependencies & NPM scripts
```

---

## 4. Hướng Dẫn Cài Đặt & Khởi Chạy

### 4.1. Yêu cầu tiên quyết
- **Node.js** `>= 18.0.0` (khuyến nghị Node 20 LTS hoặc 22 LTS).
- **PostgreSQL** (local hoặc Neon Serverless PostgreSQL).

### 4.2. Cài đặt & Cấu hình môi trường
```bash
git clone https://github.com/giakiet22102006/TravelVN.git
cd TravelVN
npm install
cp .env.example .env
```

Cập nhật các biến trong `.env`:
```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/neondb?sslmode=require"
JWT_SECRET="replace-with-strong-random-secret"
CLOUDINARY_URL=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GEMINI_API_KEY=""
```
> **Lưu ý:**
> - Nếu để trống `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, nút đăng nhập Google tự chuyển sang **OAuth Sandbox** để test luồng ngay trên local. Nếu cấu hình Google Cloud OAuth, thêm Authorized redirect URI: `http://localhost:3000/api/client/auth/oauth/google/callback`.
> - Nếu để trống `GEMINI_API_KEY`, cả 3 tính năng AI tự động chạy qua **Heuristic NLP Fallback**, không gây lỗi hệ thống.

### 4.3. Đồng bộ Schema & Nạp Dữ Liệu Mẫu
```bash
npm run db:push
npm run db:seed
```

### 4.4. Chạy Development / Production
```bash
# Development
npm run dev

# Build & chạy Production local
npm run build
npm run start
```
Truy cập:
- **Client Storefront:** http://localhost:3000
- **Admin Portal:** http://localhost:3000/admin
- **Healthcheck:** http://localhost:3000/api/health

### 4.5. Chạy bằng Docker
```bash
docker build -t travelvn .
docker run -p 3000:3000 --env-file .env travelvn
```

---

## 5. Scripts & Tài Khoản Demo (Sau Khi Seed)

| Lệnh | Mô tả |
| --- | --- |
| `npm run dev` | Khởi chạy Next.js development server |
| `npm run build` | Generate Prisma Client và build production bundle |
| `npm run start` | Khởi chạy production server |
| `npm run db:push` | Push schema Prisma lên PostgreSQL |
| `npm run db:seed` | Nạp dữ liệu mẫu (tours, danh mục, RBAC, user & reviews) |

**Tài khoản mẫu từ `prisma/seed.ts`:**
- **Admin (`/admin/account/login`):** `levana@gmail.com` / `Admin@123` (hoặc `admin@vntravel.com` / `Admin@123`)
- **Khách hàng (`/login`):** `levana@gmail.com` / `Admin@123` hoặc đăng nhập nhanh qua Google OAuth / OAuth Sandbox (`minhanh.google@gmail.com`)
