export const DEFAULT_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1000&q=82";

/**
 * Enhances external CDN image URLs (Unsplash & Cloudinary) so seeded or Admin-pasted URLs
 * load crisp high-DPI WebP/AVIF imagery straight from regional CDN edges without heavy payloads.
 */
export function enhanceImageUrl(
  url: string | null | undefined,
  targetWidth = 1000,
  quality = 82
): string {
  const trimmed = typeof url === "string" ? url.trim() : "";
  if (!trimmed) return DEFAULT_FALLBACK_IMAGE;
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return trimmed;
  }

  try {
    if (trimmed.startsWith("/")) {
      return trimmed;
    }

    const parsed = new URL(trimmed);

    if (parsed.hostname === "images.unsplash.com") {
      parsed.searchParams.set("auto", "format");
      parsed.searchParams.set("fit", "crop");
      parsed.searchParams.set("w", String(targetWidth));
      parsed.searchParams.set("q", String(quality));
      return parsed.toString();
    }

    if (parsed.hostname === "res.cloudinary.com") {
      const marker = "/upload/";
      const idx = parsed.pathname.indexOf(marker);
      if (idx !== -1) {
        const afterUpload = parsed.pathname.slice(idx + marker.length);
        // Only inject default quality/format flags when no transformation segment exists yet
        const firstSeg = afterUpload.split("/")[0] || "";
        const hasTransforms =
          firstSeg.includes(",") ||
          /^(w_|h_|q_|f_|c_|dpr_)/.test(firstSeg);
        if (!hasTransforms) {
          parsed.pathname =
            parsed.pathname.slice(0, idx + marker.length) +
            `f_auto,q_auto:good,w_${targetWidth}/` +
            afterUpload;
          return parsed.toString();
        }
      }
    }

    return parsed.toString();
  } catch {
    return trimmed;
  }
}

/**
 * External image CDNs (Unsplash, Cloudinary) already perform regional WebP/AVIF resizing at the edge.
 * Restrict `/_next/image` proxying to local same-origin files (`/uploads/...`) to avoid double-hops.
 */
export function isNextImageOptimizable(url: string): boolean {
  if (!url) return false;
  return url.startsWith("/") && !url.startsWith("//");
}
