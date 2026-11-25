import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin, hasAdminPermission } from "@/lib/auth";
import { AdminForbiddenCard } from "@/components/admin/AdminForbiddenCard";
import { RoleForm } from "@/components/admin/RoleForm";

export const dynamic = "force-dynamic";

export default async function AdminRoleEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/account/login");
  if (!hasAdminPermission(admin, "role_edit")) {
    return (
      <AdminForbiddenCard
        title="Bạn không có quyền chỉnh sửa nhóm quyền"
        backHref="/admin/settings/roles"
        backLabel="Quay lại nhóm quyền"
      />
    );
  }

  const { id } = await params;
  const item = await prisma.role.findFirst({
    where: { id, deleted: false },
  });

  if (!item) {
    notFound();
  }

  const permissions = Array.isArray(item.permissions)
    ? item.permissions.map((v) => String(v))
    : [];

  return (
    <RoleForm
      mode="edit"
      initialData={{
        id: item.id,
        name: item.name,
        description: item.description || "",
        permissions,
      }}
    />
  );
}
