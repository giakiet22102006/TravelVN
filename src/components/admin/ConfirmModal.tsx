"use client";

import { useEffect } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  tone = "danger",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) {
        onCancel();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      onClick={() => {
        if (!loading) onCancel();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white border border-[#E0E0E0] shadow-xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                tone === "danger"
                  ? "bg-red-50 text-[#EF3826]"
                  : "bg-[#4880FF]/10 text-[#4880FF]"
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2
              id="confirm-modal-title"
              className="text-base font-bold text-[#202224]"
            >
              {title}
            </h2>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            aria-label="Đóng hộp thoại"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[#667479] hover:bg-[#F5F6FA] hover:text-[#202224] disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-[#606060] leading-relaxed">{description}</p>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="h-10 px-4 rounded-xl border border-[#D5D5D5] bg-white hover:bg-[#F5F6FA] text-sm font-semibold text-[#202224] disabled:opacity-40"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`h-10 px-4 rounded-xl text-sm font-bold text-white inline-flex items-center gap-2 disabled:opacity-60 ${
              tone === "danger"
                ? "bg-[#EA0234] hover:bg-[#c8022d]"
                : "bg-[#4880FF] hover:bg-[#3a6ce0]"
            }`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
