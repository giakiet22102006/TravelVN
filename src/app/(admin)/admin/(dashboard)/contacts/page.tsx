"use client";

import { useCallback, useEffect, useState } from "react";
import { ContactStatus } from "@prisma/client";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { formatDateTimeVN } from "@/lib/format";
import {
  CONTACT_STATUS_BADGE_CLASSES,
  CONTACT_STATUS_LABELS,
} from "@/lib/permissions";
import { ConfirmModal } from "@/components/admin/ConfirmModal";

interface ContactRow {
  id: string;
  email: string;
  status: ContactStatus;
  createdAt: string;
}

type ConfirmAction =
  | { kind: "delete-one"; id: string; email: string }
  | { kind: "bulk-delete"; count: number }
  | null;

export default function AdminContactsPage() {
  const [items, setItems] = useState<ContactRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 10;

  const [statusFilter, setStatusFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [confirmState, setConfirmState] = useState<ConfirmAction>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (statusFilter) params.set("status", statusFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/admin/contacts?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setItems(data.items || []);
        setTotal(data.total || 0);
        setSelectedIds([]);
      } else {
        setError(data.message || "Không thể tải danh sách liên hệ");
      }
    } catch {
      setError("Không thể kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, startDate, endDate, debouncedSearch]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  function resetFilters() {
    setStatusFilter("");
    setStartDate("");
    setEndDate("");
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  }

  async function toggleStatus(c: ContactRow) {
    setError("");
    const nextStatus =
      c.status === ContactStatus.PROCESSED
        ? ContactStatus.NEW
        : ContactStatus.PROCESSED;
    try {
      const res = await fetch(`/api/admin/contacts/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Không thể cập nhật trạng thái liên hệ");
        return;
      }
      setNotice(data.message);
      fetchContacts();
    } catch {
      setError("Không thể kết nối máy chủ");
    }
  }

  async function executeBulk(action: string) {
    setError("");
    const res = await fetch("/api/admin/contacts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ids: selectedIds }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Thao tác hàng loạt thất bại");
      return;
    }
    setNotice(data.message);
    setBulkAction("");
    fetchContacts();
  }

  async function handleBulkApply() {
    if (!bulkAction || selectedIds.length === 0) return;
    if (bulkAction === "DELETE") {
      setConfirmState({ kind: "bulk-delete", count: selectedIds.length });
      return;
    }
    try {
      await executeBulk(bulkAction);
    } catch {
      setError("Không thể kết nối máy chủ");
    }
  }

  async function handleConfirm() {
    if (!confirmState) return;
    setConfirmLoading(true);
    setError("");
    try {
      if (confirmState.kind === "delete-one") {
        const res = await fetch(`/api/admin/contacts/${confirmState.id}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.message || "Không thể xóa liên hệ");
          return;
        }
        setNotice(data.message);
        fetchContacts();
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
      <h1 className="text-2xl sm:text-[32px] font-bold text-[#202224]">
        Thông tin liên hệ
      </h1>

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
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 rounded-lg border border-[#D5D5D5] bg-white text-sm font-semibold"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="NEW">Chưa xử lý</option>
          <option value="PROCESSED">Đã liên hệ</option>
        </select>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
            className="h-10 px-3 rounded-lg border border-[#D5D5D5] text-sm"
          />
          <span className="text-sm text-[#667479]">-</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
            className="h-10 px-3 rounded-lg border border-[#D5D5D5] text-sm"
          />
        </div>

        <button
          type="button"
          onClick={resetFilters}
          className="h-10 px-3 rounded-lg text-sm font-bold text-[#EA0234] hover:bg-red-50 inline-flex items-center gap-1.5"
        >
          <RotateCcw className="w-4 h-4" />
          Xóa bộ lọc
        </button>
      </div>

      {/* Action & Search Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center bg-white rounded-[14px] border border-[#E0E0E0] overflow-hidden">
          <select
            value={bulkAction}
            onChange={(e) => setBulkAction(e.target.value)}
            className="h-11 px-4 text-sm font-semibold bg-white focus:outline-none"
          >
            <option value="">-- Hành động --</option>
            <option value="MARK_PROCESSED">Đánh dấu đã liên hệ</option>
            <option value="MARK_NEW">Chuyển chưa xử lý</option>
            <option value="DELETE">Xóa</option>
          </select>
          <button
            type="button"
            onClick={handleBulkApply}
            disabled={!bulkAction || selectedIds.length === 0}
            className="h-11 px-4 border-l border-[#E0E0E0] text-sm font-bold text-[#4880FF] hover:bg-[#4880FF]/10 disabled:opacity-40"
          >
            Áp dụng
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-[#99A2A5] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm email..."
            className="h-11 w-64 sm:w-72 pl-10 pr-4 rounded-[14px] bg-white border border-[#E0E0E0] text-sm focus:outline-none focus:border-[#4880FF]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[14px] border border-[#E0E0E0] overflow-x-auto">
        <table className="w-full min-w-[680px] text-left border-collapse">
          <thead>
            <tr className="bg-[#FCFDFD] border-b border-[#E0E0E0] text-xs font-extrabold uppercase text-[#202224]">
              <th className="py-4 px-4 w-12">
                <input
                  type="checkbox"
                  checked={
                    items.length > 0 && selectedIds.length === items.length
                  }
                  onChange={(e) =>
                    setSelectedIds(
                      e.target.checked ? items.map((it) => it.id) : []
                    )
                  }
                  className="w-4 h-4 rounded accent-[#4880FF]"
                />
              </th>
              <th className="py-4 px-4">Email</th>
              <th className="py-4 px-4 text-center">Trạng thái</th>
              <th className="py-4 px-4">Ngày tạo</th>
              <th className="py-4 px-4 text-center">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E0E0E0] text-sm">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-[#667479]">
                  Đang tải dữ liệu...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-[#667479]">
                  Không có email liên hệ nào.
                </td>
              </tr>
            ) : (
              items.map((c) => (
                <tr key={c.id} className="hover:bg-[#F5F6FA]/60">
                  <td className="py-3.5 px-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(c.id)}
                      onChange={() =>
                        setSelectedIds((prev) =>
                          prev.includes(c.id)
                            ? prev.filter((item) => item !== c.id)
                            : [...prev, c.id]
                        )
                      }
                      className="w-4 h-4 rounded accent-[#4880FF]"
                    />
                  </td>
                  <td className="py-3.5 px-4 font-bold text-[#202224]">
                    {c.email}
                  </td>
                  <td className="py-3.5 px-4 text-center whitespace-nowrap">
                    <span
                      className={`inline-block whitespace-nowrap px-3 py-1 rounded-md text-xs font-bold ${
                        CONTACT_STATUS_BADGE_CLASSES[c.status]
                      }`}
                    >
                      {CONTACT_STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-xs font-semibold text-[#606060] whitespace-nowrap">
                    {formatDateTimeVN(c.createdAt)}
                  </td>
                  <td className="py-3.5 px-4 text-center whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleStatus(c)}
                        className={`h-9 px-3 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                          c.status === ContactStatus.PROCESSED
                            ? "border-[#D5D5D5] bg-[#FAFBFD] text-[#606060] hover:bg-amber-50 hover:text-amber-700"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                        title={
                          c.status === ContactStatus.PROCESSED
                            ? "Chuyển lại chưa xử lý"
                            : "Đánh dấu đã liên hệ"
                        }
                      >
                        {c.status === ContactStatus.PROCESSED ? (
                          <>
                            <Clock className="w-3.5 h-3.5" />
                            <span>Chưa xử lý</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Đã liên hệ</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setConfirmState({
                            kind: "delete-one",
                            id: c.id,
                            email: c.email,
                          })
                        }
                        className="p-2 rounded-lg border border-[#D5D5D5] bg-[#FAFBFD] hover:bg-red-50 text-[#EF3826]"
                        title="Xóa"
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
        title="Xác nhận xóa liên hệ"
        description={
          confirmState?.kind === "delete-one"
            ? `Bạn có chắc muốn xóa email liên hệ "${confirmState.email}"?`
            : confirmState?.kind === "bulk-delete"
              ? `Bạn có chắc muốn xóa ${confirmState.count} email liên hệ đã chọn?`
              : ""
        }
        confirmLabel="Xóa liên hệ"
        loading={confirmLoading}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
