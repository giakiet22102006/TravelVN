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

const CART_STORAGE_KEY = "travelvn_cart_v1";

export interface CartItem {
  cartKey: string;
  tourId: string;
  slug: string;
  code: string;
  name: string;
  avatar: string | null;
  departureDate: string | null;
  departureLocation: string;
  priceNewAdult: number;
  priceNewChild: number;
  priceNewBaby: number;
  stockAdult: number;
  stockChild: number;
  stockBaby: number;
  quantityAdult: number;
  quantityChild: number;
  quantityBaby: number;
  checked: boolean;
  active?: boolean;
}

export interface CartValidatedTour {
  id: string;
  slug: string;
  name: string;
  avatar: string | null;
  priceNewAdult: number;
  priceNewChild: number;
  priceNewBaby: number;
  stockAdult: number;
  stockChild: number;
  stockBaby: number;
  active: boolean;
}

export interface CartRefreshResult {
  changed: boolean;
  notices: string[];
}

export type AddToCartPayload = Omit<CartItem, "cartKey" | "checked"> & {
  checked?: boolean;
};

interface CartContextValue {
  items: CartItem[];
  hydrated: boolean;
  addItem: (payload: AddToCartPayload) => boolean;
  updateQuantity: (
    cartKey: string,
    tier: "adult" | "child" | "baby",
    quantity: number
  ) => void;
  toggleCheck: (cartKey: string, checked?: boolean) => void;
  toggleAll: (checked: boolean) => void;
  removeItem: (cartKey: string) => void;
  clearCheckedItems: () => void;
  refreshCartFromServer: () => Promise<CartRefreshResult>;
  totalItemCount: number;
  checkedSubTotal: number;
}

const CartContext = createContext<CartContextValue | null>(null);

function clamp(val: number, min: number, max: number): number {
  if (Number.isNaN(val)) return min;
  return Math.max(min, Math.min(max, Math.floor(val)));
}

export function buildCartKey(tourId: string, departureLocation: string): string {
  return `${tourId}__${departureLocation.trim() || "Hà Nội"}`;
}

function reconcileCartItems(
  prev: CartItem[],
  tourMap: Map<string, CartValidatedTour>
): { items: CartItem[]; changed: boolean; notices: string[] } {
  const notices: string[] = [];
  const seenNoticeKeys = new Set<string>();
  let changed = false;

  // Track remaining live stock per tourId across multiple departure rows
  const remainingByTour = new Map<
    string,
    { adult: number; child: number; baby: number }
  >();

  const nextItems = prev.map((item) => {
    const live = tourMap.get(item.tourId);
    if (!live || !live.active) {
      if (item.active !== false || item.checked) {
        changed = true;
      }
      const key = `inactive:${item.tourId}`;
      if (!seenNoticeKeys.has(key)) {
        seenNoticeKeys.add(key);
        notices.push(
          `Tour "${item.name}" hiện đã ngừng nhận đặt hoặc tạm ẩn nên đã được bỏ chọn.`
        );
      }
      return {
        ...item,
        active: false,
        checked: false,
        stockAdult: 0,
        stockChild: 0,
        stockBaby: 0,
      };
    }

    let rem = remainingByTour.get(item.tourId);
    if (!rem) {
      rem = {
        adult: Math.max(0, live.stockAdult),
        child: Math.max(0, live.stockChild),
        baby: Math.max(0, live.stockBaby),
      };
      remainingByTour.set(item.tourId, rem);
    }

    const nextAdult = clamp(item.quantityAdult, 0, rem.adult);
    const nextChild = clamp(item.quantityChild, 0, rem.child);
    const nextBaby = clamp(item.quantityBaby, 0, rem.baby);
    rem.adult -= nextAdult;
    rem.child -= nextChild;
    rem.baby -= nextBaby;

    const priceChanged =
      live.priceNewAdult !== item.priceNewAdult ||
      live.priceNewChild !== item.priceNewChild ||
      live.priceNewBaby !== item.priceNewBaby;

    const qtyAdjusted =
      nextAdult !== item.quantityAdult ||
      nextChild !== item.quantityChild ||
      nextBaby !== item.quantityBaby;

    if (priceChanged) {
      changed = true;
      const key = `price:${item.tourId}`;
      if (!seenNoticeKeys.has(key)) {
        seenNoticeKeys.add(key);
        notices.push(
          `Giá tour "${live.name}" vừa được cập nhật theo bảng giá mới nhất.`
        );
      }
    }

    if (qtyAdjusted) {
      changed = true;
      const key = `stock:${item.tourId}`;
      if (!seenNoticeKeys.has(key)) {
        seenNoticeKeys.add(key);
        notices.push(
          `Số chỗ còn lại của tour "${live.name}" đã thay đổi, số lượng hành khách trong giỏ đã được tự động điều chỉnh.`
        );
      }
    }

    const metaChanged =
      live.slug !== item.slug ||
      live.name !== item.name ||
      (live.avatar ?? null) !== item.avatar ||
      live.stockAdult !== item.stockAdult ||
      live.stockChild !== item.stockChild ||
      live.stockBaby !== item.stockBaby ||
      item.active === false;

    if (metaChanged) {
      changed = true;
    }

    const hasPassengers = nextAdult + nextChild + nextBaby > 0;

    return {
      ...item,
      slug: live.slug,
      name: live.name,
      avatar: live.avatar ?? item.avatar,
      priceNewAdult: live.priceNewAdult,
      priceNewChild: live.priceNewChild,
      priceNewBaby: live.priceNewBaby,
      stockAdult: live.stockAdult,
      stockChild: live.stockChild,
      stockBaby: live.stockBaby,
      quantityAdult: nextAdult,
      quantityChild: nextChild,
      quantityBaby: nextBaby,
      active: true,
      checked: hasPassengers ? item.checked : false,
    };
  });

  return { items: nextItems, changed, notices };
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const itemsRef = useRef<CartItem[]>(items);
  itemsRef.current = items;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }
    } catch {
      // Ignore corrupt storage data and start fresh
    } finally {
      setHydrated(true);
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key !== CART_STORAGE_KEY) return;
      try {
        setItems(e.newValue ? JSON.parse(e.newValue) : []);
      } catch {
        setItems([]);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Only persist after initial client hydration to avoid overwriting stored items with []
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore quota exceeded errors
    }
  }, [items, hydrated]);

  const addItem = useCallback((payload: AddToCartPayload): boolean => {
    const cartKey = buildCartKey(payload.tourId, payload.departureLocation);
    const snapshot = itemsRef.current;
    const snapExisting = snapshot.findIndex((i) => i.cartKey === cartKey);
    const snapOtherUsed = snapshot.reduce(
      (acc, item, idx) => {
        if (item.tourId !== payload.tourId || idx === snapExisting) return acc;
        return {
          adult: acc.adult + item.quantityAdult,
          child: acc.child + item.quantityChild,
          baby: acc.baby + item.quantityBaby,
        };
      },
      { adult: 0, child: 0, baby: 0 }
    );
    const snapCapAdult = Math.max(0, payload.stockAdult - snapOtherUsed.adult);
    const snapCapChild = Math.max(0, payload.stockChild - snapOtherUsed.child);
    const snapCapBaby = Math.max(0, payload.stockBaby - snapOtherUsed.baby);

    if (snapExisting === -1) {
      const addA = clamp(payload.quantityAdult, 0, snapCapAdult);
      const addC = clamp(payload.quantityChild, 0, snapCapChild);
      const addB = clamp(payload.quantityBaby, 0, snapCapBaby);
      if (addA + addC + addB <= 0) {
        return false;
      }
    } else if (snapCapAdult + snapCapChild + snapCapBaby <= 0) {
      return false;
    }

    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.cartKey === cartKey);
      const otherUsed = prev.reduce(
        (acc, item, idx) => {
          if (item.tourId !== payload.tourId || idx === existingIndex) return acc;
          return {
            adult: acc.adult + item.quantityAdult,
            child: acc.child + item.quantityChild,
            baby: acc.baby + item.quantityBaby,
          };
        },
        { adult: 0, child: 0, baby: 0 }
      );
      const capAdult = Math.max(0, payload.stockAdult - otherUsed.adult);
      const capChild = Math.max(0, payload.stockChild - otherUsed.child);
      const capBaby = Math.max(0, payload.stockBaby - otherUsed.baby);

      if (existingIndex === -1) {
        const nextAdult = clamp(payload.quantityAdult, 0, capAdult);
        const nextChild = clamp(payload.quantityChild, 0, capChild);
        const nextBaby = clamp(payload.quantityBaby, 0, capBaby);
        if (nextAdult + nextChild + nextBaby <= 0) {
          return prev;
        }
        const nextItem: CartItem = {
          ...payload,
          cartKey,
          quantityAdult: nextAdult,
          quantityChild: nextChild,
          quantityBaby: nextBaby,
          checked: payload.checked ?? true,
          active: true,
        };
        return [nextItem, ...prev];
      }

      return prev.map((item, idx) => {
        if (idx !== existingIndex) return item;
        const nextAdult = clamp(
          item.quantityAdult + payload.quantityAdult,
          0,
          capAdult
        );
        const nextChild = clamp(
          item.quantityChild + payload.quantityChild,
          0,
          capChild
        );
        const nextBaby = clamp(
          item.quantityBaby + payload.quantityBaby,
          0,
          capBaby
        );
        return {
          ...item,
          stockAdult: payload.stockAdult,
          stockChild: payload.stockChild,
          stockBaby: payload.stockBaby,
          priceNewAdult: payload.priceNewAdult,
          priceNewChild: payload.priceNewChild,
          priceNewBaby: payload.priceNewBaby,
          quantityAdult: nextAdult,
          quantityChild: nextChild,
          quantityBaby: nextBaby,
          checked: nextAdult + nextChild + nextBaby > 0,
          active: true,
        };
      });
    });

    return true;
  }, []);

  const updateQuantity = useCallback(
    (cartKey: string, tier: "adult" | "child" | "baby", quantity: number) => {
      setItems((prev) => {
        const target = prev.find((i) => i.cartKey === cartKey);
        if (!target || target.active === false) return prev;
        const otherUsed = prev.reduce((sum, item) => {
          if (item.cartKey === cartKey || item.tourId !== target.tourId) {
            return sum;
          }
          if (tier === "adult") return sum + item.quantityAdult;
          if (tier === "child") return sum + item.quantityChild;
          return sum + item.quantityBaby;
        }, 0);

        return prev.map((item) => {
          if (item.cartKey !== cartKey) return item;
          if (tier === "adult") {
            const maxAdult = Math.max(0, item.stockAdult - otherUsed);
            const minAdult = maxAdult > 0 ? 1 : 0;
            return { ...item, quantityAdult: clamp(quantity, minAdult, maxAdult) };
          }
          if (tier === "child") {
            const maxChild = Math.max(0, item.stockChild - otherUsed);
            const minChild =
              item.quantityAdult === 0 && item.quantityBaby === 0 && maxChild > 0
                ? 1
                : 0;
            return { ...item, quantityChild: clamp(quantity, minChild, maxChild) };
          }
          const maxBaby = Math.max(0, item.stockBaby - otherUsed);
          const minBaby =
            item.quantityAdult === 0 && item.quantityChild === 0 && maxBaby > 0
              ? 1
              : 0;
          return { ...item, quantityBaby: clamp(quantity, minBaby, maxBaby) };
        });
      });
    },
    []
  );

  const toggleCheck = useCallback((cartKey: string, checked?: boolean) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.cartKey !== cartKey) return item;
        if (item.active === false) return { ...item, checked: false };
        return { ...item, checked: checked ?? !item.checked };
      })
    );
  }, []);

  const toggleAll = useCallback((checked: boolean) => {
    setItems((prev) =>
      prev.map((item) =>
        item.active === false ? { ...item, checked: false } : { ...item, checked }
      )
    );
  }, []);

  const removeItem = useCallback((cartKey: string) => {
    setItems((prev) => prev.filter((item) => item.cartKey !== cartKey));
  }, []);

  const clearCheckedItems = useCallback(() => {
    setItems((prev) => prev.filter((item) => !item.checked));
  }, []);

  const refreshCartFromServer = useCallback(async (): Promise<CartRefreshResult> => {
    const currentItems = itemsRef.current;
    if (currentItems.length === 0) {
      return { changed: false, notices: [] };
    }
    const tourIds = Array.from(new Set(currentItems.map((i) => i.tourId)));
    try {
      const res = await fetch("/api/client/cart/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tourIds }),
      });
      if (!res.ok) {
        return { changed: false, notices: [] };
      }
      const data = await res.json();
      if (!Array.isArray(data?.tours)) {
        return { changed: false, notices: [] };
      }
      const tourMap = new Map<string, CartValidatedTour>();
      for (const t of data.tours as CartValidatedTour[]) {
        if (t && typeof t.id === "string") {
          tourMap.set(t.id, t);
        }
      }
      const summary = reconcileCartItems(itemsRef.current, tourMap);
      setItems((prev) => reconcileCartItems(prev, tourMap).items);
      return { changed: summary.changed, notices: summary.notices };
    } catch {
      return { changed: false, notices: [] };
    }
  }, []);

  const totalItemCount = useMemo(() => items.length, [items]);

  const checkedSubTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      if (!item.checked || item.active === false) return sum;
      return (
        sum +
        item.quantityAdult * item.priceNewAdult +
        item.quantityChild * item.priceNewChild +
        item.quantityBaby * item.priceNewBaby
      );
    }, 0);
  }, [items]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      hydrated,
      addItem,
      updateQuantity,
      toggleCheck,
      toggleAll,
      removeItem,
      clearCheckedItems,
      refreshCartFromServer,
      totalItemCount,
      checkedSubTotal,
    }),
    [
      items,
      hydrated,
      addItem,
      updateQuantity,
      toggleCheck,
      toggleAll,
      removeItem,
      clearCheckedItems,
      refreshCartFromServer,
      totalItemCount,
      checkedSubTotal,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}
