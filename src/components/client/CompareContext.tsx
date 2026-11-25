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
import type { TourCardData } from "./TourCard";

const COMPARE_STORAGE_KEY = "travelvn_compare_v1";
export const MAX_COMPARE_ITEMS = 3;

export interface CompareContextValue {
  items: TourCardData[];
  addTour: (tour: TourCardData) => boolean;
  removeTour: (tourId: string) => void;
  toggleTour: (tour: TourCardData) => void;
  isInCompare: (tourId: string) => boolean;
  clearAll: () => void;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
}

const CompareContext = createContext<CompareContextValue | null>(null);

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<TourCardData[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const itemsRef = useRef<TourCardData[]>(items);
  itemsRef.current = items;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COMPARE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setItems(
            parsed
              .filter(
                (t): t is TourCardData =>
                  Boolean(t) && typeof t.id === "string" && typeof t.slug === "string"
              )
              .slice(0, MAX_COMPARE_ITEMS)
          );
        }
      }
    } catch {
      // Ignore corrupt storage
    } finally {
      setHydrated(true);
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key !== COMPARE_STORAGE_KEY) return;
      try {
        const parsed = e.newValue ? JSON.parse(e.newValue) : [];
        if (Array.isArray(parsed)) {
          setItems(parsed.slice(0, MAX_COMPARE_ITEMS));
        }
      } catch {
        setItems([]);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore quota exceeded errors
    }
  }, [items, hydrated]);

  const addTour = useCallback((tour: TourCardData): boolean => {
    const current = itemsRef.current;
    if (current.some((t) => t.id === tour.id)) {
      return true;
    }
    if (current.length >= MAX_COMPARE_ITEMS) {
      return false;
    }
    setItems((prev) => {
      if (prev.some((t) => t.id === tour.id) || prev.length >= MAX_COMPARE_ITEMS) {
        return prev;
      }
      return [...prev, tour];
    });
    return true;
  }, []);

  const removeTour = useCallback((tourId: string) => {
    setItems((prev) => {
      const next = prev.filter((t) => t.id !== tourId);
      if (next.length === 0) {
        setDrawerOpen(false);
      }
      return next;
    });
  }, []);

  const toggleTour = useCallback((tour: TourCardData) => {
    setItems((prev) => {
      const exists = prev.some((t) => t.id === tour.id);
      if (exists) {
        const next = prev.filter((t) => t.id !== tour.id);
        if (next.length === 0) {
          setDrawerOpen(false);
        }
        return next;
      }
      if (prev.length >= MAX_COMPARE_ITEMS) {
        // Replace oldest slot if already full so user action always has feedback
        return [...prev.slice(1), tour];
      }
      return [...prev, tour];
    });
  }, []);

  const isInCompare = useCallback(
    (tourId: string) => items.some((t) => t.id === tourId),
    [items]
  );

  const clearAll = useCallback(() => {
    setItems([]);
    setDrawerOpen(false);
  }, []);

  const value = useMemo<CompareContextValue>(
    () => ({
      items,
      addTour,
      removeTour,
      toggleTour,
      isInCompare,
      clearAll,
      drawerOpen,
      setDrawerOpen,
    }),
    [items, addTour, removeTour, toggleTour, isInCompare, clearAll, drawerOpen]
  );

  return (
    <CompareContext.Provider value={value}>{children}</CompareContext.Provider>
  );
}

export function useCompare(): CompareContextValue {
  const ctx = useContext(CompareContext);
  if (!ctx) {
    throw new Error("useCompare must be used within a CompareProvider");
  }
  return ctx;
}
