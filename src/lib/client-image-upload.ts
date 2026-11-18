"use client";

const MAX_DIMENSION_PX = 2048;
const OPTIMIZE_THRESHOLD_BYTES = 1.5 * 1024 * 1024;

/**
 * Optimizes large uploaded raster photos on the client before transmission so
 * Retina 2K crispness (up to 2048px, WebP quality 0.92) is preserved without blurry
 * server downscaling or oversized serverless payloads.
 */
export async function prepareCrispUploadFile(file: File): Promise<File> {
  if (
    typeof window === "undefined" ||
    file.type === "image/svg+xml" ||
    file.type === "image/gif" ||
    file.size <= OPTIMIZE_THRESHOLD_BYTES
  ) {
    return file;
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();

    img.onload = () => {
      try {
        const scale = Math.min(
          1,
          MAX_DIMENSION_PX / Math.max(img.naturalWidth || 1, img.naturalHeight || 1)
        );
        const targetWidth = Math.max(1, Math.round(img.naturalWidth * scale));
        const targetHeight = Math.max(1, Math.round(img.naturalHeight * scale));

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve(file);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (!blob || blob.size >= file.size) {
              resolve(file);
              return;
            }
            const cleanBase = file.name.replace(/\.[^.]+$/, "");
            resolve(
              new File([blob], `${cleanBase}.webp`, { type: "image/webp" })
            );
          },
          "image/webp",
          0.92
        );
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

export async function uploadImageFile(
  rawFile: File
): Promise<{ ok: boolean; url?: string; message?: string }> {
  const prepared = await prepareCrispUploadFile(rawFile);
  const formData = new FormData();
  formData.append("file", prepared);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) {
    return { ok: false, message: data.message || "Tải ảnh thất bại" };
  }
  return { ok: true, url: data.url };
}
