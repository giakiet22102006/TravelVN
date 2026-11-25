"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  CreditCard,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { useClientMeta } from "@/components/client/ClientLayoutShell";
import { AccountSidebar } from "@/components/client/AccountSidebar";
import type { SavedTravelerItem } from "@/types/ota";

const MAX_SAVED_TRAVELERS = 20;

const GENDER_LABELS: Record<SavedTravelerItem["gender"], string> = {
  MALE: "Nam",
  FEMALE: "Nữ",
  OTHER: "Khác",
};

const TIER_LABELS: Record<SavedTravelerItem["defaultTier"], string> = {
  ADULT: "Người lớn",
  CHILD: "Trẻ em",
  BABY: "Em bé",
};

interface TravelerFormState {
  fullName: string;
  gender: SavedTravelerItem["gender"];
  birthDate: string;
  defaultTier: SavedTravelerItem["defaultTier"];
  relationship: string;
  documentNumber: string;
}

const EMPTY_FORM: TravelerFormState = {
  fullName: "",
  gender: "MALE",
  birthDate: "",
  defaultTier: "ADULT",
  relationship: "",
  documentNumber: "",
};

function formatBirthDateDisplay(isoDate: string): string {
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export default function SavedTravelersPage() {
  const { currentUser } = useClientMeta();
  const [travelers, setTravelers] = useState<SavedTravelerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTraveler, setEditingTraveler] =
    useState<SavedTravelerItem | null>(null);
  const [form, setForm] = useState<TravelerFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [confirmDeleteTraveler, setConfirmDeleteTraveler] =
    useState<SavedTravelerItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchTravelers = useCallback(async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/client/account/travelers");
      if (!res.ok) {
        setTravelers([]);
        return;
      }
      const data = await res.json();
      setTravelers(Array.isArray(data.travelers) ? data.travelers : []);
    } catch {
      setTravelers([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchTravelers();
  }, [fetchTravelers]);

  useEffect(() => {
    if (!dialogOpen && !confirmDeleteTraveler) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (dialogOpen && !submitting) {
        setDialogOpen(false);
      } else if (confirmDeleteTraveler && !deletingId) {
        setConfirmDeleteTraveler(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [dialogOpen, submitting, confirmDeleteTraveler, deletingId]);

  function openCreateModal() {
    setEditingTraveler(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setDialogOpen(true);
  }

  function openEditModal(traveler: SavedTravelerItem) {
    setEditingTraveler(traveler);
    setForm({
      fullName: traveler.fullName,
      gender: traveler.gender,
      birthDate: traveler.birthDate,
      defaultTier: traveler.defaultTier,
      relationship: traveler.relationship ?? "",
      documentNumber: traveler.documentNumber ?? "",
    });
    setFormError("");
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFeedback(null);

    const trimmedName = form.fullName.trim().replace(/\s+/g, " ");
    if (trimmedName.length < 2 || trimmedName.length > 100) {
      setFormError("Họ tên hành khách phải từ 2 đến 100 ký tự.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.birthDate)) {
      setFormError("Vui lòng chọn ngày sinh hợp lệ.");
      return;
    }
    const trimmedDoc = form.documentNumber.trim();
    if (trimmedDoc.length > 30) {
      setFormError("Số CCCD / Hộ chiếu không được vượt quá 30 ký tự.");
      return;
    }
    const trimmedRel = form.relationship.trim();
    if (trimmedRel.length > 50) {
      setFormError("Quan hệ không được vượt quá 50 ký tự.");
      return;
    }

    setSubmitting(true);
    try {
      const url = editingTraveler
        ? `/api/client/account/travelers/${encodeURIComponent(editingTraveler.id)}`
        : "/api/client/account/travelers";
      const method = editingTraveler ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: trimmedName,
          gender: form.gender,
          birthDate: form.birthDate,
          defaultTier: form.defaultTier,
          relationship: trimmedRel || null,
          documentNumber: trimmedDoc || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.message || "Không thể lưu thông tin hành khách.");
        return;
      }

      setDialogOpen(false);
      setFeedback({
        type: "success",
        text:
          data.message ||
          (editingTraveler
            ? "Cập nhật hành khách thành công!"
            : "Đã thêm hành khách vào sổ!"),
      });
      await fetchTravelers();
    } catch {
      setFormError("Không thể kết nối máy chủ.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmDelete(traveler: SavedTravelerItem) {
    setDeletingId(traveler.id);
    setFeedback(null);
    try {
      const res = await fetch(
        `/api/client/account/travelers/${encodeURIComponent(traveler.id)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: data.message || "Không thể xóa hành khách.",
        });
        setConfirmDeleteTraveler(null);
        return;
      }
      setConfirmDeleteTraveler(null);
      setFeedback({
        type: "success",
        text: data.message || "Đã xóa hành khách khỏi sổ!",
      });
      await fetchTravelers();
    } catch {
      setFeedback({
        type: "error",
        text: "Không thể kết nối máy chủ.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  if (!currentUser) {
    return (
      <div className="max-w-[680px] mx-auto px-4 py-14 text-center">
        <div className="bg-white rounded-[16px] border border-subtle p-8 shadow-sm space-y-4">
          <UserCheck className="w-12 h-12 mx-auto text-client-primary" />
          <h1 className="text-[22px] font-bold text-ink">
            Đăng nhập để quản lý Sổ hành khách
          </h1>
          <p className="text-[14px] text-ink-muted">
            Lưu sẵn thông tin người thân và bạn đồng hành để điền nhanh chỉ
            trong 1 chạm khi đặt tour.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <Link
              href="/login?next=/account/travelers"
              className="px-6 py-2.5 rounded-[10px] bg-client-primary text-white font-semibold text-[14px] hover:bg-client-primary-hover transition-colors"
            >
              Đăng Nhập
            </Link>
            <Link
              href="/register"
              className="px-6 py-2.5 rounded-[10px] border border-strong text-ink font-semibold text-[14px] hover:border-client-primary hover:text-client-primary transition-colors"
            >
              Đăng Ký
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isAtQuota = travelers.length >= MAX_SAVED_TRAVELERS;
  const todayVN = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());

  return (
    <div className="max-w-[1120px] mx-auto px-4 py-8 sm:py-10">
      <h1 className="text-[24px] sm:text-[28px] font-bold text-ink mb-6">
        Sổ Hành Khách
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4">
          <AccountSidebar />
        </div>

        <div className="lg:col-span-8 space-y-5">
          {/* Header & Quota Bar */}
          <div className="bg-white rounded-[16px] border border-subtle p-5 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[17px] font-bold text-ink">
                  Danh sách hành khách đã lưu
                </h2>
                <span
                  className={`text-[12px] font-semibold px-2.5 py-0.5 rounded-full border tabular-nums ${
                    isAtQuota
                      ? "bg-status-warn-bg border-status-warn-border text-status-warn"
                      : "bg-client-soft border-client-border text-client-primary"
                  }`}
                >
                  {travelers.length} / {MAX_SAVED_TRAVELERS} hành khách
                </span>
              </div>
              <p className="text-[13px] text-ink-muted">
                Dùng để tự động điền thông tin hành khách ở bước thanh toán giỏ
                hàng.
              </p>
            </div>

            <button
              type="button"
              disabled={isAtQuota || loading}
              onClick={openCreateModal}
              className="px-4 h-[42px] rounded-[10px] bg-client-primary hover:bg-client-primary-hover text-white text-[13px] font-semibold inline-flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-client-primary/40 disabled:opacity-60"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm hành khách</span>
            </button>
          </div>

          {feedback && (
            <div
              role="alert"
              className={`p-3.5 rounded-[10px] text-[13px] font-medium flex items-center gap-2 ${
                feedback.type === "success"
                  ? "bg-status-success-bg text-status-success border border-status-success-border"
                  : "bg-status-danger-bg text-status-danger border border-status-danger-border"
              }`}
            >
              {feedback.type === "success" && (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-[136px] rounded-[16px] bg-surface-muted border border-subtle animate-pulse"
                />
              ))}
            </div>
          ) : travelers.length === 0 ? (
            <div className="bg-white rounded-[16px] border border-subtle p-10 text-center shadow-sm space-y-3">
              <Users className="w-12 h-12 mx-auto text-ink-muted" />
              <p className="text-[16px] font-bold text-ink">
                Chưa có hành khách nào được lưu
              </p>
              <p className="text-[13px] text-ink-muted max-w-md mx-auto">
                Lưu sẵn họ tên, ngày sinh và số giấy tờ của bạn hoặc người thân
                để điền nhanh trong 1 chạm ở trang đặt tour.
              </p>
              <button
                type="button"
                onClick={openCreateModal}
                className="mt-2 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-[10px] bg-client-primary hover:bg-client-primary-hover text-white text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-client-primary/40"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm hành khách đầu tiên</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {travelers.map((t) => (
                <div
                  key={t.id}
                  className="bg-white rounded-[16px] border border-subtle p-5 shadow-sm flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-[16px] font-bold text-ink break-words">
                        {t.fullName}
                      </h3>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-client-soft border border-client-border text-client-primary">
                          {TIER_LABELS[t.defaultTier]}
                        </span>
                        {t.relationship && (
                          <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-surface-muted border border-subtle text-ink-muted">
                            {t.relationship}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-[13px] text-ink-muted space-y-1 tabular-nums">
                      <p className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-client-primary shrink-0" />
                        <span>
                          {GENDER_LABELS[t.gender]} •{" "}
                          {formatBirthDateDisplay(t.birthDate)}
                        </span>
                      </p>
                      {t.documentNumber && (
                        <p className="flex items-center gap-2">
                          <CreditCard className="w-3.5 h-3.5 text-client-primary shrink-0" />
                          <span>CCCD / Hộ chiếu: {t.documentNumber}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-subtle">
                    <button
                      type="button"
                      aria-label={`Sửa ${t.fullName}`}
                      onClick={() => openEditModal(t)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-client-border bg-client-soft text-client-primary hover:bg-client-border/40 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-client-primary/40"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Sửa</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Xóa ${t.fullName}`}
                      onClick={() => setConfirmDeleteTraveler(t)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-status-danger-border text-status-danger hover:bg-status-danger-bg text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-danger/40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Traveler Dialog */}
      {dialogOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) {
              setDialogOpen(false);
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="traveler-dialog-title"
            className="w-full max-w-lg bg-white rounded-[16px] p-6 shadow-2xl border border-subtle space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-subtle">
              <h3
                id="traveler-dialog-title"
                className="text-[18px] font-bold text-ink"
              >
                {editingTraveler
                  ? "Cập nhật thông tin hành khách"
                  : "Thêm hành khách mới"}
              </h3>
              <button
                type="button"
                aria-label="Đóng hộp thoại"
                disabled={submitting}
                onClick={() => setDialogOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div
                role="alert"
                className="p-3 rounded-[10px] text-[13px] font-medium bg-status-danger-bg text-status-danger border border-status-danger-border"
              >
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="traveler-fullName"
                  className="block text-[13px] font-semibold text-ink mb-1.5"
                >
                  Họ và tên <span className="text-status-danger">*</span>
                </label>
                <input
                  id="traveler-fullName"
                  type="text"
                  required
                  maxLength={100}
                  aria-invalid={Boolean(formError)}
                  value={form.fullName}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, fullName: e.target.value }))
                  }
                  placeholder="Nguyễn Văn A"
                  className="w-full h-[42px] px-3.5 rounded-[8px] border border-strong text-[14px] text-ink placeholder:text-ink-muted focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/40"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="traveler-gender"
                    className="block text-[13px] font-semibold text-ink mb-1.5"
                  >
                    Giới tính <span className="text-status-danger">*</span>
                  </label>
                  <select
                    id="traveler-gender"
                    value={form.gender}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        gender: e.target.value as SavedTravelerItem["gender"],
                      }))
                    }
                    className="w-full h-[42px] px-3 rounded-[8px] border border-strong bg-white text-[14px] text-ink focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/40"
                  >
                    <option value="MALE">Nam</option>
                    <option value="FEMALE">Nữ</option>
                    <option value="OTHER">Khác</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="traveler-birthDate"
                    className="block text-[13px] font-semibold text-ink mb-1.5"
                  >
                    Ngày sinh <span className="text-status-danger">*</span>
                  </label>
                  <input
                    id="traveler-birthDate"
                    type="date"
                    required
                    min="1900-01-01"
                    max={todayVN}
                    value={form.birthDate}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        birthDate: e.target.value,
                      }))
                    }
                    className="w-full h-[42px] px-3.5 rounded-[8px] border border-strong text-[14px] text-ink tabular-nums focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/40"
                  />
                </div>

                <div>
                  <label
                    htmlFor="traveler-defaultTier"
                    className="block text-[13px] font-semibold text-ink mb-1.5"
                  >
                    Nhóm hành khách <span className="text-status-danger">*</span>
                  </label>
                  <select
                    id="traveler-defaultTier"
                    value={form.defaultTier}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        defaultTier: e.target
                          .value as SavedTravelerItem["defaultTier"],
                      }))
                    }
                    className="w-full h-[42px] px-3 rounded-[8px] border border-strong bg-white text-[14px] text-ink focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/40"
                  >
                    <option value="ADULT">Người lớn</option>
                    <option value="CHILD">Trẻ em</option>
                    <option value="BABY">Em bé</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="traveler-relationship"
                    className="block text-[13px] font-semibold text-ink mb-1.5"
                  >
                    Quan hệ (tùy chọn)
                  </label>
                  <input
                    id="traveler-relationship"
                    type="text"
                    maxLength={50}
                    value={form.relationship}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        relationship: e.target.value,
                      }))
                    }
                    placeholder="Bản thân, Vợ/Chồng, Con..."
                    className="w-full h-[42px] px-3.5 rounded-[8px] border border-strong text-[14px] text-ink placeholder:text-ink-muted focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/40"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="traveler-documentNumber"
                  className="block text-[13px] font-semibold text-ink mb-1.5"
                >
                  Số CCCD / Hộ chiếu (tùy chọn)
                </label>
                <input
                  id="traveler-documentNumber"
                  type="text"
                  maxLength={30}
                  value={form.documentNumber}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      documentNumber: e.target.value,
                    }))
                  }
                  placeholder="Tối đa 30 ký tự"
                  className="w-full h-[42px] px-3.5 rounded-[8px] border border-strong text-[14px] text-ink tabular-nums placeholder:text-ink-muted focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/40"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setDialogOpen(false)}
                  className="px-4 py-2 rounded-[8px] border border-strong hover:bg-surface-muted text-[13px] font-semibold text-ink transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-[8px] bg-client-primary hover:bg-client-primary-hover text-white text-[13px] font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                >
                  {submitting && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>
                    {editingTraveler ? "Lưu thay đổi" : "Thêm hành khách"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {confirmDeleteTraveler && (
        <div
          onClick={(e) => {
            if (
              e.target === e.currentTarget &&
              deletingId !== confirmDeleteTraveler.id
            ) {
              setConfirmDeleteTraveler(null);
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-traveler-dialog-title"
            className="w-full max-w-md bg-white rounded-[16px] p-6 shadow-2xl border border-subtle space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-status-danger-bg text-status-danger flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3
                  id="delete-traveler-dialog-title"
                  className="text-[17px] font-bold text-ink"
                >
                  Xóa hành khách {confirmDeleteTraveler.fullName}?
                </h3>
                <p className="text-[13px] text-ink-muted mt-1">
                  Thông tin hành khách này sẽ bị xóa khỏi Sổ hành khách nhưng
                  không ảnh hưởng đến các đơn hàng đã đặt trước đó.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={deletingId === confirmDeleteTraveler.id}
                onClick={() => setConfirmDeleteTraveler(null)}
                className="px-4 py-2 rounded-[8px] border border-strong hover:bg-surface-muted text-[13px] font-semibold text-ink transition-colors"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={deletingId === confirmDeleteTraveler.id}
                onClick={() => handleConfirmDelete(confirmDeleteTraveler)}
                className="px-4 py-2 rounded-[8px] bg-status-danger hover:bg-status-danger/90 text-white text-[13px] font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
              >
                {deletingId === confirmDeleteTraveler.id && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                <span>Xác nhận xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
