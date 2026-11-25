"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { uploadImageFile } from "@/lib/client-image-upload";
import { enhanceImageUrl } from "@/lib/image-quality";

interface ImageUploadBoxProps {
  label?: string;
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

export function ImageUploadBox({
  label = "Ảnh đại diện",
  value,
  onChange,
  disabled = false,
}: ImageUploadBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setUploading(true);
    try {
      const result = await uploadImageFile(file);
      if (!result.ok || !result.url) {
        setError(result.message || "Tải ảnh thất bại");
        return;
      }
      onChange(result.url);
    } catch {
      setError("Không thể kết nối máy chủ tải ảnh");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-[#606060]">
        {label}
      </label>

      <div className="flex flex-col sm:flex-row items-start gap-4">
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          aria-label={`Chọn hoặc tải ${label.toLowerCase()}`}
          onClick={() => {
            if (!uploading && !disabled) inputRef.current?.click();
          }}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !uploading && !disabled) {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          className={`relative w-36 h-36 rounded-xl border-2 border-dashed border-[#D5D5D5] bg-[#F5F6FA] flex flex-col items-center justify-center overflow-hidden transition-colors ${
            disabled
              ? "opacity-70 cursor-not-allowed"
              : "hover:border-[#4880FF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4880FF] cursor-pointer"
          }`}
        >
          {value ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={enhanceImageUrl(value, 600, 90)}
                alt={label}
                className="w-full h-full object-cover"
              />
              {uploading && (
                <div className="absolute inset-0 bg-white/75 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-[#4880FF] animate-spin" />
                </div>
              )}
              {!disabled && (
                <button
                  type="button"
                  aria-label={`Xóa ${label.toLowerCase()}`}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onChange("");
                  }}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600"
                  title="Xóa ảnh"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          ) : uploading ? (
            <Loader2 className="w-6 h-6 text-[#4880FF] animate-spin" />
          ) : (
            <div className="flex flex-col items-center text-[#667479] px-2 text-center">
              <ImagePlus className="w-7 h-7 mb-1.5 text-[#4880FF]" />
              <span className="text-xs font-medium">Chọn ảnh tải lên</span>
            </div>
          )}
        </div>

        <div className="flex-1 w-full space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            disabled={disabled}
            onChange={handleFileChange}
            className="hidden"
          />
          <input
            type="text"
            disabled={disabled}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => {
              if (value.trim()) {
                onChange(enhanceImageUrl(value, 1600, 90));
              }
            }}
            placeholder="Hoặc dán URL ảnh (https://...)"
            className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white disabled:opacity-70"
          />
          <p className="text-xs text-[#667479]">
            Hỗ trợ PNG, JPG, WebP (tối đa 10MB). Tự động giữ nét 2K & tối ưu Retina qua Next Image / Cloudinary.
          </p>
          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
        </div>
      </div>
    </div>
  );
}
