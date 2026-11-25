"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { formatCurrencyVND, formatDateTimeVN } from "@/lib/format";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { useAdminPermissions } from "@/components/admin/AdminShell";
import { AdminForbiddenCard } from "@/components/admin/AdminForbiddenCard";

interface TrashTourRow {
  id: string;
  code: string;
  name: string;
  avatar: string | null;
  priceNewAdult: number;
  priceNewChild: number;
  priceNewBaby: number;
  stockAdult: number;
  stockChild: number;
  stockBaby: number;
  position: number;
  deletedBy?: { id: string; fullName: string } | null;
  deletedAt: string | null;
}

export default function AdminToursTrashPage() {
  const { hasPermission } = useAdminPermissions();
  const canTrash = hasPermission("tour_trash");

  const [items, setItems] = useState<TrashTourRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 10;

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [confirmState, setConfirmState] = useState<
    { kind: "one"; id: string; name: string } | { kind: "bulk"; count: number } | null
  >(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchTrash = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        deleted: "true",
        page: String(page),
        limit: String(limit),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/admin/tours?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (!res.ok) {
        setError(data.message || "Không thể tải danh sách thùng rác");
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
  }, [page, debouncedSearch]);

  useEffect(() => {
    if (!canTrash) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    fetchTrash();
  }, [canTrash, fetchTrash]);

  if (forbidden) {
    return (
      <AdminForbiddenCard
        title="Bạn không có quyền truy cập Thùng rác tour"
        backHref="/admin/tours"
        backLabel="Quay lại quản lý tour"
      />
    );
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? items.map((it) => it.id) : []);
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function handleRestore(id: string, name: string) {
    if (restoringId) return;
    setError("");
    setRestoringId(id);
    try {
      const res = await fetch(`/api/admin/tours/${id}/restore`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "Lỗi khôi phục tour");
        return;
      }
      setNotice(`Đã khôi phục "${name}"`);
      fetchTrash();
    } catch {
      setError("Không thể kết nối máy chủ");
    } finally {
      setRestoringId(null);
    }
  }

  function handlePermanentDelete(id: string, name: string) {
    setConfirmState({ kind: "one", id, name });
  }

  async function executeBulk(action: string) {
    setError("");
    setBulkLoading(true);
    try {
      const res = await fetch("/api/admin/tours/bulk", {
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
      fetchTrash();
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkApply() {
    if (!bulkAction || selectedIds.length === 0 || bulkLoading) return;
    if (bulkAction === "PERMANENT_DELETE") {
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
        const res = await fetch(`/api/admin/tours/${confirmState.id}/permanent`, {
          method: "DELETE",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.message || "Không thể xóa vĩnh viễn tour");
          return;
        }
        setNotice(data.message);
        fetchTrash();
      } else {
        await executeBulk("PERMANENT_DELETE");
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl sm:text-[32px] font-bold text-[#202224]">
          Thùng rác tour
        </h1>
        <Link
          href="/admin/tours"
          className="h-10 px-4 rounded-xl bg-white border border-[#D5D5D5] hover:border-[#4880FF] text-sm font-bold text-[#4880FF] inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại danh sách
        </Link>
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

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-white rounded-[14px] border border-[#E0E0E0] overflow-hidden">
            <select
              aria-label="Hành động hàng loạt"
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value)}
              className="h-11 px-4 text-sm font-semibold bg-white focus:outline-none"
            >
              <option value="">-- Hành động --</option>
              <option value="RESTORE">Khôi phục</option>
              <option value="PERMANENT_DELETE">Xóa vĩnh viễn</option>
            </select>
            <button
              type="button"
              onClick={handleBulkApply}
              disabled={!bulkAction || selectedIds.length === 0 || bulkLoading}
              className="h-11 px-4 border-l border-[#E0E0E0] text-sm font-bold text-[#B91C1C] hover:bg-red-50 disabled:opacity-40"
            >
              {bulkLoading ? "Đang xử lý..." : "Áp dụng"}
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-[#667479] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm tour trong thùng rác..."
              className="h-11 w-64 sm:w-72 pl-10 pr-4 rounded-[14px] bg-white border border-[#E0E0E0] text-sm focus:outline-none focus:border-[#4880FF]"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[14px] border border-[#E0E0E0] overflow-x-auto">
        <table className="w-full min-w-[920px] text-left border-collapse">
          <thead>
            <tr className="bg-[#FCFDFD] border-b border-[#E0E0E0] text-xs font-extrabold uppercase text-[#202224]">
              <th className="py-4 px-4 w-12">
                <input
                  type="checkbox"
                  aria-label="Chọn tất cả tour trong thùng rác"
                  checked={
                    items.length > 0 && selectedIds.length === items.length
                  }
                  onChange={(e) => toggleAll(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#4880FF]"
                />
              </th>
              <th className="py-4 px-4">Tên tour</th>
              <th className="py-4 px-4 text-center">Ảnh đại diện</th>
              <th className="py-4 px-4">Giá</th>
              <th className="py-4 px-4">Còn lại</th>
              <th className="py-4 px-4 text-center">Vị trí</th>
              <th className="py-4 px-4">Xóa bởi</th>
              <th className="py-4 px-4 text-center">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E0E0E0] text-sm">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-[#667479]">
                  Đang tải dữ liệu...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-[#667479]">
                  Thùng rác đang trống.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-[#F5F6FA]/60">
                  <td className="py-3.5 px-4">
                    <input
                      type="checkbox"
                      aria-label={`Chọn tour ${item.name}`}
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleOne(item.id)}
                      className="w-4 h-4 rounded accent-[#4880FF]"
                    />
                  </td>
                  <td className="py-3.5 px-4 max-w-[230px]">
                    <div className="font-bold text-[#202224] line-clamp-2">
                      {item.name}
                    </div>
                    <div className="text-xs text-[#667479] mt-0.5">
                      Mã: {item.code}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="w-14 h-14 mx-auto rounded-lg overflow-hidden bg-[#F5F6FA] border border-[#E0E0E0] flex items-center justify-center">
                      {item.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.avatar}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[11px] text-[#667479]">
                          No img
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-xs space-y-0.5 whitespace-nowrap">
                    <div>NL: {formatCurrencyVND(item.priceNewAdult)}</div>
                    <div>TE: {formatCurrencyVND(item.priceNewChild)}</div>
                    <div>EB: {formatCurrencyVND(item.priceNewBaby)}</div>
                  </td>
                  <td className="py-3.5 px-4 text-xs space-y-0.5 whitespace-nowrap">
                    <div>NL: {item.stockAdult}</div>
                    <div>TE: {item.stockChild}</div>
                    <div>EB: {item.stockBaby}</div>
                  </td>
                  <td className="py-3.5 px-4 text-center font-semibold">
                    {item.position}
                  </td>
                  <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                    <div className="font-bold text-[#202224]">
                      {item.deletedBy?.fullName || "Hệ thống"}
                    </div>
                    <div className="text-[#667479]">
                      {formatDateTimeVN(item.deletedAt)}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <div className="inline-flex items-center rounded-lg border border-[#D5D5D5] bg-[#FAFBFD] overflow-hidden">
                      <button
                        type="button"
                        disabled={restoringId === item.id}
                        onClick={() => handleRestore(item.id, item.name)}
                        className="p-2 hover:bg-emerald-50 text-[#0F766E] disabled:opacity-50"
                        title="Khôi phục"
                        aria-label={`Khôi phục ${item.name}`}
                      >
                        {restoringId === item.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RotateCcw className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handlePermanentDelete(item.id, item.name)
                        }
                        className="p-2 border-l border-[#D5D5D5] hover:bg-red-50 text-[#B91C1C]"
                        title="Xóa vĩnh viễn"
                        aria-label={`Xóa vĩnh viễn ${item.name}`}
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

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#606060] font-semibold">
        <div>
          Hiển thị {startRecord} - {endRecord} của {total}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="h-9 px-3 rounded-lg bg-white border border-[#D5D5D5] hover:border-[#4880FF] disabled:opacity-40 inline-flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Trước
          </button>
          <span className="px-2">
            Trang {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="h-9 px-3 rounded-lg bg-white border border-[#D5D5D5] hover:border-[#4880FF] disabled:opacity-40 inline-flex items-center gap-1"
          >
            Sau
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(confirmState)}
        title="Xác nhận xóa vĩnh viễn"
        description={
          confirmState?.kind === "one"
            ? `CẢNH BÁO: Xóa vĩnh viễn "${confirmState.name}" khỏi database? Hành động này không thể hoàn tác.`
            : confirmState?.kind === "bulk"
              ? `CẢNH BÁO: Xóa vĩnh viễn ${confirmState.count} tour đã chọn? Hành động này không thể hoàn tác.`
              : ""
        }
        confirmLabel="Xóa vĩnh viễn"
        loading={confirmLoading}
        onConfirm={executeConfirm}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
