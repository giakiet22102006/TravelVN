"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ImageUploadBox } from "./ImageUploadBox";

interface RoleOption {
  id: string;
  name: string;
}

export interface AdminAccountFormData {
  id?: string;
  fullName: string;
  email: string;
  phone: string;
  roleId: string;
  positionCompany: string;
  status: "INITIAL" | "ACTIVE" | "INACTIVE";
  avatar: string;
}

interface AdminAccountFormProps {
  mode: "create" | "edit";
  initialData?: AdminAccountFormData;
}

export function AdminAccountForm({ mode, initialData }: AdminAccountFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialData?.fullName || "");
  const [email, setEmail] = useState(initialData?.email || "");
  const [phone, setPhone] = useState(initialData?.phone || "");
  const [roleId, setRoleId] = useState(initialData?.roleId || "");
  const [positionCompany, setPositionCompany] = useState(
    initialData?.positionCompany || ""
  );
  const [status, setStatus] = useState<"INITIAL" | "ACTIVE" | "INACTIVE">(
    initialData?.status || "ACTIVE"
  );
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState(initialData?.avatar || "");

  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings/roles?all=true")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.items)) {
          setRoles(data.items);
        }
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const endpoint =
        mode === "create"
          ? "/api/admin/settings/accounts"
          : `/api/admin/settings/accounts/${initialData?.id}`;
      const method = mode === "create" ? "POST" : "PUT";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          phone: phone || null,
          roleId: roleId || null,
          positionCompany: positionCompany || null,
          status,
          password: password || undefined,
          avatar: avatar || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Có lỗi xảy ra");
        return;
      }

      router.push("/admin/settings/accounts");
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
        {mode === "create"
          ? "Tạo tài khoản quản trị"
          : "Chỉnh sửa tài khoản quản trị"}
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
              Họ tên <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ví dụ: Lê Văn A"
              className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#606060] mb-2">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@28travel.com"
              className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#606060] mb-2">
              Số điện thoại
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0123456789"
              className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#606060] mb-2">
              Nhóm quyền
            </label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
            >
              <option value="">-- Chọn nhóm quyền --</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#606060] mb-2">
              Chức vụ
            </label>
            <input
              type="text"
              value={positionCompany}
              onChange={(e) => setPositionCompany(e.target.value)}
              placeholder="Ví dụ: Giám đốc / Nhân viên"
              className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#606060] mb-2">
              Trạng thái
            </label>
            <select
              value={status}
              onChange={(e) =>
                setStatus(
                  e.target.value as "INITIAL" | "ACTIVE" | "INACTIVE"
                )
              }
              className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
            >
              <option value="ACTIVE">Hoạt động</option>
              <option value="INACTIVE">Tạm dừng</option>
              <option value="INITIAL">Khởi tạo</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-[#606060] mb-2">
              Mật khẩu{" "}
              {mode === "create" ? (
                <span className="text-red-500">*</span>
              ) : (
                <span className="text-xs font-normal text-[#99A2A5]">
                  (Để trống nếu giữ nguyên mật khẩu hiện tại)
                </span>
              )}
            </label>
            <input
              type="password"
              required={mode === "create"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "create" ? "Ít nhất 6 ký tự" : "••••••••"}
              className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
            />
          </div>
        </div>

        <ImageUploadBox
          label="Ảnh đại diện"
          value={avatar}
          onChange={setAvatar}
        />

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
            href="/admin/settings/accounts"
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
