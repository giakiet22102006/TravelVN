import { redirect } from "next/navigation";
import { getCurrentAdmin, hasAdminPermission } from "@/lib/auth";
import { AdminForbiddenCard } from "@/components/admin/AdminForbiddenCard";
import { RoleForm } from "@/components/admin/RoleForm";

export const dynamic = "force-dynamic";

export default async function AdminRoleCreatePage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/account/login");
  if (!hasAdminPermission(admin, "role_create")) {
    return (
      <AdminForbiddenCard
        title="Bạn không có quyền tạo nhóm quyền"
        backHref="/admin/settings/roles"
        backLabel="Quay lại nhóm quyền"
      />
    );
  }
  return <RoleForm mode="create" />;
}
