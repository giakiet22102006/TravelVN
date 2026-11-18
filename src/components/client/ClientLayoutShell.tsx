"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CartProvider } from "./CartContext";
import {
  ClientHeader,
  type CategoryTreeItem,
  type WebsiteInfoData,
} from "./ClientHeader";
import { ClientFooter } from "./ClientFooter";
import { AiTravelAssistant } from "./AiTravelAssistant";

export interface ClientCategoryFlatItem {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  avatar: string | null;
  position: number;
  description: string | null;
  depth?: number;
}

export interface ClientUserProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  address: string | null;
  avatar: string | null;
  provider: string;
  status: string;
  hasPassword: boolean;
}

const DEFAULT_WEBSITE_INFO: WebsiteInfoData = {
  id: "default",
  websiteName: "VN.TRAVEL",
  phone: "0123456789",
  email: "contact@vn.travel.com",
  address: "Số 123, đường ABC",
  logo: null,
  favicon: null,
};

const DEFAULT_CATEGORY_TREE: CategoryTreeItem[] = [
  {
    id: "default-domestic",
    name: "Tour Trong Nước",
    slug: "tour-trong-nuoc",
    parentId: null,
    avatar: null,
    position: 1,
    description: null,
    children: [
      {
        id: "default-north",
        name: "Tour Miền Bắc",
        slug: "tour-mien-bac",
        parentId: "default-domestic",
        avatar: null,
        position: 1,
        description: null,
        children: [],
      },
      {
        id: "default-central",
        name: "Tour Miền Trung",
        slug: "tour-mien-trung",
        parentId: "default-domestic",
        avatar: null,
        position: 2,
        description: null,
        children: [],
      },
      {
        id: "default-south",
        name: "Tour Miền Nam",
        slug: "tour-mien-nam",
        parentId: "default-domestic",
        avatar: null,
        position: 3,
        description: null,
        children: [],
      },
    ],
  },
  {
    id: "default-international",
    name: "Tour Nước Ngoài",
    slug: "tour-nuoc-ngoai",
    parentId: null,
    avatar: null,
    position: 2,
    description: null,
    children: [
      {
        id: "default-asia",
        name: "Tour Châu Á",
        slug: "tour-chau-a",
        parentId: "default-international",
        avatar: null,
        position: 1,
        description: null,
        children: [],
      },
      {
        id: "default-europe",
        name: "Tour Châu Âu",
        slug: "tour-chau-au",
        parentId: "default-international",
        avatar: null,
        position: 2,
        description: null,
        children: [],
      },
    ],
  },
];

function flattenTree(tree: CategoryTreeItem[], depth = 0): ClientCategoryFlatItem[] {
  const result: ClientCategoryFlatItem[] = [];
  for (const node of tree) {
    const { children, ...rest } = node;
    result.push({ ...rest, depth });
    if (children.length > 0) {
      result.push(...flattenTree(children, depth + 1));
    }
  }
  return result;
}

interface ClientMetaContextValue {
  categories: ClientCategoryFlatItem[];
  categoryTree: CategoryTreeItem[];
  websiteInfo: WebsiteInfoData;
  currentUser: ClientUserProfile | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<ClientUserProfile | null>>;
  refreshUser: () => Promise<void>;
  logoutUser: () => Promise<void>;
}

const ClientMetaContext = createContext<ClientMetaContextValue>({
  categories: flattenTree(DEFAULT_CATEGORY_TREE),
  categoryTree: DEFAULT_CATEGORY_TREE,
  websiteInfo: DEFAULT_WEBSITE_INFO,
  currentUser: null,
  setCurrentUser: () => {},
  refreshUser: async () => {},
  logoutUser: async () => {},
});

export function useClientMeta() {
  return useContext(ClientMetaContext);
}

interface ClientLayoutShellProps {
  children: React.ReactNode;
  initialCategories?: ClientCategoryFlatItem[];
  initialCategoryTree?: CategoryTreeItem[];
  initialWebsiteInfo?: WebsiteInfoData;
  initialUser?: ClientUserProfile | null;
}

export function ClientLayoutShell({
  children,
  initialCategories,
  initialCategoryTree,
  initialWebsiteInfo,
  initialUser,
}: ClientLayoutShellProps) {
  const hasServerMeta = Boolean(
    initialCategoryTree && initialWebsiteInfo && initialCategories
  );

  const [categoryTree, setCategoryTree] = useState<CategoryTreeItem[]>(
    initialCategoryTree ?? DEFAULT_CATEGORY_TREE
  );
  const [categories, setCategories] = useState<ClientCategoryFlatItem[]>(
    initialCategories ??
      flattenTree(initialCategoryTree ?? DEFAULT_CATEGORY_TREE)
  );
  const [websiteInfo, setWebsiteInfo] = useState<WebsiteInfoData>(
    initialWebsiteInfo ?? DEFAULT_WEBSITE_INFO
  );
  const [currentUser, setCurrentUser] = useState<ClientUserProfile | null>(
    initialUser ?? null
  );

  useEffect(() => {
    setCurrentUser(initialUser ?? null);
  }, [initialUser]);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/client/auth/me");
      if (!res.ok) return;
      const data = await res.json();
      setCurrentUser(data.user ?? null);
    } catch {
      // Ignore transient failure
    }
  }, []);

  const logoutUser = useCallback(async () => {
    try {
      await fetch("/api/client/auth/logout", { method: "POST" });
    } finally {
      setCurrentUser(null);
    }
  }, []);

  useEffect(() => {
    if (hasServerMeta) return;
    let cancelled = false;

    async function loadMeta() {
      try {
        const res = await fetch("/api/client/categories");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data.tree) && data.tree.length > 0) {
          setCategoryTree(data.tree);
        }
        if (Array.isArray(data.categories) && data.categories.length > 0) {
          setCategories(data.categories);
        }
        if (data.websiteInfo) {
          setWebsiteInfo(data.websiteInfo);
        }
      } catch {
        // Keep defaults on transient network issues
      }
    }

    loadMeta();
    return () => {
      cancelled = true;
    };
  }, [hasServerMeta]);

  return (
    <ClientMetaContext.Provider
      value={{
        categories,
        categoryTree,
        websiteInfo,
        currentUser,
        setCurrentUser,
        refreshUser,
        logoutUser,
      }}
    >
      <CartProvider>
        <div className="min-h-screen flex flex-col bg-[#F6F6F6] text-[#25282B] font-lexend-deca">
          <ClientHeader categoryTree={categoryTree} websiteInfo={websiteInfo} />
          <main className="flex-1">{children}</main>
          <ClientFooter websiteInfo={websiteInfo} />
          <AiTravelAssistant />
        </div>
      </CartProvider>
    </ClientMetaContext.Provider>
  );
}
