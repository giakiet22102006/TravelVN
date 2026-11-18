"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ALL_PERMISSION_KEYS, PERMISSION_ITEMS } from "@/lib/permissions";

export interface RoleFormData {
  id?: string;
  name: string;
  description: string;
  permissions: string[];
}

interface RoleFormProps {
  mode: "create" | "edit";
  initialData?: RoleFormData;
}

export function RoleForm({ mode, initialData }: RoleFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(
    initialData?.description || ""
  );
  const [permissions, setPermissions] = useState<string[]>(
    initialData?.permissions || []
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function togglePermission(key: string) {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  }

  function toggleAllPermissions() {
    if (permissions.length === ALL_PERMISSION_KEYS.length) {
      setPermissions([]);
    } else {
      setPermissions([...ALL_PERMISSION_KEYS]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const endpoint =
        mode === "create"
          ? "/api/admin/settings/roles"
          : `/api/admin/settings/roles/${initialData?.id}`;
      const method = mode === "create" ? "POST" : "PUT";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          permissions,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Có lỗi xảy ra");
        return;
      }

      router.push("/admin/settings/roles");
      router.refresh();
    } catch {
      setError("Không thể kết nối máy chủ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-[32px] font-bold text-[#202224]">
        {mode === "create" ? "Tạo nhóm quyền" : "Chỉnh sửa nhóm quyền"}
      </h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-[14px] border border-[#E0E0E0] p-6 sm:p-8 space-y-6"
      >
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 font-medium">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-[#606060] mb-2">
              Tên nhóm quyền <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Quản lý tour"
              className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#606060] mb-2">
              Mô tả ngắn
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Có đầy đủ các quyền..."
              className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
            />
          </div>
        </div>

        {/* Permissions Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-semibold text-[#606060]">
              Phân quyền ({permissions.length}/{ALL_PERMISSION_KEYS.length})
            </label>
            <button
              type="button"
              onClick={toggleAllPermissions}
              className="text-xs font-bold text-[#4880FF] hover:underline"
            >
              {permissions.length === ALL_PERMISSION_KEYS.length
                ? "Bỏ chọn tất cả"
                : "Chọn tất cả"}
            </button>
          </div>

          <div className="rounded-xl border border-[#E0E0E0] bg-[#F5F6FA] p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PERMISSION_ITEMS.map((perm) => (
              <label
                key={perm.key}
                className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white border border-[#E0E0E0] cursor-pointer hover:border-[#4880FF] transition-colors"
              >
                <input
                  type="checkbox"
                  checked={permissions.includes(perm.key)}
                  onChange={() => togglePermission(perm.key)}
                  className="w-4 h-4 rounded accent-[#4880FF]"
                />
                <span className="text-sm font-semibold text-[#202224]">
                  {perm.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="h-12 px-10 rounded-xl bg-[#4880FF] hover:bg-[#3a6ce0] disabled:opacity-60 text-white font-bold text-sm inline-flex items-center gap-2 transition-colors"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "create" ? "Tạo mới" : "Cập nhật"}
          </button>

          <Link
            href="/admin/settings/roles"
            className="inline-flex items-center gap-2 text-sm font-bold text-[#4880FF] hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại danh sách
          </Link>
        </div>
      </form>
    </div>
  );
}
