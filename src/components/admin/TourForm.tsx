"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { ImageUploadBox } from "./ImageUploadBox";
import { TourDeparturesManager } from "./TourDeparturesManager";
import { uploadImageFile } from "@/lib/client-image-upload";
import { enhanceImageUrl } from "@/lib/image-quality";

interface CategoryOption {
  id: string;
  name: string;
  parentId: string | null;
}

export interface TourScheduleItem {
  title: string;
  description: string;
}

export interface TourFormData {
  id?: string;
  code?: string;
  name: string;
  categoryId: string;
  position: number;
  status: "ACTIVE" | "INACTIVE";
  avatar: string;
  images: string[];
  priceAdult: number;
  priceChild: number;
  priceBaby: number;
  priceNewAdult: number;
  priceNewChild: number;
  priceNewBaby: number;
  stockAdult: number;
  stockChild: number;
  stockBaby: number;
  locations: string[];
  time: string;
  vehicle: string;
  departureDate: string;
  information: string;
  schedules: TourScheduleItem[];
}

interface TourFormProps {
  mode: "create" | "edit";
  initialData?: TourFormData;
}

const LOCATION_OPTIONS = [
  "Hà Nội",
  "Đà Nẵng",
  "Nha Trang",
  "Hồ Chí Minh",
  "Phú Quốc",
  "Sapa",
];

function buildIndentedCategories(
  categories: CategoryOption[],
  parentId: string | null = null,
  prefix = ""
): Array<{ id: string; label: string }> {
  const result: Array<{ id: string; label: string }> = [];
  for (const cat of categories) {
    if ((cat.parentId || null) === parentId) {
      result.push({ id: cat.id, label: `${prefix}${cat.name}` });
      result.push(...buildIndentedCategories(categories, cat.id, `${prefix}-- `));
    }
  }
  return result;
}

export function TourForm({ mode, initialData }: TourFormProps) {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  const [name, setName] = useState(initialData?.name || "");
  const [categoryId, setCategoryId] = useState(initialData?.categoryId || "");
  const [position, setPosition] = useState<number>(initialData?.position || 1);
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">(
    initialData?.status || "ACTIVE"
  );
  const [avatar, setAvatar] = useState(initialData?.avatar || "");
  const [images, setImages] = useState<string[]>(initialData?.images || []);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [uploadingGallery, setUploadingGallery] = useState(false);

  const [priceAdult, setPriceAdult] = useState<number>(
    initialData?.priceAdult || 0
  );
  const [priceChild, setPriceChild] = useState<number>(
    initialData?.priceChild || 0
  );
  const [priceBaby, setPriceBaby] = useState<number>(
    initialData?.priceBaby || 0
  );

  const [priceNewAdult, setPriceNewAdult] = useState<number>(
    initialData?.priceNewAdult || 0
  );
  const [priceNewChild, setPriceNewChild] = useState<number>(
    initialData?.priceNewChild || 0
  );
  const [priceNewBaby, setPriceNewBaby] = useState<number>(
    initialData?.priceNewBaby || 0
  );

  const [stockAdult, setStockAdult] = useState<number>(
    initialData?.stockAdult || 0
  );
  const [stockChild, setStockChild] = useState<number>(
    initialData?.stockChild || 0
  );
  const [stockBaby, setStockBaby] = useState<number>(
    initialData?.stockBaby || 0
  );

  const [locations, setLocations] = useState<string[]>(
    initialData?.locations || ["Hà Nội"]
  );
  const [time, setTime] = useState(initialData?.time || "");
  const [vehicle, setVehicle] = useState(initialData?.vehicle || "");
  const [departureDate, setDepartureDate] = useState(
    initialData?.departureDate || ""
  );
  const [information, setInformation] = useState(
    initialData?.information || ""
  );
  const [schedules, setSchedules] = useState<TourScheduleItem[]>(
    initialData?.schedules && initialData.schedules.length > 0
      ? initialData.schedules
      : [
          {
            title: "",
            description: "",
          },
        ]
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/categories?all=true")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.message || "Không thể tải danh mục");
        }
        return data;
      })
      .then((data) => {
        if (!active) return;
        if (Array.isArray(data.items)) {
          setCategories(data.items);
          const firstId = data.items[0]?.id || "";
          if (firstId) {
            setCategoryId((prev) => prev || firstId);
          }
        }
      })
      .catch((err: unknown) => {
        if (active && err instanceof Error) {
          setError((prev) => prev || err.message);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const categoryOptions = buildIndentedCategories(categories);

  function toggleLocation(loc: string) {
    setLocations((prev) =>
      prev.includes(loc) ? prev.filter((item) => item !== loc) : [...prev, loc]
    );
  }

  async function handleGalleryUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingGallery(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const result = await uploadImageFile(file);
        if (result.ok && result.url) {
          uploaded.push(result.url);
        }
      }
      if (uploaded.length > 0) {
        setImages((prev) => [...prev, ...uploaded]);
      }
    } finally {
      setUploadingGallery(false);
      e.target.value = "";
    }
  }

  function addScheduleItem() {
    setSchedules((prev) => [
      ...prev,
      {
        title: "",
        description: "",
      },
    ]);
  }

  function updateSchedule(
    index: number,
    field: "title" | "description",
    value: string
  ) {
    setSchedules((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, [field]: value } : item
      )
    );
  }

  function removeSchedule(index: number) {
    setSchedules((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const pricePairs = [
      { label: "Người lớn", oldVal: priceAdult, newVal: priceNewAdult },
      { label: "Trẻ em", oldVal: priceChild, newVal: priceNewChild },
      { label: "Em bé", oldVal: priceBaby, newVal: priceNewBaby },
    ];
    for (const { label, oldVal, newVal } of pricePairs) {
      if (oldVal < 0 || newVal < 0) {
        setError(`Giá ${label.toLowerCase()} không được là số âm.`);
        return;
      }
      if (oldVal > 0 && newVal > oldVal) {
        setError(`Giá mới (${label}) không được lớn hơn giá cũ.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const endpoint =
        mode === "create"
          ? "/api/admin/tours"
          : `/api/admin/tours/${initialData?.id}`;
      const method = mode === "create" ? "POST" : "PUT";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          categoryId,
          position,
          status,
          avatar: avatar ? enhanceImageUrl(avatar, 1600, 90) : null,
          images: images.map((img) => enhanceImageUrl(img, 1600, 90)),
          priceAdult,
          priceChild,
          priceBaby,
          priceNewAdult,
          priceNewChild,
          priceNewBaby,
          stockAdult,
          stockChild,
          stockBaby,
          locations,
          time,
          vehicle,
          departureDate: departureDate || null,
          information,
          schedules: schedules.filter(
            (s) => s.title.trim() || s.description.trim()
          ),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Có lỗi xảy ra");
        return;
      }
      router.push("/admin/tours");
      router.refresh();
    } catch {
      setError("Không thể kết nối máy chủ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-[32px] font-bold text-[#202224]">
          {mode === "create" ? "Tạo tour" : "Chỉnh sửa tour"}
        </h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-[14px] border border-[#E0E0E0] p-6 sm:p-8 space-y-6"
      >
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 font-medium">
            {error}
          </div>
        )}

        {/* Row 1: Tên tour, Danh mục, Vị trí, Trạng thái */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-[#606060] mb-2">
              Tên tour <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Tour Hạ Long 3N2Đ"
              className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#606060] mb-2">
              Danh mục <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
            >
              <option value="">-- Chọn danh mục --</option>
              {categoryOptions.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#606060] mb-2">
              Vị trí
            </label>
            <input
              type="number"
              min={1}
              value={position}
              onChange={(e) => setPosition(Math.max(1, Number(e.target.value)))}
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
                setStatus(e.target.value === "INACTIVE" ? "INACTIVE" : "ACTIVE")
              }
              className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
            >
              <option value="ACTIVE">Hoạt động</option>
              <option value="INACTIVE">Tạm dừng</option>
            </select>
          </div>
        </div>

        {/* Ảnh đại diện */}
        <ImageUploadBox
          label="Ảnh đại diện"
          value={avatar}
          onChange={setAvatar}
        />

        {/* Gallery ảnh */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-[#606060]">
            Danh sách ảnh tour (Gallery)
          </label>
          <div className="flex flex-wrap gap-3">
            {images.map((imgUrl, idx) => (
              <div
                key={`${imgUrl}-${idx}`}
                className="relative w-24 h-24 rounded-xl overflow-hidden border border-[#E0E0E0] bg-[#F5F6FA]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgUrl}
                  alt={`Gallery ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  aria-label={`Xóa ảnh gallery ${idx + 1}`}
                  onClick={() =>
                    setImages((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/65 text-white text-xs flex items-center justify-center hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            ))}
            <label className="w-24 h-24 rounded-xl border-2 border-dashed border-[#D5D5D5] bg-[#F5F6FA] hover:border-[#4880FF] cursor-pointer flex flex-col items-center justify-center text-xs text-[#667479]">
              {uploadingGallery ? (
                <Loader2 className="w-5 h-5 animate-spin text-[#4880FF]" />
              ) : (
                <>
                  <Upload className="w-5 h-5 text-[#4880FF] mb-1" />
                  <span>Thêm ảnh</span>
                </>
              )}
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleGalleryUpload}
                className="hidden"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
              placeholder="Hoặc dán URL ảnh gallery rồi bấm Thêm..."
              className="flex-1 h-10 px-3 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm"
            />
            <button
              type="button"
              onClick={() => {
                if (newImageUrl.trim()) {
                  setImages((prev) => [
                    ...prev,
                    enhanceImageUrl(newImageUrl.trim(), 1600, 90),
                  ]);
                  setNewImageUrl("");
                }
              }}
              className="px-4 h-10 rounded-lg bg-[#F5F6FA] border border-[#D5D5D5] text-sm font-semibold hover:border-[#4880FF]"
            >
              Thêm URL
            </button>
          </div>
        </div>

        {/* 3-tier Pricing & Stock (matching Figma #12:2360) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-[#606060]">
              Giá cũ (VNĐ)
            </label>
            <div className="grid grid-cols-[90px_1fr] items-center gap-3">
              <span className="text-xs font-semibold text-[#606060]">
                Người lớn
              </span>
              <input
                type="number"
                min={0}
                value={priceAdult}
                onChange={(e) => setPriceAdult(Number(e.target.value))}
                className="h-10 px-3 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm"
              />
              <span className="text-xs font-semibold text-[#606060]">
                Trẻ em
              </span>
              <input
                type="number"
                min={0}
                value={priceChild}
                onChange={(e) => setPriceChild(Number(e.target.value))}
                className="h-10 px-3 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm"
              />
              <span className="text-xs font-semibold text-[#606060]">
                Em bé
              </span>
              <input
                type="number"
                min={0}
                value={priceBaby}
                onChange={(e) => setPriceBaby(Number(e.target.value))}
                className="h-10 px-3 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-[#606060]">
              Giá mới (VNĐ)
            </label>
            <div className="grid grid-cols-[90px_1fr] items-center gap-3">
              <span className="text-xs font-semibold text-[#606060]">
                Người lớn
              </span>
              <input
                type="number"
                min={0}
                value={priceNewAdult}
                onChange={(e) => setPriceNewAdult(Number(e.target.value))}
                className="h-10 px-3 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm"
              />
              <span className="text-xs font-semibold text-[#606060]">
                Trẻ em
              </span>
              <input
                type="number"
                min={0}
                value={priceNewChild}
                onChange={(e) => setPriceNewChild(Number(e.target.value))}
                className="h-10 px-3 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm"
              />
              <span className="text-xs font-semibold text-[#606060]">
                Em bé
              </span>
              <input
                type="number"
                min={0}
                value={priceNewBaby}
                onChange={(e) => setPriceNewBaby(Number(e.target.value))}
                className="h-10 px-3 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-[#606060]">
              Còn lại (Số chỗ)
            </label>
            <div className="grid grid-cols-[90px_1fr] items-center gap-3">
              <span className="text-xs font-semibold text-[#606060]">
                Người lớn
              </span>
              <input
                type="number"
                min={0}
                value={stockAdult}
                onChange={(e) => setStockAdult(Number(e.target.value))}
                className="h-10 px-3 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm"
              />
              <span className="text-xs font-semibold text-[#606060]">
                Trẻ em
              </span>
              <input
                type="number"
                min={0}
                value={stockChild}
                onChange={(e) => setStockChild(Number(e.target.value))}
                className="h-10 px-3 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm"
              />
              <span className="text-xs font-semibold text-[#606060]">
                Em bé
              </span>
              <input
                type="number"
                min={0}
                value={stockBaby}
                onChange={(e) => setStockBaby(Number(e.target.value))}
                className="h-10 px-3 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-[#606060]">
              Những địa điểm có tour (Điểm khởi hành)
            </label>
            <div className="rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] p-4 grid grid-cols-2 gap-3">
              {LOCATION_OPTIONS.map((loc) => (
                <label
                  key={loc}
                  className="flex items-center gap-2 text-sm font-medium text-[#202224] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={locations.includes(loc)}
                    onChange={() => toggleLocation(loc)}
                    className="w-4 h-4 rounded accent-[#4880FF]"
                  />
                  <span>{loc}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Time, Vehicle, Departure Date */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-semibold text-[#606060] mb-2">
              Thời gian
            </label>
            <input
              type="text"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="Ví dụ: 6 Ngày 5 Đêm"
              className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#606060] mb-2">
              Phương tiện
            </label>
            <input
              type="text"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
              placeholder="Ví dụ: Ô tô 45 chỗ"
              className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#606060] mb-2">
              Ngày khởi hành
            </label>
            <input
              type="date"
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
              className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
            />
          </div>
        </div>

        {/* Thông tin tour */}
        <div>
          <label className="block text-sm font-semibold text-[#606060] mb-2">
            Thông tin tour
          </label>
          <textarea
            rows={5}
            value={information}
            onChange={(e) => setInformation(e.target.value)}
            placeholder="Nhập thông tin chi tiết về tour..."
            className="w-full p-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
          />
        </div>

        {/* Lịch trình tour repeater */}
        <div className="space-y-4">
          <label className="block text-sm font-semibold text-[#606060]">
            Lịch trình tour
          </label>
          <div className="space-y-4">
            {schedules.map((sch, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-[#D5D5D5] bg-[#F5F6FA] p-4 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={sch.title}
                    onChange={(e) =>
                      updateSchedule(idx, "title", e.target.value)
                    }
                    placeholder={
                      idx === 0
                        ? "Ví dụ: NGÀY 1 | TP.HCM – THỦ ĐÔ HÀ NỘI"
                        : `Ví dụ: NGÀY ${idx + 1} | Tiêu đề lịch trình...`
                    }
                    className="flex-1 h-10 px-3 rounded-lg border border-[#D5D5D5] bg-white text-sm font-semibold"
                  />
                  <button
                    type="button"
                    aria-label={`Xóa lịch trình ngày ${idx + 1}`}
                    onClick={() => removeSchedule(idx)}
                    className="h-10 w-10 rounded-lg bg-[#EF3826] text-white flex items-center justify-center hover:bg-red-700"
                    title="Xóa lịch trình"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={sch.description}
                  onChange={(e) =>
                    updateSchedule(idx, "description", e.target.value)
                  }
                  placeholder={`Nhập nội dung chi tiết cho ngày ${idx + 1}...`}
                  className="w-full p-3 rounded-lg border border-[#D5D5D5] bg-white text-sm"
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addScheduleItem}
            className="h-10 px-4 rounded-lg bg-[#4880FF] hover:bg-[#3a6ce0] text-white text-sm font-bold inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Thêm lịch trình
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 pt-3">
          <button
            type="submit"
            disabled={submitting}
            className="px-10 h-12 rounded-xl bg-[#4880FF] hover:bg-[#3a6ce0] text-white font-bold text-base transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "create" ? "Tạo tour" : "Cập nhật"}
          </button>

          <Link
            href="/admin/tours"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#4880FF] hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại danh sách
          </Link>
        </div>
      </form>

      {mode === "edit" && initialData?.id && (
        <TourDeparturesManager
          tourId={initialData.id}
          tourCode={initialData.code}
        />
      )}
    </div>
  );
}
