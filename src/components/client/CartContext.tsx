"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
}

export type AddToCartPayload = Omit<CartItem, "cartKey" | "checked"> & {
  checked?: boolean;
};

interface CartContextValue {
  items: CartItem[];
  hydrated: boolean;
  addItem: (payload: AddToCartPayload) => void;
  updateQuantity: (
    cartKey: string,
    tier: "adult" | "child" | "baby",
    quantity: number
  ) => void;
  toggleCheck: (cartKey: string, checked?: boolean) => void;
  toggleAll: (checked: boolean) => void;
  removeItem: (cartKey: string) => void;
  clearCheckedItems: () => void;
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

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

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

  const addItem = useCallback((payload: AddToCartPayload) => {
    const cartKey = buildCartKey(payload.tourId, payload.departureLocation);
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
        const nextItem: CartItem = {
          ...payload,
          cartKey,
          quantityAdult: clamp(payload.quantityAdult, 0, capAdult),
          quantityChild: clamp(payload.quantityChild, 0, capChild),
          quantityBaby: clamp(payload.quantityBaby, 0, capBaby),
          checked: payload.checked ?? true,
        };
        return [nextItem, ...prev];
      }

      return prev.map((item, idx) => {
        if (idx !== existingIndex) return item;
        return {
          ...item,
          stockAdult: payload.stockAdult,
          stockChild: payload.stockChild,
          stockBaby: payload.stockBaby,
          priceNewAdult: payload.priceNewAdult,
          priceNewChild: payload.priceNewChild,
          priceNewBaby: payload.priceNewBaby,
          quantityAdult: clamp(
            item.quantityAdult + payload.quantityAdult,
            0,
            capAdult
          ),
          quantityChild: clamp(
            item.quantityChild + payload.quantityChild,
            0,
            capChild
          ),
          quantityBaby: clamp(
            item.quantityBaby + payload.quantityBaby,
            0,
            capBaby
          ),
          checked: true,
        };
      });
    });
  }, []);

  const updateQuantity = useCallback(
    (cartKey: string, tier: "adult" | "child" | "baby", quantity: number) => {
      setItems((prev) => {
        const target = prev.find((i) => i.cartKey === cartKey);
        if (!target) return prev;
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
            return { ...item, quantityAdult: clamp(quantity, 0, maxAdult) };
          }
          if (tier === "child") {
            const maxChild = Math.max(0, item.stockChild - otherUsed);
            return { ...item, quantityChild: clamp(quantity, 0, maxChild) };
          }
          const maxBaby = Math.max(0, item.stockBaby - otherUsed);
          return { ...item, quantityBaby: clamp(quantity, 0, maxBaby) };
        });
      });
    },
    []
  );

  const toggleCheck = useCallback((cartKey: string, checked?: boolean) => {
    setItems((prev) =>
      prev.map((item) =>
        item.cartKey === cartKey
          ? { ...item, checked: checked ?? !item.checked }
          : item
      )
    );
  }, []);

  const toggleAll = useCallback((checked: boolean) => {
    setItems((prev) => prev.map((item) => ({ ...item, checked })));
  }, []);

  const removeItem = useCallback((cartKey: string) => {
    setItems((prev) => prev.filter((item) => item.cartKey !== cartKey));
  }, []);

  const clearCheckedItems = useCallback(() => {
    setItems((prev) => prev.filter((item) => !item.checked));
  }, []);

  const totalItemCount = useMemo(() => items.length, [items]);

  const checkedSubTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      if (!item.checked) return sum;
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
