"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ImageUploadBox } from "./ImageUploadBox";

export interface NewsFormData {
  id?: string;
  slug?: string;
  title: string;
  category: string;
  excerpt: string;
  content: string;
  avatar: string;
  featured: boolean;
  relatedDestination: string;
  position: number;
  status: "ACTIVE" | "INACTIVE";
  publishedAt: string;
}

const NEWS_CATEGORIES = [
  "Điểm đến hot",
  "Cẩm nang du lịch",
  "Ẩm thực",
  "Kinh nghiệm săn tour",
];

export function NewsForm({
  mode,
  initialData,
}: {
  mode: "create" | "edit";
  initialData?: NewsFormData;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialData?.title || "");
  const [category, setCategory] = useState(
    initialData?.category || "Cẩm nang du lịch"
  );
  const [excerpt, setExcerpt] = useState(initialData?.excerpt || "");
  const [content, setContent] = useState(initialData?.content || "");
  const [avatar, setAvatar] = useState(initialData?.avatar || "");
  const [featured, setFeatured] = useState(Boolean(initialData?.featured));
  const [relatedDestination, setRelatedDestination] = useState(
    initialData?.relatedDestination || ""
  );
  const [position, setPosition] = useState<number>(initialData?.position || 1);
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">(
    initialData?.status || "ACTIVE"
  );
  const [publishedAt, setPublishedAt] = useState(
    initialData?.publishedAt || new Date().toISOString().slice(0, 10)
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!title.trim() || !excerpt.trim() || !content.trim()) {
      setError("Vui lòng nhập đầy đủ tiêu đề, mô tả ngắn và nội dung bài viết.");
      return;
    }

    setSubmitting(true);
    try {
      const endpoint =
        mode === "create"
          ? "/api/admin/news"
          : `/api/admin/news/${initialData?.id}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category,
          excerpt: excerpt.trim(),
          content: content.trim(),
          avatar: avatar.trim() || null,
          featured,
          relatedDestination: relatedDestination.trim() || null,
          position,
          status,
          publishedAt: publishedAt ? `${publishedAt}T08:00:00.000Z` : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Không thể lưu bài viết");
        return;
      }

      router.push("/admin/news");
      router.refresh();
    } catch {
      setError("Lỗi kết nối máy chủ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#202224]">
            {mode === "create" ? "Tạo bài viết mới" : "Chỉnh sửa bài viết"}
          </h1>
          <p className="text-sm text-[#606060] mt-0.5">
            {mode === "create"
              ? "Đăng tải cẩm nang hoặc tin tức du lịch mới lên hệ thống"
              : `Đang chỉnh sửa bài viết (${initialData?.slug || ""})`}
          </p>
        </div>

        <Link
          href="/admin/news"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-white border border-[#D5D5D5] text-sm font-semibold text-[#202224] hover:bg-[#F5F6FA]"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại danh sách
        </Link>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-[14px] border border-[#E0E0E0] p-6 space-y-5 shadow-xs"
      >
        {error && (
          <div className="p-3.5 rounded-[10px] bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-[#606060] mb-1.5">
              Tiêu đề bài viết <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Top 5 điểm check in độc đáo tại Singapore"
              className="w-full h-[44px] px-3.5 rounded-[10px] border border-[#D5D5D5] text-sm focus:outline-none focus:border-[#4880FF]"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#606060] mb-1.5">
              Chuyên mục
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-[44px] px-3.5 rounded-[10px] border border-[#D5D5D5] text-sm bg-white focus:outline-none focus:border-[#4880FF]"
            >
              {NEWS_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#606060] mb-1.5">
              Điểm đến gợi ý Tour liên quan
            </label>
            <input
              type="text"
              value={relatedDestination}
              onChange={(e) => setRelatedDestination(e.target.value)}
              placeholder="Ví dụ: Singapore, Đà Lạt, Phú Quốc, Nhật Bản..."
              className="w-full h-[44px] px-3.5 rounded-[10px] border border-[#D5D5D5] text-sm focus:outline-none focus:border-[#4880FF]"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#606060] mb-1.5">
              Ngày xuất bản
            </label>
            <input
              type="date"
              value={publishedAt}
              onChange={(e) => setPublishedAt(e.target.value)}
              className="w-full h-[44px] px-3.5 rounded-[10px] border border-[#D5D5D5] text-sm focus:outline-none focus:border-[#4880FF]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[#606060] mb-1.5">
                Vị trí hiển thị
              </label>
              <input
                type="number"
                min={1}
                value={position}
                onChange={(e) =>
                  setPosition(Math.max(1, Number(e.target.value) || 1))
                }
                className="w-full h-[44px] px-3.5 rounded-[10px] border border-[#D5D5D5] text-sm focus:outline-none focus:border-[#4880FF]"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#606060] mb-1.5">
                Trạng thái
              </label>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value === "INACTIVE" ? "INACTIVE" : "ACTIVE")
                }
                className="w-full h-[44px] px-3.5 rounded-[10px] border border-[#D5D5D5] text-sm bg-white focus:outline-none focus:border-[#4880FF] whitespace-nowrap"
              >
                <option value="ACTIVE">Hiển thị (ACTIVE)</option>
                <option value="INACTIVE">Tạm ẩn (INACTIVE)</option>
              </select>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="w-4 h-4 accent-[#4880FF] rounded"
              />
              <span className="text-sm font-semibold text-[#202224]">
                Ghim làm bài viết Nổi Bật (hiển thị ô lớn đầu Trang chủ &amp; trang Tin tức)
              </span>
            </label>
          </div>
        </div>

        <ImageUploadBox
          label="Ảnh bìa bài viết"
          value={avatar}
          onChange={setAvatar}
        />

        <div>
          <label className="block text-sm font-semibold text-[#606060] mb-1.5">
            Mô tả ngắn (Excerpt) <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="Đoạn mở đầu tóm tắt nội dung bài viết (hiển thị trên card)..."
            className="w-full p-3.5 rounded-[10px] border border-[#D5D5D5] text-sm focus:outline-none focus:border-[#4880FF]"
          />
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <label className="text-sm font-semibold text-[#606060]">
              Nội dung bài viết <span className="text-red-500">*</span>
            </label>
            <span className="text-xs text-[#808080]">
              Mẹo: Dùng <code>## Tiêu đề mục</code> cho đề mục lớn và{" "}
              <code>- Nội dung</code> cho gạch đầu dòng
            </span>
          </div>
          <textarea
            rows={12}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Nhập nội dung bài viết chi tiết..."
            className="w-full p-3.5 rounded-[10px] border border-[#D5D5D5] text-sm leading-relaxed focus:outline-none focus:border-[#4880FF]"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 h-[44px] rounded-[10px] bg-[#4880FF] hover:bg-[#3a6ee8] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>
              {mode === "create" ? "Đăng bài viết" : "Lưu thay đổi"}
            </span>
          </button>

          <Link
            href="/admin/news"
            className="px-5 h-[44px] rounded-[10px] border border-[#D5D5D5] text-sm font-semibold text-[#606060] hover:bg-[#F5F6FA] inline-flex items-center"
          >
            Hủy
          </Link>
        </div>
      </form>
    </div>
  );
}
