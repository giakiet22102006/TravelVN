"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useClientMeta } from "./ClientLayoutShell";
import type { TourCardData } from "./TourCard";

const WISHLIST_STORAGE_KEY = "travelvn_wishlist_v1";

interface WishlistContextValue {
  tourIds: string[];
  tours: TourCardData[];
  loading: boolean;
  hydrated: boolean;
  count: number;
  isWishlisted: (tourId: string) => boolean;
  toggleWishlist: (tourOrId: TourCardData | string) => Promise<boolean>;
  removeFromWishlist: (tourId: string) => Promise<void>;
  refreshWishlist: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

function readGuestWishlistIds(): string[] {
  try {
    const raw = window.localStorage.getItem(WISHLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(
        parsed.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      )
    ).slice(0, 50);
  } catch {
    return [];
  }
}

function writeGuestWishlistIds(ids: string[]) {
  try {
    window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(ids.slice(0, 50)));
  } catch {
    // Ignore quota errors
  }
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useClientMeta();
  const [tourIds, setTourIds] = useState<string[]>([]);
  const [tours, setTours] = useState<TourCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const prevUserIdRef = useRef<string | null>(null);

  const refreshWishlist = useCallback(async () => {
    if (!currentUser) {
      const guestIds = readGuestWishlistIds();
      setTourIds(guestIds);
      if (guestIds.length === 0) {
        setTours([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(
          `/api/client/tours/suggest?ids=${encodeURIComponent(guestIds.join(","))}`
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.tours)) {
            setTours(data.tours);
          }
        }
      } catch {
        // Ignore transient network failures
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const guestIds = readGuestWishlistIds();
      if (guestIds.length > 0) {
        const mergeRes = await fetch("/api/client/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mergeTourIds: guestIds }),
        });
        if (mergeRes.ok) {
          const data = await mergeRes.json();
          window.localStorage.removeItem(WISHLIST_STORAGE_KEY);
          setTourIds(Array.isArray(data.tourIds) ? data.tourIds : []);
          setTours(Array.isArray(data.tours) ? data.tours : []);
          return;
        }
      }

      const res = await fetch("/api/client/wishlist");
      if (res.ok) {
        const data = await res.json();
        setTourIds(Array.isArray(data.tourIds) ? data.tourIds : []);
        setTours(Array.isArray(data.tours) ? data.tours : []);
      }
    } catch {
      // Ignore transient network issues
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    const nextUserId = currentUser?.id ?? null;
    if (!hydrated || prevUserIdRef.current !== nextUserId) {
      prevUserIdRef.current = nextUserId;
      void refreshWishlist().finally(() => setHydrated(true));
    }
  }, [currentUser?.id, hydrated, refreshWishlist]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== WISHLIST_STORAGE_KEY || currentUser) return;
      setTourIds(readGuestWishlistIds());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [currentUser]);

  const isWishlisted = useCallback(
    (tourId: string) => tourIds.includes(tourId),
    [tourIds]
  );

  const toggleWishlist = useCallback(
    async (tourOrId: TourCardData | string): Promise<boolean> => {
      const tourId = typeof tourOrId === "string" ? tourOrId : tourOrId.id;
      const tourObj = typeof tourOrId === "string" ? null : tourOrId;
      const currentlyIn = tourIds.includes(tourId);
      const nextWishlisted = !currentlyIn;

      // Optimistic update
      setTourIds((prev) =>
        nextWishlisted
          ? [tourId, ...prev.filter((id) => id !== tourId)]
          : prev.filter((id) => id !== tourId)
      );
      if (nextWishlisted && tourObj) {
        setTours((prev) => [tourObj, ...prev.filter((t) => t.id !== tourId)]);
      } else if (!nextWishlisted) {
        setTours((prev) => prev.filter((t) => t.id !== tourId));
      }

      if (!currentUser) {
        const existing = readGuestWishlistIds();
        const updated = nextWishlisted
          ? [tourId, ...existing.filter((id) => id !== tourId)]
          : existing.filter((id) => id !== tourId);
        writeGuestWishlistIds(updated);
        return nextWishlisted;
      }

      try {
        const res = await fetch("/api/client/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tourId }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.tourIds)) setTourIds(data.tourIds);
          if (Array.isArray(data.tours)) setTours(data.tours);
          return data.action === "added";
        }
      } catch {
        // Revert on failure
        await refreshWishlist();
      }
      return nextWishlisted;
    },
    [currentUser, refreshWishlist, tourIds]
  );

  const removeFromWishlist = useCallback(
    async (tourId: string) => {
      setTourIds((prev) => prev.filter((id) => id !== tourId));
      setTours((prev) => prev.filter((t) => t.id !== tourId));

      if (!currentUser) {
        const existing = readGuestWishlistIds();
        writeGuestWishlistIds(existing.filter((id) => id !== tourId));
        return;
      }

      try {
        const res = await fetch(
          `/api/client/wishlist?tourId=${encodeURIComponent(tourId)}`,
          { method: "DELETE" }
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.tourIds)) setTourIds(data.tourIds);
          if (Array.isArray(data.tours)) setTours(data.tours);
        }
      } catch {
        await refreshWishlist();
      }
    },
    [currentUser, refreshWishlist]
  );

  const value = useMemo<WishlistContextValue>(
    () => ({
      tourIds,
      tours,
      loading,
      hydrated,
      count: tourIds.length,
      isWishlisted,
      toggleWishlist,
      removeFromWishlist,
      refreshWishlist,
    }),
    [
      tourIds,
      tours,
      loading,
      hydrated,
      isWishlisted,
      toggleWishlist,
      removeFromWishlist,
      refreshWishlist,
    ]
  );

  return (
    <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return ctx;
}
