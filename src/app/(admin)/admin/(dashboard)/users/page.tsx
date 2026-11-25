"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { ImageUploadBox } from "@/components/admin/ImageUploadBox";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { useAdminPermissions } from "@/components/admin/AdminShell";
import { AdminForbiddenCard } from "@/components/admin/AdminForbiddenCard";

interface UserRow {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  address: string | null;
  avatar: string | null;
  status: "INITIAL" | "ACTIVE" | "INACTIVE";
  createdAt: string;
}

export default function AdminUsersPage() {
  const { hasPermission } = useAdminPermissions();
  const canView = hasPermission("user_view");
  const canEdit = hasPermission("user_edit");

  const [items, setItems] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 10;

  const [status, setStatus] = useState("");
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

  // Modal Create / Edit state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formFullName, setFormFullName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formAvatar, setFormAvatar] = useState("");
  const [formStatus, setFormStatus] = useState<
    "INITIAL" | "ACTIVE" | "INACTIVE"
  >("ACTIVE");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Modal A11y: body scroll lock & Escape close
  useEffect(() => {
    if (!modalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) {
        setModalOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [modalOpen, saving]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (status) params.set("status", status);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (!res.ok) {
        setError(data.message || "Không thể tải danh sách người dùng");
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
  }, [page, status, startDate, endDate, debouncedSearch]);

  useEffect(() => {
    if (!canView) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    fetchUsers();
  }, [canView, fetchUsers]);

  if (forbidden) {
    return (
      <AdminForbiddenCard title="Bạn không có quyền xem Quản lý người dùng" />
    );
  }

  function resetFilters() {
    setStatus("");
    setStartDate("");
    setEndDate("");
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  }

  function openCreateModal() {
    setEditingId(null);
    setFormFullName("");
    setFormEmail("");
    setFormPhone("");
    setFormAddress("");
    setFormAvatar("");
    setFormStatus("ACTIVE");
    setFormError("");
    setModalOpen(true);
  }

  function openEditModal(user: UserRow) {
    setEditingId(user.id);
    setFormFullName(user.fullName);
    setFormEmail(user.email);
    setFormPhone(user.phone || "");
    setFormAddress(user.address || "");
    setFormAvatar(user.avatar || "");
    setFormStatus(user.status);
    setFormError("");
    setModalOpen(true);
  }

  async function handleSaveUser(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const url = editingId
        ? `/api/admin/users/${editingId}`
        : "/api/admin/users";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formFullName,
          email: formEmail,
          phone: formPhone || null,
          address: formAddress || null,
          avatar: formAvatar || null,
          status: formStatus,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.message || "Không thể lưu người dùng");
        return;
      }
      setNotice(data.message);
      setModalOpen(false);
      fetchUsers();
    } catch {
      setFormError("Không thể kết nối máy chủ");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(id: string, name: string) {
    setConfirmState({ kind: "one", id, name });
  }

  async function executeBulk(action: string) {
    setError("");
    setBulkLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
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
      fetchUsers();
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
        const res = await fetch(`/api/admin/users/${confirmState.id}`, {
          method: "DELETE",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.message || "Không thể xóa người dùng");
          return;
        }
        setNotice(data.message);
        fetchUsers();
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
        Quản lý người dùng
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
          <option value="INITIAL">Khởi tạo</option>
          <option value="INACTIVE">Tạm dừng</option>
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
          {canEdit && (
            <div className="flex items-center bg-white rounded-[14px] border border-[#E0E0E0] overflow-hidden">
              <select
                aria-label="Hành động hàng loạt"
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
              placeholder="Tìm kiếm..."
              className="h-11 w-64 sm:w-72 pl-10 pr-4 rounded-[14px] bg-white border border-[#E0E0E0] text-sm focus:outline-none focus:border-[#4880FF]"
            />
          </div>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={openCreateModal}
            className="h-11 px-5 rounded-[14px] bg-[#4880FF] hover:bg-[#3a6ce0] text-white text-sm font-bold inline-flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Tạo mới
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-[14px] border border-[#E0E0E0] overflow-x-auto">
        <table className="w-full min-w-[880px] text-left border-collapse">
          <thead>
            <tr className="bg-[#FCFDFD] border-b border-[#E0E0E0] text-xs font-extrabold uppercase text-[#202224]">
              {canEdit && (
                <th className="py-4 px-4 w-12">
                  <input
                    type="checkbox"
                    aria-label="Chọn tất cả người dùng"
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
              )}
              <th className="py-4 px-4">Họ tên</th>
              <th className="py-4 px-4 text-center">Ảnh đại diện</th>
              <th className="py-4 px-4">Email</th>
              <th className="py-4 px-4">Số điện thoại</th>
              <th className="py-4 px-4">Địa chỉ</th>
              <th className="py-4 px-4 text-center">Trạng thái</th>
              {canEdit && <th className="py-4 px-4 text-center">Hành động</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E0E0E0] text-sm">
            {loading ? (
              <tr>
                <td
                  colSpan={canEdit ? 8 : 6}
                  className="py-10 text-center text-[#667479]"
                >
                  Đang tải dữ liệu...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={canEdit ? 8 : 6}
                  className="py-10 text-center text-[#667479]"
                >
                  Không có người dùng nào phù hợp.
                </td>
              </tr>
            ) : (
              items.map((u) => (
                <tr key={u.id} className="hover:bg-[#F5F6FA]/60">
                  {canEdit && (
                    <td className="py-3.5 px-4">
                      <input
                        type="checkbox"
                        aria-label={`Chọn người dùng ${u.fullName}`}
                        checked={selectedIds.includes(u.id)}
                        onChange={() =>
                          setSelectedIds((prev) =>
                            prev.includes(u.id)
                              ? prev.filter((item) => item !== u.id)
                              : [...prev, u.id]
                          )
                        }
                        className="w-4 h-4 rounded accent-[#4880FF]"
                      />
                    </td>
                  )}
                  <td className="py-3.5 px-4 font-bold text-[#202224]">
                    {u.fullName}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="w-12 h-12 mx-auto rounded-lg overflow-hidden bg-[#F5F6FA] border border-[#E0E0E0] flex items-center justify-center">
                      {u.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={u.avatar}
                          alt={u.fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-bold text-[#4880FF]">
                          {u.fullName.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-[#202224]">{u.email}</td>
                  <td className="py-3.5 px-4 text-[#606060]">
                    {u.phone || "-"}
                  </td>
                  <td className="py-3.5 px-4 text-[#606060] max-w-[220px] truncate">
                    {u.address || "-"}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {u.status === "ACTIVE" ? (
                      <span className="inline-block px-3 py-1 rounded-md bg-[#CCFBF1] text-[#0F766E] text-xs font-bold">
                        Hoạt động
                      </span>
                    ) : u.status === "INITIAL" ? (
                      <span className="inline-block px-3 py-1 rounded-md bg-[#FEF3C7] text-[#B45309] text-xs font-bold">
                        Khởi tạo
                      </span>
                    ) : (
                      <span className="inline-block px-3 py-1 rounded-md bg-[#FEE2E2] text-[#B91C1C] text-xs font-bold">
                        Tạm dừng
                      </span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center rounded-lg border border-[#D5D5D5] bg-[#FAFBFD] overflow-hidden">
                        <button
                          type="button"
                          onClick={() => openEditModal(u)}
                          className="p-2 hover:bg-[#4880FF]/10 text-[#202224] hover:text-[#4880FF]"
                          title="Chỉnh sửa"
                          aria-label={`Chỉnh sửa ${u.fullName}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(u.id, u.fullName)}
                          className="p-2 border-l border-[#D5D5D5] hover:bg-red-50 text-[#B91C1C]"
                          title="Xóa"
                          aria-label={`Xóa ${u.fullName}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-modal-title"
          onClick={() => {
            if (!saving) setModalOpen(false);
          }}
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-[14px] border border-[#E0E0E0] w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-[#E0E0E0] pb-3">
              <h2
                id="user-modal-title"
                className="text-xl font-bold text-[#202224]"
              >
                {editingId ? "Chỉnh sửa người dùng" : "Tạo mới người dùng"}
              </h2>
              <button
                type="button"
                disabled={saving}
                aria-label="Đóng"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-[#F5F6FA] disabled:opacity-40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="user-modal-fullname"
                    className="block text-sm font-semibold text-[#606060] mb-1.5"
                  >
                    Họ tên <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="user-modal-fullname"
                    type="text"
                    required
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor="user-modal-email"
                    className="block text-sm font-semibold text-[#606060] mb-1.5"
                  >
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="user-modal-email"
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor="user-modal-phone"
                    className="block text-sm font-semibold text-[#606060] mb-1.5"
                  >
                    Số điện thoại
                  </label>
                  <input
                    id="user-modal-phone"
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor="user-modal-status"
                    className="block text-sm font-semibold text-[#606060] mb-1.5"
                  >
                    Trạng thái
                  </label>
                  <select
                    id="user-modal-status"
                    value={formStatus}
                    onChange={(e) =>
                      setFormStatus(
                        e.target.value as "INITIAL" | "ACTIVE" | "INACTIVE"
                      )
                    }
                    className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
                  >
                    <option value="ACTIVE">Hoạt động</option>
                    <option value="INITIAL">Khởi tạo</option>
                    <option value="INACTIVE">Tạm dừng</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="user-modal-address"
                  className="block text-sm font-semibold text-[#606060] mb-1.5"
                >
                  Địa chỉ
                </label>
                <input
                  id="user-modal-address"
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
                />
              </div>

              <ImageUploadBox
                label="Ảnh đại diện"
                value={formAvatar}
                onChange={setFormAvatar}
              />

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setModalOpen(false)}
                  className="h-11 px-5 rounded-xl border border-[#D5D5D5] text-sm font-semibold hover:bg-[#F5F6FA] disabled:opacity-40"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-11 px-7 rounded-xl bg-[#4880FF] hover:bg-[#3a6ce0] disabled:opacity-60 text-white text-sm font-bold inline-flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingId ? "Cập nhật" : "Tạo mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(confirmState)}
        title="Xác nhận xóa người dùng"
        description={
          confirmState?.kind === "one"
            ? `Bạn có chắc muốn xóa người dùng "${confirmState.name}"?`
            : confirmState?.kind === "bulk"
              ? `Bạn có chắc muốn xóa ${confirmState.count} người dùng đã chọn?`
              : ""
        }
        confirmLabel="Xóa người dùng"
        loading={confirmLoading}
        onConfirm={executeConfirm}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
