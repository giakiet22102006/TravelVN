import React from "react";
import { getClientShellData } from "@/lib/client-data";
import { getCurrentUser } from "@/lib/client-auth";
import { ClientLayoutShell } from "@/components/client/ClientLayoutShell";

export const dynamic = "force-dynamic";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [{ categories, tree, websiteInfo }, currentUser] = await Promise.all([
    getClientShellData(),
    getCurrentUser(),
  ]);

  return (
    <ClientLayoutShell
      initialCategories={categories}
      initialCategoryTree={tree}
      initialWebsiteInfo={websiteInfo}
      initialUser={currentUser}
    >
      {children}
    </ClientLayoutShell>
  );
}
