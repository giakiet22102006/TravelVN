"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ImageUploadBox } from "./ImageUploadBox";

interface CategoryOption {
  id: string;
  name: string;
  parentId: string | null;
}

interface CategoryFormData {
  id?: string;
  name: string;
  parentId: string;
  position: number;
  status: "ACTIVE" | "INACTIVE";
  avatar: string;
  description: string;
}

interface CategoryFormProps {
  mode: "create" | "edit";
  initialData?: CategoryFormData;
}

function buildIndentedOptions(
  categories: CategoryOption[],
  parentId: string | null = null,
  prefix = "",
  excludeId?: string
): Array<{ id: string; label: string }> {
  const result: Array<{ id: string; label: string }> = [];
  for (const cat of categories) {
    if (cat.id === excludeId) continue;
    if ((cat.parentId || null) === parentId) {
      result.push({ id: cat.id, label: `${prefix}${cat.name}` });
      result.push(
        ...buildIndentedOptions(
          categories,
          cat.id,
          `${prefix}-- `,
          excludeId
        )
      );
    }
  }
  return result;
}

export function CategoryForm({ mode, initialData }: CategoryFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialData?.name || "");
  const [parentId, setParentId] = useState(initialData?.parentId || "");
  const [position, setPosition] = useState<number>(initialData?.position || 1);
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">(
    initialData?.status || "ACTIVE"
  );
  const [avatar, setAvatar] = useState(initialData?.avatar || "");
  const [description, setDescription] = useState(
    initialData?.description || ""
  );
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/categories?all=true")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.message || "Không thể tải danh sách danh mục");
        }
        return data;
      })
      .then((data) => {
        if (active && Array.isArray(data.items)) {
          setCategories(data.items);
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

  const parentOptions = buildIndentedOptions(
    categories,
    null,
    "",
    initialData?.id
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const endpoint =
        mode === "create"
          ? "/api/admin/categories"
          : `/api/admin/categories/${initialData?.id}`;
      const method = mode === "create" ? "POST" : "PUT";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          parentId: parentId || null,
          position,
          status,
          avatar: avatar || null,
          description: description || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Có lỗi xảy ra");
        return;
      }
      router.push("/admin/categories");
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
          {mode === "create" ? "Tạo danh mục" : "Chỉnh sửa danh mục"}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-[#606060] mb-2">
              Tên danh mục <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Tour Miền Bắc"
              className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#606060] mb-2">
              Danh mục cha
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
            >
              <option value="">-- Chọn danh mục --</option>
              {parentOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
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

        <ImageUploadBox
          label="Ảnh đại diện"
          value={avatar}
          onChange={setAvatar}
        />

        <div>
          <label className="block text-sm font-semibold text-[#606060] mb-2">
            Mô tả
          </label>
          <textarea
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Nhập mô tả chi tiết cho danh mục..."
            className="w-full p-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
          />
        </div>

        <div className="flex flex-col items-center gap-4 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="px-10 h-12 rounded-xl bg-[#4880FF] hover:bg-[#3a6ce0] text-white font-bold text-base transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "create" ? "Tạo danh mục" : "Cập nhật"}
          </button>

          <Link
            href="/admin/categories"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#4880FF] hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại danh sách
          </Link>
        </div>
      </form>
    </div>
  );
}
