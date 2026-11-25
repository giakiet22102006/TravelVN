"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Filter,
  Loader2,
  MessageSquareReply,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { formatDateTimeVN } from "@/lib/format";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { useAdminPermissions } from "@/components/admin/AdminShell";
import { AdminForbiddenCard } from "@/components/admin/AdminForbiddenCard";

interface AdminReviewRow {
  id: string;
  tourId: string;
  rating: number;
  comment: string;
  isVerifiedBooking: boolean;
  aiSentiment: string;
  adminReply: string | null;
  repliedAt: string | null;
  status: "ACTIVE" | "INACTIVE" | "INITIAL";
  createdAt: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    avatar: string | null;
  };
  tour: {
    id: string;
    code: string;
    name: string;
    slug: string;
  };
  repliedBy?: {
    id: string;
    fullName: string;
  } | null;
}

export default function AdminReviewsPage() {
  const { hasPermission } = useAdminPermissions();
  const canView = hasPermission("review_view");
  const canEdit = hasPermission("review_edit");
  const canDelete = hasPermission("review_delete");
  const canBulk = canEdit || canDelete;

  const [items, setItems] = useState<AdminReviewRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 12;

  const [ratingFilter, setRatingFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [confirmState, setConfirmState] = useState<
    { kind: "one"; item: AdminReviewRow } | { kind: "bulk"; count: number } | null
  >(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const [replyingItem, setReplyingItem] = useState<AdminReviewRow | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [savingReply, setSavingReply] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reply Modal A11y: body scroll lock & Escape close
  useEffect(() => {
    if (!replyingItem) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !savingReply) {
        setReplyingItem(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [replyingItem, savingReply]);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (ratingFilter) params.set("rating", ratingFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/admin/reviews?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (!res.ok) {
        setError(data.message || "Không thể tải danh sách đánh giá");
        return;
      }
      const nextItems = data.items || [];
      const nextTotal = data.total || 0;
      const nextTotalPages = Math.max(1, Math.ceil(nextTotal / limit));
      if (nextItems.length === 0 && nextTotal > 0 && page > nextTotalPages) {
        setPage(nextTotalPages);
        return;
      }
      setItems(nextItems);
      setTotal(nextTotal);
      setSelectedIds([]);
    } catch {
      setError("Không thể kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  }, [page, ratingFilter, statusFilter, debouncedSearch]);

  useEffect(() => {
    if (!canView) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    fetchReviews();
  }, [canView, fetchReviews]);

  if (forbidden) {
    return (
      <AdminForbiddenCard title="Bạn không có quyền xem Quản lý đánh giá" />
    );
  }

  function resetFilters() {
    setRatingFilter("");
    setStatusFilter("");
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  }

  async function toggleStatus(item: AdminReviewRow) {
    if (togglingId) return;
    setError("");
    setTogglingId(item.id);
    const nextStatus = item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const res = await fetch(`/api/admin/reviews/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "Không thể cập nhật trạng thái đánh giá");
        return;
      }
      setNotice(data.message || "Đã cập nhật trạng thái đánh giá");
      fetchReviews();
    } catch {
      setError("Không thể kết nối máy chủ");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleSaveReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyingItem) return;
    setError("");
    setSavingReply(true);
    try {
      const res = await fetch(`/api/admin/reviews/${replyingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminReply: replyDraft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "Không thể lưu phản hồi");
        return;
      }
      setNotice(data.message || "Đã lưu phản hồi đánh giá");
      setReplyingItem(null);
      setReplyDraft("");
      fetchReviews();
    } catch {
      setError("Không thể kết nối máy chủ");
    } finally {
      setSavingReply(false);
    }
  }

  async function handleRegenerateSummary(tourId: string, tourName: string) {
    if (regeneratingId) return;
    setError("");
    setRegeneratingId(tourId);
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REGENERATE_SUMMARY", tourId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setNotice(`Đã làm mới Tóm tắt AI cho tour "${tourName}"!`);
      } else {
        setError(data.message || "Không thể làm mới Tóm tắt AI");
      }
    } catch {
      setError("Không thể kết nối máy chủ");
    } finally {
      setRegeneratingId(null);
    }
  }

  function handleDelete(item: AdminReviewRow) {
    setConfirmState({ kind: "one", item });
  }

  async function executeBulk(action: string) {
    setError("");
    setBulkLoading(true);
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids: selectedIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "Không thể thực hiện thao tác hàng loạt");
        return;
      }
      setNotice(data.message);
      setBulkAction("");
      fetchReviews();
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkApply() {
    if (!bulkAction || selectedIds.length === 0 || bulkLoading) return;
    if (bulkAction === "DELETE") {
      setConfirmState({ kind: "bulk", count: selectedIds.length });
      return;
    }
    try {
      await executeBulk(bulkAction);
    } catch {
      setError("Không thể kết nối máy chủ");
    }
  }

  async function executeConfirm() {
    if (!confirmState) return;
    setConfirmLoading(true);
    setError("");
    try {
      if (confirmState.kind === "one") {
        const res = await fetch(`/api/admin/reviews/${confirmState.item.id}`, {
          method: "DELETE",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.message || "Không thể xóa đánh giá");
          return;
        }
        setNotice(data.message);
        fetchReviews();
      } else {
        await executeBulk("DELETE");
      }
    } catch {
      setError("Không thể kết nối máy chủ");
    } finally {
      setConfirmLoading(false);
      setConfirmState(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startRecord = total === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = Math.min(total, page * limit);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-[32px] font-bold text-[#202224]">
          Quản lý đánh giá &amp; bình luận
        </h1>
        <p className="text-sm text-[#667479] mt-1">
          Theo dõi đánh giá thực tế, phản hồi khách hàng và đồng bộ AI Tóm tắt
          tour.
        </p>
      </div>

      {notice && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm font-semibold flex items-center justify-between">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice("")}
            className="text-xs underline"
          >
            Đóng
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm font-semibold flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            className="text-xs underline"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white rounded-[14px] border border-[#E0E0E0] p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-[#202224] pr-2">
          <Filter className="w-4 h-4" />
          <span>Bộ lọc</span>
        </div>

        <select
          aria-label="Lọc theo số sao"
          value={ratingFilter}
          onChange={(e) => {
            setRatingFilter(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 rounded-lg border border-[#D5D5D5] text-sm bg-white"
        >
          <option value="">Tất cả số sao</option>
          <option value="5">5 Sao</option>
          <option value="4">4 Sao</option>
          <option value="3">3 Sao</option>
          <option value="2">2 Sao</option>
          <option value="1">1 Sao</option>
        </select>

        <select
          aria-label="Lọc theo trạng thái"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 rounded-lg border border-[#D5D5D5] text-sm bg-white"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang hiển thị</option>
          <option value="INACTIVE">Đã ẩn</option>
        </select>

        <button
          type="button"
          onClick={resetFilters}
          className="h-10 px-3 rounded-lg border border-[#D5D5D5] text-sm font-semibold text-[#B91C1C] hover:bg-red-50 inline-flex items-center gap-1.5"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Xóa bộ lọc</span>
        </button>

        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-[#667479] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên khách, nội dung, mã/tên tour..."
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#D5D5D5] text-sm"
          />
        </div>
      </div>

      {/* Bulk Bar */}
      <div className="bg-white rounded-[14px] border border-[#E0E0E0] p-4 flex flex-wrap items-center justify-between gap-3">
        {canBulk ? (
          <div className="flex items-center gap-2">
            <select
              aria-label="Hành động hàng loạt"
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value)}
              className="h-10 px-3 rounded-lg border border-[#D5D5D5] text-sm bg-white"
            >
              <option value="">-- Hành động --</option>
              {canEdit && <option value="ACTIVE">Hiển thị bình luận</option>}
              {canEdit && <option value="INACTIVE">Ẩn bình luận</option>}
              {canDelete && <option value="DELETE">Xóa vĩnh viễn</option>}
            </select>
            <button
              type="button"
              onClick={handleBulkApply}
              disabled={!bulkAction || selectedIds.length === 0 || bulkLoading}
              className="h-10 px-4 rounded-lg bg-[#4880FF] hover:bg-[#3a6ee8] disabled:opacity-50 text-white text-sm font-semibold"
            >
              {bulkLoading ? "Đang xử lý..." : `Áp dụng (${selectedIds.length})`}
            </button>
          </div>
        ) : (
          <div />
        )}

        <span className="text-sm text-[#667479]">
          Hiển thị {startRecord} - {endRecord} / {total} đánh giá
        </span>
      </div>

      {/* Reviews Table */}
      <div className="bg-white rounded-[14px] border border-[#E0E0E0] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[920px]">
            <thead>
              <tr className="bg-[#FCFDFD] border-b border-[#E0E0E0] text-xs font-bold text-[#202224] uppercase">
                {canBulk && (
                  <th className="py-3.5 px-4 w-10">
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả đánh giá"
                      checked={
                        items.length > 0 &&
                        selectedIds.length === items.length
                      }
                      onChange={(e) =>
                        setSelectedIds(
                          e.target.checked ? items.map((i) => i.id) : []
                        )
                      }
                    />
                  </th>
                )}
                <th className="py-3.5 px-4">Khách hàng</th>
                <th className="py-3.5 px-4">Tour</th>
                <th className="py-3.5 px-4">Đánh giá &amp; Nội dung</th>
                <th className="py-3.5 px-4">Trạng thái</th>
                {(canEdit || canDelete) && (
                  <th className="py-3.5 px-4">Thao tác</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAEAEA] text-sm">
              {loading ? (
                <tr>
                  <td
                    colSpan={canBulk ? 6 : 5}
                    className="py-10 text-center text-[#667479]"
                  >
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={canBulk ? 6 : 5}
                    className="py-10 text-center text-[#667479]"
                  >
                    Chưa có đánh giá nào khớp bộ lọc.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F9FAFB] align-top">
                    {canBulk && (
                      <td className="py-3.5 px-4">
                        <input
                          type="checkbox"
                          aria-label={`Chọn đánh giá của ${item.user.fullName}`}
                          checked={selectedIds.includes(item.id)}
                          onChange={(e) =>
                            setSelectedIds((prev) =>
                              e.target.checked
                                ? [...prev, item.id]
                                : prev.filter((id) => id !== item.id)
                            )
                          }
                        />
                      </td>
                    )}

                    <td className="py-3.5 px-4 max-w-[200px]">
                      <div className="font-bold text-[#202224]">
                        {item.user.fullName}
                      </div>
                      <div className="text-xs text-[#667479] truncate">
                        {item.user.email}
                      </div>
                      {item.isVerifiedBooking && (
                        <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#CCFBF1] text-[#0F766E] text-[11px] font-semibold">
                          <CheckCircle2 className="w-3 h-3" />
                          Đã đặt tour
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 max-w-[210px]">
                      <Link
                        href={`/tours/${item.tour.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-[#4880FF] hover:underline line-clamp-2"
                      >
                        {item.tour.name}
                      </Link>
                      <div className="text-xs text-[#667479] mt-0.5">
                        {item.tour.code}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 max-w-[360px]">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex items-center text-[#FFB800]">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${
                                i < item.rating
                                  ? "fill-[#FFB800]"
                                  : "text-[#D4D8DD]"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-[11px] text-[#667479]">
                          {formatDateTimeVN(item.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-[#202224] whitespace-pre-line">
                        {item.comment}
                      </p>
                      {item.adminReply && (
                        <div className="mt-2 p-2.5 rounded-lg bg-[#F4F7FF] border border-[#DCE5FF] text-xs text-[#202224]">
                          <strong className="text-[#4880FF]">
                            Phản hồi VN.TRAVEL:
                          </strong>{" "}
                          {item.adminReply}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${
                          item.status === "ACTIVE"
                            ? "bg-[#CCFBF1] text-[#0F766E]"
                            : "bg-[#FEE2E2] text-[#B91C1C]"
                        }`}
                      >
                        {item.status === "ACTIVE" ? "Hiển thị" : "Đang ẩn"}
                      </span>
                    </td>

                    {(canEdit || canDelete) && (
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          {canEdit && (
                            <>
                              <button
                                type="button"
                                title="Trả lời khách hàng"
                                aria-label={`Trả lời đánh giá của ${item.user.fullName}`}
                                onClick={() => {
                                  setReplyingItem(item);
                                  setReplyDraft(item.adminReply || "");
                                }}
                                className="p-2 rounded-lg border border-[#D5D5D5] text-[#4880FF] hover:bg-blue-50"
                              >
                                <MessageSquareReply className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                disabled={togglingId === item.id}
                                title={
                                  item.status === "ACTIVE"
                                    ? "Ẩn bình luận"
                                    : "Hiển thị bình luận"
                                }
                                aria-label={
                                  item.status === "ACTIVE"
                                    ? `Ẩn bình luận của ${item.user.fullName}`
                                    : `Hiển thị bình luận của ${item.user.fullName}`
                                }
                                onClick={() => toggleStatus(item)}
                                className="p-2 rounded-lg border border-[#D5D5D5] text-[#202224] hover:bg-slate-100 disabled:opacity-50"
                              >
                                {togglingId === item.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : item.status === "ACTIVE" ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </button>

                              <button
                                type="button"
                                disabled={regeneratingId === item.tourId}
                                title="Làm mới Tóm tắt AI của tour này"
                                aria-label={`Làm mới Tóm tắt AI của tour ${item.tour.name}`}
                                onClick={() =>
                                  handleRegenerateSummary(
                                    item.tourId,
                                    item.tour.name
                                  )
                                }
                                className="p-2 rounded-lg border border-[#D5D5D5] text-[#4502C7] hover:bg-purple-50 disabled:opacity-50"
                              >
                                {regeneratingId === item.tourId ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Sparkles className="w-4 h-4" />
                                )}
                              </button>
                            </>
                          )}

                          {canDelete && (
                            <button
                              type="button"
                              title="Xóa đánh giá"
                              aria-label={`Xóa đánh giá của ${item.user.fullName}`}
                              onClick={() => handleDelete(item)}
                              className="p-2 rounded-lg border border-[#D5D5D5] text-[#B91C1C] hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-[#E0E0E0] flex items-center justify-between text-sm">
            <span className="text-[#667479]">
              Trang {page} / {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Trang trước"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-2 rounded-lg border border-[#D5D5D5] disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Trang sau"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-2 rounded-lg border border-[#D5D5D5] disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reply Modal */}
      {replyingItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reply-modal-title"
          onClick={() => {
            if (!savingReply) setReplyingItem(null);
          }}
          className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleSaveReply}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h2
                id="reply-modal-title"
                className="text-lg font-bold text-[#202224]"
              >
                Phản hồi đánh giá của {replyingItem.user.fullName}
              </h2>
              <button
                type="button"
                disabled={savingReply}
                aria-label="Đóng"
                onClick={() => setReplyingItem(null)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[#667479] hover:bg-[#F5F6FA] hover:text-[#202224] disabled:opacity-40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 rounded-xl bg-[#F5F6FA] text-sm text-[#565656]">
              &ldquo;{replyingItem.comment}&rdquo;
            </div>
            <textarea
              rows={4}
              value={replyDraft}
              onChange={(e) => setReplyDraft(e.target.value)}
              placeholder="Nhập phản hồi chính thức từ VN.TRAVEL (để trống nếu muốn xóa phản hồi)..."
              className="w-full rounded-xl border border-[#D5D5D5] p-3 text-sm focus:outline-none focus:border-[#4880FF]"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={savingReply}
                onClick={() => setReplyingItem(null)}
                className="h-10 px-4 rounded-lg border border-[#D5D5D5] text-sm font-semibold disabled:opacity-40"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={savingReply}
                className="h-10 px-5 rounded-lg bg-[#4880FF] hover:bg-[#3a6ee8] disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center gap-2"
              >
                {savingReply && <Loader2 className="w-4 h-4 animate-spin" />}
                {savingReply ? "Đang lưu..." : "Lưu phản hồi"}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal
        open={Boolean(confirmState)}
        title="Xác nhận xóa đánh giá"
        description={
          confirmState?.kind === "one"
            ? `Bạn có chắc muốn xóa đánh giá của khách "${confirmState.item.user.fullName}"?`
            : confirmState?.kind === "bulk"
              ? `Bạn có chắc muốn xóa ${confirmState.count} đánh giá đã chọn?`
              : ""
        }
        confirmLabel="Xóa đánh giá"
        loading={confirmLoading}
        onConfirm={executeConfirm}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
