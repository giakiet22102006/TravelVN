"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { formatDateVN } from "@/lib/format";

interface AdminNewsRow {
  id: string;
  title: string;
  slug: string;
  category: string;
  avatar: string | null;
  featured: boolean;
  views: number;
  relatedDestination: string | null;
  position: number;
  status: "ACTIVE" | "INACTIVE";
  publishedAt: string;
  updatedAt: string;
}

const CATEGORIES = [
  "Điểm đến hot",
  "Cẩm nang du lịch",
  "Ẩm thực",
  "Kinh nghiệm săn tour",
];

export default function AdminNewsPage() {
  const [items, setItems] = useState<AdminNewsRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 10;

  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (categoryFilter) params.set("category", categoryFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/admin/news?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setItems(data.items || []);
        setTotal(data.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, categoryFilter, statusFilter, debouncedSearch]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  async function quickPatch(
    item: AdminNewsRow,
    payload: { status?: "ACTIVE" | "INACTIVE"; featured?: boolean },
    msg: string
  ) {
    const res = await fetch(`/api/admin/news/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setNotice(msg);
      fetchNews();
    }
  }

  async function handleDelete(item: AdminNewsRow) {
    if (!window.confirm(`Xóa bài viết "${item.title}"?`)) return;
    const res = await fetch(`/api/admin/news/${item.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setNotice(`Đã xóa bài viết "${item.title}"`);
      fetchNews();
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#202224]">
            Quản lý tin tức &amp; cẩm nang
          </h1>
          <p className="text-sm text-[#606060] mt-0.5">
            Quản lý bài viết hiển thị trên Trang chủ &amp; chuyên trang Tin Tức ({total} bài)
          </p>
        </div>

        <Link
          href="/admin/news/create"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-[#4880FF] hover:bg-[#3a6ee8] text-white text-sm font-semibold shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          Viết bài mới
        </Link>
      </div>

      {notice && (
        <div className="rounded-[10px] bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm text-emerald-700 flex items-center justify-between">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice("")}
            className="text-xs font-bold underline"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white rounded-[14px] border border-[#E0E0E0] p-4 flex flex-wrap items-center gap-3 shadow-xs">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-[#99A2A5] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tiêu đề, điểm đến..."
            className="w-full h-[40px] pl-9 pr-3 rounded-[8px] border border-[#D5D5D5] text-sm focus:outline-none focus:border-[#4880FF]"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          className="h-[40px] px-3 rounded-[8px] border border-[#D5D5D5] text-sm bg-white focus:outline-none focus:border-[#4880FF]"
        >
          <option value="">Tất cả chuyên mục</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="h-[40px] px-3 rounded-[8px] border border-[#D5D5D5] text-sm bg-white focus:outline-none focus:border-[#4880FF]"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang hiển thị</option>
          <option value="INACTIVE">Đang ẩn</option>
        </select>

        <button
          type="button"
          onClick={() => {
            setCategoryFilter("");
            setStatusFilter("");
            setSearch("");
            setDebouncedSearch("");
            setPage(1);
          }}
          className="h-[40px] px-3.5 rounded-[8px] border border-[#D5D5D5] text-sm font-medium text-[#606060] hover:bg-[#F5F6FA] inline-flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Đặt lại
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[14px] border border-[#E0E0E0] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FCFDFD] border-b border-[#E0E0E0] text-xs font-bold uppercase text-[#606060]">
                <th className="py-3.5 px-4">Bài viết</th>
                <th className="py-3.5 px-4">Chuyên mục</th>
                <th className="py-3.5 px-4 text-center">Nổi bật</th>
                <th className="py-3.5 px-4 text-center">Lượt xem</th>
                <th className="py-3.5 px-4">Ngày đăng</th>
                <th className="py-3.5 px-4">Trạng thái</th>
                <th className="py-3.5 px-4 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F0] text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#808080]">
                    Đang tải danh sách bài viết...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#808080]">
                    Chưa có bài viết nào phù hợp.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-[#FAFAFA]">
                    <td className="py-3.5 px-4 max-w-[340px]">
                      <div className="flex items-center gap-3">
                        {item.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.avatar}
                            alt={item.title}
                            className="w-16 h-11 rounded-lg object-cover shrink-0 border border-[#E0E0E0]"
                          />
                        ) : (
                          <div className="w-16 h-11 rounded-lg bg-[#F5F6FA] border border-[#E0E0E0] shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-[#202224] line-clamp-2 leading-snug">
                            {item.title}
                          </p>
                          {item.relatedDestination && (
                            <span className="text-xs text-[#4880FF]">
                              Tour gợi ý: {item.relatedDestination}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap text-[#606060]">
                      <span className="px-2.5 py-1 rounded-full bg-[#F5F6FA] text-xs font-semibold">
                        {item.category}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          quickPatch(
                            item,
                            { featured: !item.featured },
                            item.featured
                              ? "Đã bỏ ghim bài viết nổi bật"
                              : "Đã ghim làm bài viết nổi bật!"
                          )
                        }
                        title="Bật/tắt bài nổi bật"
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${
                          item.featured
                            ? "bg-amber-100 text-amber-800"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        <Sparkles className="w-3 h-3" />
                        {item.featured ? "Nổi bật" : "Thường"}
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-center font-medium text-[#202224]">
                      {item.views.toLocaleString("vi-VN")}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap text-[#606060]">
                      {formatDateVN(item.publishedAt)}
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() =>
                          quickPatch(
                            item,
                            {
                              status:
                                item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                            },
                            item.status === "ACTIVE"
                              ? "Đã tạm ẩn bài viết"
                              : "Đã bật hiển thị bài viết"
                          )
                        }
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                          item.status === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {item.status === "ACTIVE" ? (
                          <Eye className="w-3 h-3" />
                        ) : (
                          <EyeOff className="w-3 h-3" />
                        )}
                        {item.status === "ACTIVE" ? "Hiển thị" : "Tạm ẩn"}
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <Link
                          href={`/news/${item.slug}`}
                          target="_blank"
                          title="Xem trang công khai"
                          className="p-2 rounded-lg border border-[#E0E0E0] text-[#606060] hover:text-[#4880FF] hover:border-[#4880FF]"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                        <Link
                          href={`/admin/news/edit/${item.id}`}
                          title="Chỉnh sửa"
                          className="p-2 rounded-lg border border-[#E0E0E0] text-[#606060] hover:text-[#4880FF] hover:border-[#4880FF]"
                        >
                          <Pencil className="w-4 h-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          title="Xóa bài viết"
                          className="p-2 rounded-lg border border-[#E0E0E0] text-[#606060] hover:text-red-600 hover:border-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-[#E0E0E0] flex items-center justify-between text-sm">
            <span className="text-[#606060]">
              Trang {page} / {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="p-2 rounded-lg border border-[#D5D5D5] disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-2 rounded-lg border border-[#D5D5D5] disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
