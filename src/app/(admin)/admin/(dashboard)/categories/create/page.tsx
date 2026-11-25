import { redirect } from "next/navigation";
import { getCurrentAdmin, hasAdminPermission } from "@/lib/auth";
import { AdminForbiddenCard } from "@/components/admin/AdminForbiddenCard";
import { CategoryForm } from "@/components/admin/CategoryForm";

export const dynamic = "force-dynamic";

export default async function AdminCategoryCreatePage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/account/login");
  if (!hasAdminPermission(admin, "category_create")) {
    return (
      <AdminForbiddenCard
        title="Bạn không có quyền tạo danh mục"
        backHref="/admin/categories"
        backLabel="Quay lại danh mục"
      />
    );
  }
  return <CategoryForm mode="create" />;
}
