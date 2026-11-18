import { revalidateTag } from "next/cache";

export const CACHE_TAGS = {
  clientShell: "client-shell",
  clientTours: "client-tours",
  clientNews: "client-news",
} as const;

export function revalidateClientShellCache() {
  revalidateTag(CACHE_TAGS.clientShell);
}

export function revalidateClientToursCache() {
  revalidateTag(CACHE_TAGS.clientTours);
}

export function revalidateClientNewsCache() {
  revalidateTag(CACHE_TAGS.clientNews);
}

export function revalidateAllClientCatalogCache() {
  revalidateTag(CACHE_TAGS.clientShell);
  revalidateTag(CACHE_TAGS.clientTours);
  revalidateTag(CACHE_TAGS.clientNews);
}
