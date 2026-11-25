"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { formatDateTimeVN } from "@/lib/format";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { useAdminPermissions } from "@/components/admin/AdminShell";
import { AdminForbiddenCard } from "@/components/admin/AdminForbiddenCard";

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  avatar: string | null;
  position: number;
  status: "ACTIVE" | "INACTIVE";
  parent?: { id: string; name: string } | null;
  createdBy?: { id: string; fullName: string } | null;
  updatedBy?: { id: string; fullName: string } | null;
  createdAt: string;
  updatedAt: string;
}

interface CreatorOption {
  id: string;
  fullName: string;
}

export default function AdminCategoriesPage() {
  const { hasPermission } = useAdminPermissions();
  const canView = hasPermission("category_view");
  const canCreate = hasPermission("category_create");
  const canEdit = hasPermission("category_edit");
  const canDelete = hasPermission("category_delete");
  const canBulk = canEdit || canDelete;

  const [items, setItems] = useState<CategoryRow[]>([]);
  const [creators, setCreators] = useState<CreatorOption[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 10;

  const [status, setStatus] = useState("");
  const [createdById, setCreatedById] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
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

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (status) params.set("status", status);
      if (createdById) params.set("createdById", createdById);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/admin/categories?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (!res.ok) {
        setError(data.message || "Không thể tải danh sách danh mục");
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
      if (Array.isArray(data.creators)) setCreators(data.creators);
      setSelectedIds([]);
    } catch {
      setError("Không thể kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  }, [page, status, createdById, startDate, endDate, debouncedSearch]);

  useEffect(() => {
    if (!canView) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    fetchCategories();
  }, [canView, fetchCategories]);

  if (forbidden) {
    return (
      <AdminForbiddenCard title="Bạn không có quyền xem Quản lý danh mục" />
    );
  }

  function resetFilters() {
    setStatus("");
    setCreatedById("");
    setStartDate("");
    setEndDate("");
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? items.map((it) => it.id) : []);
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function handleDelete(id: string, name: string) {
    setConfirmState({ kind: "one", id, name });
  }

  async function executeBulk(action: string) {
    setError("");
    setBulkLoading(true);
    try {
      const res = await fetch("/api/admin/categories/bulk", {
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
      fetchCategories();
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
        const res = await fetch(`/api/admin/categories/${confirmState.id}`, {
          method: "DELETE",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.message || "Không thể xóa danh mục");
          return;
        }
        setNotice(data.message || "Xóa danh mục thành công!");
        fetchCategories();
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
        Quản lý danh mục
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
          aria-label="Lọc theo trạng thái"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 rounded-lg border border-[#D5D5D5] bg-white text-sm font-semibold"
        >
          <option value="">Trạng thái</option>
          <option value="ACTIVE">Hoạt động</option>
          <option value="INACTIVE">Tạm dừng</option>
        </select>

        <select
          aria-label="Lọc theo người tạo"
          value={createdById}
          onChange={(e) => {
            setCreatedById(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 rounded-lg border border-[#D5D5D5] bg-white text-sm font-semibold"
        >
          <option value="">Người tạo</option>
          {creators.map((c) => (
            <option key={c.id} value={c.id}>
              {c.fullName}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <input
            aria-label="Từ ngày"
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
            aria-label="Đến ngày"
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
          className="h-10 px-3 rounded-lg text-sm font-bold text-[#B91C1C] hover:bg-red-50 inline-flex items-center gap-1.5"
        >
          <RotateCcw className="w-4 h-4" />
          Xóa bộ lọc
        </button>
      </div>

      {/* Action & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {canBulk && (
            <div className="flex items-center bg-white rounded-[14px] border border-[#E0E0E0] overflow-hidden">
              <select
                aria-label="Hành động hàng loạt"
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
                className="h-11 px-4 text-sm font-semibold bg-white focus:outline-none"
              >
                <option value="">-- Hành động --</option>
                {canEdit && <option value="ACTIVE">Hoạt động</option>}
                {canEdit && <option value="INACTIVE">Tạm dừng</option>}
                {canDelete && <option value="DELETE">Xóa</option>}
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
          )}

          <div className="relative">
            <Search className="w-4 h-4 text-[#667479] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm danh mục..."
              className="h-11 w-64 sm:w-72 pl-10 pr-4 rounded-[14px] bg-white border border-[#E0E0E0] text-sm focus:outline-none focus:border-[#4880FF]"
            />
          </div>
        </div>

        {canCreate && (
          <Link
            href="/admin/categories/create"
            className="h-11 px-5 rounded-[14px] bg-[#4880FF] hover:bg-[#3a6ce0] text-white text-sm font-bold inline-flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Tạo mới
          </Link>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-[14px] border border-[#E0E0E0] overflow-x-auto">
        <table className="w-full min-w-[880px] text-left border-collapse">
          <thead>
            <tr className="bg-[#FCFDFD] border-b border-[#E0E0E0] text-xs font-extrabold uppercase text-[#202224]">
              {canBulk && (
                <th className="py-4 px-4 w-12">
                  <input
                    type="checkbox"
                    aria-label="Chọn tất cả danh mục"
                    checked={
                      items.length > 0 && selectedIds.length === items.length
                    }
                    onChange={(e) => toggleAll(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#4880FF]"
                  />
                </th>
              )}
              <th className="py-4 px-4">Tên danh mục</th>
              <th className="py-4 px-4 text-center">Ảnh đại diện</th>
              <th className="py-4 px-4 text-center">Vị trí</th>
              <th className="py-4 px-4 text-center">Trạng thái</th>
              <th className="py-4 px-4">Tạo bởi</th>
              <th className="py-4 px-4">Cập nhật bởi</th>
              {(canEdit || canDelete) && (
                <th className="py-4 px-4 text-center">Hành động</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E0E0E0] text-sm">
            {loading ? (
              <tr>
                <td
                  colSpan={canBulk ? 8 : 7}
                  className="py-10 text-center text-[#667479]"
                >
                  Đang tải dữ liệu...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={canBulk ? 8 : 7}
                  className="py-10 text-center text-[#667479]"
                >
                  Không có danh mục nào phù hợp.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-[#F5F6FA]/60">
                  {canBulk && (
                    <td className="py-3.5 px-4">
                      <input
                        type="checkbox"
                        aria-label={`Chọn danh mục ${item.name}`}
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleOne(item.id)}
                        className="w-4 h-4 rounded accent-[#4880FF]"
                      />
                    </td>
                  )}
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-[#202224]">{item.name}</div>
                    {item.parent && (
                      <div className="text-xs text-[#667479] mt-0.5">
                        Thuộc: {item.parent.name}
                      </div>
                    )}
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
                  <td className="py-3.5 px-4 text-center font-semibold">
                    {item.position}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {item.status === "ACTIVE" ? (
                      <span className="inline-block px-3 py-1 rounded-md bg-[#CCFBF1] text-[#0F766E] text-xs font-bold">
                        Hoạt động
                      </span>
                    ) : (
                      <span className="inline-block px-3 py-1 rounded-md bg-[#FEE2E2] text-[#B91C1C] text-xs font-bold">
                        Tạm dừng
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-xs">
                    <div className="font-bold text-[#202224]">
                      {item.createdBy?.fullName || "Hệ thống"}
                    </div>
                    <div className="text-[#667479]">
                      {formatDateTimeVN(item.createdAt)}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-xs">
                    <div className="font-bold text-[#202224]">
                      {item.updatedBy?.fullName || "Hệ thống"}
                    </div>
                    <div className="text-[#667479]">
                      {formatDateTimeVN(item.updatedAt)}
                    </div>
                  </td>
                  {(canEdit || canDelete) && (
                    <td className="py-3.5 px-4">
                      <div className="inline-flex items-center rounded-lg border border-[#D5D5D5] bg-[#FAFBFD] overflow-hidden">
                        {canEdit && (
                          <Link
                            href={`/admin/categories/edit/${item.id}`}
                            className="p-2 hover:bg-[#4880FF]/10 text-[#202224] hover:text-[#4880FF]"
                            title="Chỉnh sửa"
                            aria-label={`Chỉnh sửa ${item.name}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Link>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id, item.name)}
                            className={`p-2 hover:bg-red-50 text-[#B91C1C] ${
                              canEdit ? "border-l border-[#D5D5D5]" : ""
                            }`}
                            title="Xóa"
                            aria-label={`Xóa ${item.name}`}
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
        title="Xác nhận xóa danh mục"
        description={
          confirmState?.kind === "one"
            ? `Bạn có chắc muốn xóa danh mục "${confirmState.name}"?`
            : confirmState?.kind === "bulk"
              ? `Bạn có chắc muốn xóa ${confirmState.count} danh mục đã chọn?`
              : ""
        }
        confirmLabel="Xóa danh mục"
        loading={confirmLoading}
        onConfirm={executeConfirm}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
