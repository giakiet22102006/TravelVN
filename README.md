# TravelVN (`28.TRAVEL`)

Nền tảng đặt tour du lịch trực tuyến (trong nước & nước ngoài) xây dựng bằng **Next.js 15 App Router**, **Prisma ORM**, **PostgreSQL**, **Google OAuth 2.0**, và tích hợp bộ 3 tính năng **Gemini AI** (kiểm duyệt bình luận, tóm tắt đánh giá tour, trợ lý tư vấn tour).

- **Live Production:** https://travel-vn-kappa.vercel.app
- **Repository:** https://github.com/giakiet22102006/TravelVN

---

## Tính năng nổi bật

### 1. Client Storefront (`/`, `/tours`, `/tours/[slug]`, `/cart`, `/account`)
- Tìm kiếm, lọc tour theo danh mục, mức giá, ngày khởi hành, phương tiện và sắp xếp.
- Trang chi tiết tour đầy đủ lịch trình, bảng giá người lớn / trẻ em / em bé, và **Hệ thống đánh giá & bình luận** (1–5 sao, lọc theo số sao / khách đã trải nghiệm tour, badge `"Đã trải nghiệm tour"` đối chiếu trực tiếp từ lịch sử `Order`).
- Giỏ hàng & đặt tour (`VNPay` / `Chuyển khoản ngân hàng` / `Tiền mặt`), theo dõi & hủy đơn hàng tại `/account/orders`.
- Đăng nhập / đăng ký truyền thống (JWT `HttpOnly` cookie + `bcryptjs`) hoặc **Google OAuth 2.0** với OAuth Sandbox fallback khi chưa cấu hình credential.

### 2. Tích hợp Gemini AI (`src/lib/ai.ts`)
- **Dual-Engine + Model Fallback Chain:** Tự động gọi Gemini REST API (`gemini-3.5-flash-lite` → `gemini-3.8-flash` → `gemini-3.7-flash`) khi có `GEMINI_API_KEY`, và fallback mượt mà sang bộ xử lý NLP/Heuristic tiếng Việt khi mất mạng hoặc hết quota để không bao giờ gây lỗi `500`.
- **AI Auto-Moderation (`POST /api/client/tours/[slug]/reviews`):** Tự động chặn ngôn từ thô tục, spam, link cá độ/quảng cáo (trả `422 AI_MODERATION_BLOCKED`) và phân loại cảm xúc (`POSITIVE` / `NEUTRAL` / `NEGATIVE`).
- **AI Review Summary (`Tour.aiReviewSummary`):** Tổng hợp đánh giá của khách hàng thành Ưu điểm, Lưu ý, Mẹo đi tour và lưu denormalized trên bảng `Tour`, tự động cập nhật khi có review mới hoặc khi admin regenerate.
- **AI Travel Assistant (`POST /api/client/ai/chat`):** Widget chat nổi tư vấn lịch trình theo ngân sách/sở thích và gợi ý top 3 tour phù hợp từ catalog.

### 3. Admin Dashboard (`/admin`)
- Thống kê doanh thu, đơn hàng, quản lý Tour (tạo, sửa, xóa mềm/khôi phục trong thùng rác), Danh mục, Đơn hàng, Khách hàng, Liên hệ.
- **Quản lý đánh giá (`/admin/reviews`):** Lọc bình luận, ẩn/hiện (`ACTIVE` / `INACTIVE`), phản hồi chính thức từ `28.TRAVEL`, xóa mềm, và làm mới tóm tắt AI.
- Phân quyền **RBAC** chi tiết (`Role` & `permissions`) cho tài khoản quản trị.

### 4. Tối ưu hiệu năng & Vận hành
- Pin Serverless Region về Singapore (`sin1`) trong `vercel.json` để tối ưu độ trễ kết nối tới DB khu vực Đông Nam Á.
- Caching dữ liệu catalog bằng `unstable_cache` + tag revalidation (`src/lib/cache-tags.ts`) mỗi khi Admin/Client ghi dữ liệu.
- Hỗ trợ Docker multi-stage (`Dockerfile`) và GitHub Actions CI (`.github/workflows/ci.yml`).

---

## Tech Stack

- **Framework:** Next.js 15 (App Router, React 19, TypeScript)
- **Styling:** Tailwind CSS, Lucide Icons
- **Database & ORM:** PostgreSQL + Prisma 6 (`prisma/schema.prisma`)
- **Auth & Security:** `jose` (JWT), `bcryptjs`, Google OAuth 2.0
- **Media Storage:** Cloudinary (`CLOUDINARY_URL`) hoặc local `/public/uploads`
- **AI:** Google Gemini REST API (`GEMINI_API_KEY`)

---

## Cài đặt & Chạy Local

### 1. Clone repo & cài dependencies
```bash
git clone https://github.com/giakiet22102006/TravelVN.git
cd TravelVN
npm install
```

### 2. Cấu hình biến môi trường
Copy file mẫu `.env.example` thành `.env` và điền thông tin:
```bash
cp .env.example .env
```

Các biến trong `.env.example`:
- `DATABASE_URL`: Connection string PostgreSQL (ví dụ Neon).
- `JWT_SECRET`: Chuỗi bí mật ký JWT session.
- `CLOUDINARY_URL` *(tùy chọn)*: URL Cloudinary để upload ảnh; bỏ trống sẽ dùng local `/public/uploads`.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` *(tùy chọn)*: Credential Google OAuth 2.0 (Authorized redirect URI: `http://localhost:3000/api/client/auth/oauth/google/callback`).
- `GEMINI_API_KEY` *(tùy chọn)*: API key từ Google AI Studio cho các tính năng AI.

### 3. Khởi tạo Database & Seed dữ liệu mẫu
```bash
npm run db:push
npm run db:seed
```

### 4. Chạy Development Server
```bash
npm run dev
```
Mở http://localhost:3000 (Client) hoặc http://localhost:3000/admin (Admin).

---

## Scripts chính

| Lệnh | Mô tả |
| --- | --- |
| `npm run dev` | Chạy Next.js dev server |
| `npm run build` | Generate Prisma Client và build production |
| `npm run start` | Chạy Next.js production server |
| `npm run db:push` | Đồng bộ `prisma/schema.prisma` lên PostgreSQL |
| `npm run db:seed` | Nạp dữ liệu mẫu (`prisma/seed.ts`) |
