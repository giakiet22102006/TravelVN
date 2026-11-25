import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin, hasAdminPermission } from "@/lib/auth";
import { AdminForbiddenCard } from "@/components/admin/AdminForbiddenCard";
import { CategoryForm } from "@/components/admin/CategoryForm";

export const dynamic = "force-dynamic";

export default async function AdminCategoryEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/account/login");
  if (!hasAdminPermission(admin, "category_edit")) {
    return (
      <AdminForbiddenCard
        title="Bạn không có quyền chỉnh sửa danh mục"
        backHref="/admin/categories"
        backLabel="Quay lại danh mục"
      />
    );
  }

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
