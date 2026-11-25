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
  departureId?: string | null;
  departureCode?: string | null;
  airline?: string | null;
  flightOut?: string | null;
  flightBack?: string | null;
  departureDate: string | null;
  departureLocation: string;
  priceNewAdult: number;
  priceNewChild: number;
  priceNewBaby: number;
  singleRoomCount?: number;
  singleRoomSurcharge?: number;
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
  singleRoomSurcharge?: number;
  stockAdult: number;
  stockChild: number;
  stockBaby: number;
  active: boolean;
}

export interface CartValidatedDeparture {
  id: string;
  tourId: string;
  code: string;
  slug: string;
  name: string;
  avatar: string | null;
  departureDate: string | null;
  departureLocation: string;
  airline: string | null;
  flightOut: string | null;
  flightBack: string | null;
  priceNewAdult: number;
  priceNewChild: number;
  priceNewBaby: number;
  singleRoomSurcharge: number;
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
  updateSingleRoomCount: (cartKey: string, count: number) => void;
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

export function buildCartKey(
  tourId: string,
  departureLocation: string,
  departureId?: string | null
): string {
  return departureId
    ? `${tourId}__dep:${departureId}`
    : `${tourId}__${departureLocation.trim() || "Hà Nội"}`;
}

function getStockBucketKey(item: {
  tourId: string;
  departureId?: string | null;
}): string {
  return item.departureId ? `dep:${item.departureId}` : `tour:${item.tourId}`;
}

function reconcileCartItems(
  prev: CartItem[],
  tourMap: Map<string, CartValidatedTour>,
  departureMap: Map<string, CartValidatedDeparture>
): { items: CartItem[]; changed: boolean; notices: string[] } {
  const notices: string[] = [];
  const seenNoticeKeys = new Set<string>();
  let changed = false;

  const remainingByBucket = new Map<
    string,
    { adult: number; child: number; baby: number }
  >();

  const nextItems = prev.map((item) => {
    const depLive = item.departureId
      ? departureMap.get(item.departureId)
      : undefined;
    const tourLive = tourMap.get(item.tourId);

    const live = depLive ?? (item.departureId ? undefined : tourLive);

    if (!live || !live.active) {
      if (item.active !== false || item.checked) {
        changed = true;
      }
      const key = `inactive:${getStockBucketKey(item)}`;
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

    const bucketKey = getStockBucketKey(item);
    let rem = remainingByBucket.get(bucketKey);
    if (!rem) {
      rem = {
        adult: Math.max(0, live.stockAdult),
        child: Math.max(0, live.stockChild),
        baby: Math.max(0, live.stockBaby),
      };
      remainingByBucket.set(bucketKey, rem);
    }

    const nextAdult = clamp(item.quantityAdult, 0, rem.adult);
    const nextChild = clamp(item.quantityChild, 0, rem.child);
    const nextBaby = clamp(item.quantityBaby, 0, rem.baby);
    rem.adult -= nextAdult;
    rem.child -= nextChild;
    rem.baby -= nextBaby;

    const liveSurcharge = live.singleRoomSurcharge ?? item.singleRoomSurcharge ?? 0;
    const nextSingleRoom = clamp(item.singleRoomCount ?? 0, 0, nextAdult);

    const priceChanged =
      live.priceNewAdult !== item.priceNewAdult ||
      live.priceNewChild !== item.priceNewChild ||
      live.priceNewBaby !== item.priceNewBaby ||
      liveSurcharge !== (item.singleRoomSurcharge ?? 0);

    const qtyAdjusted =
      nextAdult !== item.quantityAdult ||
      nextChild !== item.quantityChild ||
      nextBaby !== item.quantityBaby ||
      nextSingleRoom !== (item.singleRoomCount ?? 0);

    if (priceChanged) {
      changed = true;
      const key = `price:${bucketKey}`;
      if (!seenNoticeKeys.has(key)) {
        seenNoticeKeys.add(key);
        notices.push(
          `Giá tour "${live.name}" vừa được cập nhật theo bảng giá mới nhất.`
        );
      }
    }

    if (qtyAdjusted) {
      changed = true;
      const key = `stock:${bucketKey}`;
      if (!seenNoticeKeys.has(key)) {
        seenNoticeKeys.add(key);
        notices.push(
          `Số chỗ còn lại của tour "${live.name}" đã thay đổi, số lượng hành khách trong giỏ đã được tự động điều chỉnh.`
        );
      }
    }

    const nextDepartureCode = depLive ? depLive.code : item.departureCode ?? null;
    const nextAirline = depLive ? depLive.airline : item.airline ?? null;
    const nextFlightOut = depLive ? depLive.flightOut : item.flightOut ?? null;
    const nextFlightBack = depLive ? depLive.flightBack : item.flightBack ?? null;
    const nextDepartureDate = depLive ? depLive.departureDate : item.departureDate;
    const nextDepartureLocation = depLive
      ? depLive.departureLocation
      : item.departureLocation;

    const metaChanged =
      live.slug !== item.slug ||
      live.name !== item.name ||
      (live.avatar ?? null) !== item.avatar ||
      live.stockAdult !== item.stockAdult ||
      live.stockChild !== item.stockChild ||
      live.stockBaby !== item.stockBaby ||
      nextDepartureCode !== (item.departureCode ?? null) ||
      nextAirline !== (item.airline ?? null) ||
      nextFlightOut !== (item.flightOut ?? null) ||
      nextFlightBack !== (item.flightBack ?? null) ||
      nextDepartureDate !== item.departureDate ||
      nextDepartureLocation !== item.departureLocation ||
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
      departureCode: nextDepartureCode,
      airline: nextAirline,
      flightOut: nextFlightOut,
      flightBack: nextFlightBack,
      departureDate: nextDepartureDate,
      departureLocation: nextDepartureLocation,
      priceNewAdult: live.priceNewAdult,
      priceNewChild: live.priceNewChild,
      priceNewBaby: live.priceNewBaby,
      singleRoomCount: nextSingleRoom,
      singleRoomSurcharge: liveSurcharge,
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
    const cartKey = buildCartKey(
      payload.tourId,
      payload.departureLocation,
      payload.departureId
    );
    const targetBucket = getStockBucketKey(payload);
    const snapshot = itemsRef.current;
    const snapExisting = snapshot.findIndex((i) => i.cartKey === cartKey);
    const snapOtherUsed = snapshot.reduce(
      (acc, item, idx) => {
        if (getStockBucketKey(item) !== targetBucket || idx === snapExisting) {
          return acc;
        }
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
          if (getStockBucketKey(item) !== targetBucket || idx === existingIndex) {
            return acc;
          }
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
          singleRoomCount: clamp(payload.singleRoomCount ?? 0, 0, nextAdult),
          singleRoomSurcharge: payload.singleRoomSurcharge ?? 0,
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
        const nextSingle = clamp(
          (item.singleRoomCount ?? 0) + (payload.singleRoomCount ?? 0),
          0,
          nextAdult
        );
        return {
          ...item,
          departureId: payload.departureId ?? item.departureId,
          departureCode: payload.departureCode ?? item.departureCode,
          airline: payload.airline ?? item.airline,
          flightOut: payload.flightOut ?? item.flightOut,
          flightBack: payload.flightBack ?? item.flightBack,
          singleRoomSurcharge:
            payload.singleRoomSurcharge ?? item.singleRoomSurcharge ?? 0,
          singleRoomCount: nextSingle,
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
        const targetBucket = getStockBucketKey(target);
        const otherUsed = prev.reduce((sum, item) => {
          if (item.cartKey === cartKey || getStockBucketKey(item) !== targetBucket) {
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
            const nextAdult = clamp(quantity, minAdult, maxAdult);
            return {
              ...item,
              quantityAdult: nextAdult,
              singleRoomCount: clamp(item.singleRoomCount ?? 0, 0, nextAdult),
            };
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

  const updateSingleRoomCount = useCallback((cartKey: string, count: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.cartKey !== cartKey || item.active === false) return item;
        return {
          ...item,
          singleRoomCount: clamp(count, 0, item.quantityAdult),
        };
      })
    );
  }, []);

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
    const departureIds = Array.from(
      new Set(
        currentItems
          .map((i) => i.departureId)
          .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      )
    );

    try {
      const res = await fetch("/api/client/cart/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tourIds, departureIds }),
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
      const departureMap = new Map<string, CartValidatedDeparture>();
      if (Array.isArray(data?.departures)) {
        for (const d of data.departures as CartValidatedDeparture[]) {
          if (d && typeof d.id === "string") {
            departureMap.set(d.id, d);
          }
        }
      }
      const summary = reconcileCartItems(itemsRef.current, tourMap, departureMap);
      setItems((prev) => reconcileCartItems(prev, tourMap, departureMap).items);
      return { changed: summary.changed, notices: summary.notices };
    } catch {
      return { changed: false, notices: [] };
    }
  }, []);

  const totalItemCount = useMemo(() => items.length, [items]);

  const checkedSubTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      if (!item.checked || item.active === false) return sum;
      const singleSurchargeTotal =
        (item.singleRoomCount || 0) * (item.singleRoomSurcharge || 0);
      return (
        sum +
        item.quantityAdult * item.priceNewAdult +
        item.quantityChild * item.priceNewChild +
        item.quantityBaby * item.priceNewBaby +
        singleSurchargeTotal
      );
    }, 0);
  }, [items]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      hydrated,
      addItem,
      updateQuantity,
      updateSingleRoomCount,
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
      updateSingleRoomCount,
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
