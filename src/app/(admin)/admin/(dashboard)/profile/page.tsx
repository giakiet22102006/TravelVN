"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { ImageUploadBox } from "@/components/admin/ImageUploadBox";

export default function AdminProfilePage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [positionCompany, setPositionCompany] = useState("");
  const [roleName, setRoleName] = useState("");
  const [avatar, setAvatar] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/profile")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (active) {
            setError(data.message || "Không thể tải thông tin cá nhân");
          }
          return;
        }
        if (active && data.item) {
          setFullName(data.item.fullName || "");
          setEmail(data.item.email || "");
          setPhone(data.item.phone || "");
          setPositionCompany(data.item.positionCompany || "");
          setRoleName(data.item.role?.name || "Quản trị viên");
          setAvatar(data.item.avatar || "");
        }
      })
      .catch(() => {
        if (active) setError("Không thể kết nối máy chủ");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          phone: phone || null,
          positionCompany: positionCompany || null,
          avatar: avatar || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Không thể cập nhật thông tin cá nhân");
        return;
      }
      setNotice(data.message || "Cập nhật thông tin cá nhân thành công!");
      router.refresh();
    } catch {
      setError("Không thể kết nối máy chủ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl sm:text-[32px] font-bold text-[#202224]">
          Thông tin cá nhân
        </h1>
        <Link
          href="/admin/profile/change-password"
          className="h-10 px-4 rounded-xl border border-[#4880FF] text-[#4880FF] hover:bg-[#4880FF]/5 text-sm font-bold inline-flex items-center gap-2 transition-colors"
        >
          <KeyRound className="w-4 h-4" />
          Đổi mật khẩu
        </Link>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-[14px] border border-[#E0E0E0] p-6 sm:p-8 space-y-6"
      >
        {loading ? (
          <div className="py-10 text-center text-sm text-[#667479]">
            Đang tải thông tin cá nhân...
          </div>
        ) : (
          <>
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 font-medium">
                {error}
              </div>
            )}
            {notice && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 font-semibold">
                {notice}
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
                  className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#606060] mb-2">
                  Chức vụ
                </label>
                <input
                  type="text"
                  readOnly
                  value={positionCompany || "Chưa cập nhật"}
                  className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#EAECEE] text-sm text-[#606060] cursor-not-allowed"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-[#606060] mb-2">
                  Nhóm quyền
                </label>
                <input
                  type="text"
                  readOnly
                  value={roleName}
                  className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#EAECEE] text-sm text-[#4880FF] font-bold cursor-not-allowed"
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
                Cập nhật
              </button>

              <Link
                href="/admin/profile/change-password"
                className="text-sm font-bold text-[#4880FF] hover:underline"
              >
                Đổi mật khẩu
              </Link>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
