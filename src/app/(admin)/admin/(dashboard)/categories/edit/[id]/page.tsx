import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CategoryForm } from "@/components/admin/CategoryForm";

export const dynamic = "force-dynamic";

export default async function AdminCategoryEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await prisma.category.findFirst({
    where: { id, deleted: false },
  });

  if (!item) {
    notFound();
  }

  return (
    <CategoryForm
      mode="edit"
      initialData={{
        id: item.id,
        name: item.name,
        parentId: item.parentId || "",
        position: item.position,
        status: item.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
        avatar: item.avatar || "",
        description: item.description || "",
      }}
    />
  );
}
