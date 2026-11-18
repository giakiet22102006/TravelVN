"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { ConfirmModal } from "@/components/admin/ConfirmModal";

interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  permissions: unknown;
  _count?: { accounts: number };
}

export default function AdminRolesPage() {
  const [items, setItems] = useState<RoleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 10;

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [loading, setLoading] = useState(true);
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

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/admin/settings/roles?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setItems(data.items || []);
        setTotal(data.total || 0);
        setSelectedIds([]);
      }
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  function handleDelete(id: string, name: string) {
    setConfirmState({ kind: "one", id, name });
  }

  function handleBulkApply() {
    if (bulkAction !== "DELETE" || selectedIds.length === 0) return;
    setConfirmState({ kind: "bulk", count: selectedIds.length });
  }

  async function executeConfirm() {
    if (!confirmState) return;
    setConfirmLoading(true);
    setError("");
    try {
      if (confirmState.kind === "one") {
        const res = await fetch(
          `/api/admin/settings/roles/${confirmState.id}`,
          { method: "DELETE" }
        );
        const data = await res.json();
        if (!res.ok) {
          setError(data.message || "Không thể xóa nhóm quyền");
          return;
        }
        setNotice(data.message);
        fetchRoles();
      } else {
        const res = await fetch("/api/admin/settings/roles", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "DELETE", ids: selectedIds }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.message || "Không thể xóa các nhóm quyền đã chọn");
          return;
        }
        setNotice(data.message);
        setBulkAction("");
        fetchRoles();
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
          Nhóm quyền
        </h1>
        <Link
          href="/admin/settings"
          className="text-sm font-bold text-[#4880FF] hover:underline"
        >
          ← Cài đặt chung
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

      {/* Action & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-white rounded-[14px] border border-[#E0E0E0] overflow-hidden">
            <select
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value)}
              className="h-11 px-4 text-sm font-semibold bg-white focus:outline-none"
            >
              <option value="">-- Hành động --</option>
              <option value="DELETE">Xóa</option>
            </select>
            <button
              type="button"
              onClick={handleBulkApply}
              disabled={!bulkAction || selectedIds.length === 0}
              className="h-11 px-4 border-l border-[#E0E0E0] text-sm font-bold text-[#EA0234] hover:bg-red-50 disabled:opacity-40"
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
              placeholder="Tìm kiếm nhóm quyền..."
              className="h-11 w-64 sm:w-72 pl-10 pr-4 rounded-[14px] bg-white border border-[#E0E0E0] text-sm focus:outline-none focus:border-[#4880FF]"
            />
          </div>
        </div>

        <Link
          href="/admin/settings/roles/create"
          className="h-11 px-5 rounded-[14px] bg-[#4880FF] hover:bg-[#3a6ce0] text-white text-sm font-bold inline-flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Tạo mới
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[14px] border border-[#E0E0E0] overflow-x-auto">
        <table className="w-full min-w-[700px] text-left border-collapse">
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
              <th className="py-4 px-4">Tên nhóm quyền</th>
              <th className="py-4 px-4">Mô tả ngắn</th>
              <th className="py-4 px-4 text-center">Số quyền</th>
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
                  Không có nhóm quyền nào phù hợp.
                </td>
              </tr>
            ) : (
              items.map((r) => {
                const permCount = Array.isArray(r.permissions)
                  ? r.permissions.length
                  : 0;
                return (
                  <tr key={r.id} className="hover:bg-[#F5F6FA]/60">
                    <td className="py-3.5 px-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(r.id)}
                        onChange={() =>
                          setSelectedIds((prev) =>
                            prev.includes(r.id)
                              ? prev.filter((item) => item !== r.id)
                              : [...prev, r.id]
                          )
                        }
                        className="w-4 h-4 rounded accent-[#4880FF]"
                      />
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[#202224]">
                      {r.name}
                    </td>
                    <td className="py-3.5 px-4 text-[#606060]">
                      {r.description || "-"}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-block px-3 py-1 rounded-md bg-[#4880FF]/10 text-[#4880FF] text-xs font-bold">
                        {permCount} quyền
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center rounded-lg border border-[#D5D5D5] bg-[#FAFBFD] overflow-hidden">
                        <Link
                          href={`/admin/settings/roles/edit/${r.id}`}
                          className="p-2 hover:bg-[#4880FF]/10 text-[#202224] hover:text-[#4880FF]"
                          title="Chỉnh sửa"
                        >
                          <Pencil className="w-4 h-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(r.id, r.name)}
                          className="p-2 border-l border-[#D5D5D5] hover:bg-red-50 text-[#EF3826]"
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
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
        title="Xác nhận xóa nhóm quyền"
        description={
          confirmState?.kind === "one"
            ? `Bạn có chắc muốn xóa nhóm quyền "${confirmState.name}"?`
            : confirmState?.kind === "bulk"
              ? `Bạn có chắc muốn xóa ${confirmState.count} nhóm quyền đã chọn?`
              : ""
        }
        confirmLabel="Xóa nhóm quyền"
        loading={confirmLoading}
        onConfirm={executeConfirm}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
