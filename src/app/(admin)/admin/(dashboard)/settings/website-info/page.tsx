"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ImageUploadBox } from "@/components/admin/ImageUploadBox";
import { useAdminPermissions } from "@/components/admin/AdminShell";
import { AdminForbiddenCard } from "@/components/admin/AdminForbiddenCard";

export default function AdminWebsiteInfoPage() {
  const router = useRouter();
  const { hasPermission } = useAdminPermissions();
  const canView = hasPermission("setting_view");
  const canEdit = hasPermission("setting_edit");

  const [websiteName, setWebsiteName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [logo, setLogo] = useState("");
  const [favicon, setFavicon] = useState("");

  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!canView) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    let active = true;
    fetch("/api/admin/settings/website-info")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.status === 403) {
          if (active) setForbidden(true);
          return;
        }
        if (!res.ok) {
          if (active) {
            setError(data.message || "Không thể tải thông tin website");
          }
          return;
        }
        if (active && data.item) {
          setWebsiteName(data.item.websiteName || "");
          setPhone(data.item.phone || "");
          setEmail(data.item.email || "");
          setAddress(data.item.address || "");
          setLogo(data.item.logo || "");
          setFavicon(data.item.favicon || "");
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
  }, [canView]);

  if (forbidden) {
    return (
      <AdminForbiddenCard
        title="Bạn không có quyền xem Thông tin website"
        backHref="/admin/settings"
        backLabel="Quay lại Cài đặt chung"
      />
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setError("");
    setNotice("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/settings/website-info", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteName,
          phone,
          email,
          address,
          logo: logo || null,
          favicon: favicon || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "Không thể cập nhật thông tin website");
        return;
      }
      setNotice(data.message || "Cập nhật thông tin website thành công!");
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
        Thông tin website
      </h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-[14px] border border-[#E0E0E0] p-6 sm:p-8 space-y-6"
      >
        {loading ? (
          <div className="py-10 text-center text-sm text-[#667479]">
            Đang tải thông tin website...
          </div>
        ) : (
          <>
            {!canEdit && (
              <div className="rounded-lg bg-[#FEF3C7] border border-amber-200 text-[#B45309] text-sm px-4 py-3 font-semibold">
                Bạn chỉ có quyền xem thông tin website. Cần quyền &ldquo;Cập nhật thông tin website&rdquo; để lưu thay đổi.
              </div>
            )}
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
                <label
                  htmlFor="website-name"
                  className="block text-sm font-semibold text-[#606060] mb-2"
                >
                  Tên website <span className="text-red-500">*</span>
                </label>
                <input
                  id="website-name"
                  type="text"
                  required
                  disabled={!canEdit}
                  value={websiteName}
                  onChange={(e) => setWebsiteName(e.target.value)}
                  placeholder="VN.TRAVEL"
                  className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white disabled:opacity-70"
                />
              </div>

              <div>
                <label
                  htmlFor="website-phone"
                  className="block text-sm font-semibold text-[#606060] mb-2"
                >
                  Số điện thoại
                </label>
                <input
                  id="website-phone"
                  type="text"
                  disabled={!canEdit}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0123456789"
                  className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white disabled:opacity-70"
                />
              </div>

              <div>
                <label
                  htmlFor="website-email"
                  className="block text-sm font-semibold text-[#606060] mb-2"
                >
                  Email
                </label>
                <input
                  id="website-email"
                  type="email"
                  disabled={!canEdit}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@vn.travel.com"
                  className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white disabled:opacity-70"
                />
              </div>

              <div>
                <label
                  htmlFor="website-address"
                  className="block text-sm font-semibold text-[#606060] mb-2"
                >
                  Địa chỉ
                </label>
                <input
                  id="website-address"
                  type="text"
                  disabled={!canEdit}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Số 123, đường ABC"
                  className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white disabled:opacity-70"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ImageUploadBox
                label="Logo"
                value={logo}
                onChange={setLogo}
                disabled={!canEdit}
              />
              <ImageUploadBox
                label="Favicon"
                value={favicon}
                onChange={setFavicon}
                disabled={!canEdit}
              />
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              {canEdit && (
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-12 px-10 rounded-xl bg-[#4880FF] hover:bg-[#3a6ce0] disabled:opacity-60 text-white font-bold text-sm inline-flex items-center gap-2 transition-colors"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Cập nhật
                </button>
              )}

              <Link
                href="/admin/settings"
                className="inline-flex items-center gap-2 text-sm font-bold text-[#4880FF] hover:underline"
              >
                <ArrowLeft className="w-4 h-4" />
                Quay lại danh sách
              </Link>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
