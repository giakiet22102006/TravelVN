import { revalidateTag } from "next/cache";

export const CACHE_TAGS = {
  clientShell: "client-shell",
  clientTours: "client-tours",
} as const;

export function revalidateClientShellCache() {
  revalidateTag(CACHE_TAGS.clientShell);
}

export function revalidateClientToursCache() {
  revalidateTag(CACHE_TAGS.clientTours);
}

export function revalidateAllClientCatalogCache() {
  revalidateTag(CACHE_TAGS.clientShell);
  revalidateTag(CACHE_TAGS.clientTours);
}
