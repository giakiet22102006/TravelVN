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
import { ConfirmModal } from "@/components/admin/ConfirmModal";

interface RoleOption {
  id: string;
  name: string;
}

interface AdminAccountRow {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  positionCompany: string | null;
  avatar: string | null;
  status: "INITIAL" | "ACTIVE" | "INACTIVE";
  role: { id: string; name: string } | null;
  createdAt: string;
}

export default function AdminAccountsPage() {
  const [items, setItems] = useState<AdminAccountRow[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 10;

  const [status, setStatus] = useState("");
  const [roleId, setRoleId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
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

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (status) params.set("status", status);
      if (roleId) params.set("roleId", roleId);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(
        `/api/admin/settings/accounts?${params.toString()}`
      );
      const data = await res.json();
      if (res.ok) {
        setItems(data.items || []);
        setTotal(data.total || 0);
        if (Array.isArray(data.roles)) setRoles(data.roles);
        setSelectedIds([]);
      }
    } finally {
      setLoading(false);
    }
  }, [page, status, roleId, startDate, endDate, debouncedSearch]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  function resetFilters() {
    setStatus("");
    setRoleId("");
    setStartDate("");
    setEndDate("");
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  }

  function handleDelete(id: string, name: string) {
    setConfirmState({ kind: "one", id, name });
  }

  async function executeBulk(action: string) {
    setError("");
    const res = await fetch("/api/admin/settings/accounts", {
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
    fetchAccounts();
  }

  async function handleBulkApply() {
    if (!bulkAction || selectedIds.length === 0) return;
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
        const res = await fetch(
          `/api/admin/settings/accounts/${confirmState.id}`,
          { method: "DELETE" }
        );
        const data = await res.json();
        if (!res.ok) {
          setError(data.message || "Không thể xóa tài khoản");
          return;
        }
        setNotice(data.message);
        fetchAccounts();
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl sm:text-[32px] font-bold text-[#202224]">
          Tài khoản quản trị
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

      {/* Filter Bar */}
      <div className="bg-white rounded-[14px] border border-[#E0E0E0] p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-[#202224] pr-2">
          <Filter className="w-4 h-4" />
          <span>Bộ lọc</span>
        </div>

        <select
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
          <option value="INITIAL">Khởi tạo</option>
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

        <select
          value={roleId}
          onChange={(e) => {
            setRoleId(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 rounded-lg border border-[#D5D5D5] bg-white text-sm font-semibold"
        >
          <option value="">Nhóm quyền</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-white rounded-[14px] border border-[#E0E0E0] overflow-hidden">
            <select
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value)}
              className="h-11 px-4 text-sm font-semibold bg-white focus:outline-none"
            >
              <option value="">-- Hành động --</option>
              <option value="ACTIVE">Hoạt động</option>
              <option value="INACTIVE">Tạm dừng</option>
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
              placeholder="Tìm kiếm..."
              className="h-11 w-64 sm:w-72 pl-10 pr-4 rounded-[14px] bg-white border border-[#E0E0E0] text-sm focus:outline-none focus:border-[#4880FF]"
            />
          </div>
        </div>

        <Link
          href="/admin/settings/accounts/create"
          className="h-11 px-5 rounded-[14px] bg-[#4880FF] hover:bg-[#3a6ce0] text-white text-sm font-bold inline-flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Tạo mới
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[14px] border border-[#E0E0E0] overflow-x-auto">
        <table className="w-full min-w-[920px] text-left border-collapse">
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
              <th className="py-4 px-4">Họ tên</th>
              <th className="py-4 px-4 text-center">Ảnh đại diện</th>
              <th className="py-4 px-4">Email</th>
              <th className="py-4 px-4">Số điện thoại</th>
              <th className="py-4 px-4">Nhóm quyền</th>
              <th className="py-4 px-4">Chức vụ</th>
              <th className="py-4 px-4 text-center">Trạng thái</th>
              <th className="py-4 px-4 text-center">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E0E0E0] text-sm">
            {loading ? (
              <tr>
                <td colSpan={9} className="py-10 text-center text-[#667479]">
                  Đang tải dữ liệu...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-10 text-center text-[#667479]">
                  Không có tài khoản quản trị nào phù hợp.
                </td>
              </tr>
            ) : (
              items.map((acc) => (
                <tr key={acc.id} className="hover:bg-[#F5F6FA]/60">
                  <td className="py-3.5 px-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(acc.id)}
                      onChange={() =>
                        setSelectedIds((prev) =>
                          prev.includes(acc.id)
                            ? prev.filter((item) => item !== acc.id)
                            : [...prev, acc.id]
                        )
                      }
                      className="w-4 h-4 rounded accent-[#4880FF]"
                    />
                  </td>
                  <td className="py-3.5 px-4 font-bold text-[#202224]">
                    {acc.fullName}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="w-12 h-12 mx-auto rounded-lg overflow-hidden bg-[#F5F6FA] border border-[#E0E0E0] flex items-center justify-center">
                      {acc.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={acc.avatar}
                          alt={acc.fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-bold text-[#4880FF]">
                          {acc.fullName.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-[#202224]">{acc.email}</td>
                  <td className="py-3.5 px-4 text-[#606060]">
                    {acc.phone || "-"}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-[#4880FF]">
                    {acc.role?.name || "Chưa gán"}
                  </td>
                  <td className="py-3.5 px-4 text-[#606060]">
                    {acc.positionCompany || "-"}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {acc.status === "ACTIVE" ? (
                      <span className="inline-block px-3 py-1 rounded-md bg-[#CCF0EB] text-[#00B69B] text-xs font-bold">
                        Hoạt động
                      </span>
                    ) : acc.status === "INITIAL" ? (
                      <span className="inline-block px-3 py-1 rounded-md bg-[#FFEBDA] text-[#FF8900] text-xs font-bold">
                        Khởi tạo
                      </span>
                    ) : (
                      <span className="inline-block px-3 py-1 rounded-md bg-[#FCD7D4] text-[#EF3826] text-xs font-bold">
                        Tạm dừng
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <div className="inline-flex items-center rounded-lg border border-[#D5D5D5] bg-[#FAFBFD] overflow-hidden">
                      <Link
                        href={`/admin/settings/accounts/edit/${acc.id}`}
                        className="p-2 hover:bg-[#4880FF]/10 text-[#202224] hover:text-[#4880FF]"
                        title="Chỉnh sửa"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(acc.id, acc.fullName)}
                        className="p-2 border-l border-[#D5D5D5] hover:bg-red-50 text-[#EF3826]"
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
        title="Xác nhận xóa tài khoản"
        description={
          confirmState?.kind === "one"
            ? `Bạn có chắc muốn xóa tài khoản "${confirmState.name}"?`
            : confirmState?.kind === "bulk"
              ? `Bạn có chắc muốn xóa ${confirmState.count} tài khoản đã chọn?`
              : ""
        }
        confirmLabel="Xóa tài khoản"
        loading={confirmLoading}
        onConfirm={executeConfirm}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
