import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RoleForm } from "@/components/admin/RoleForm";

export const dynamic = "force-dynamic";

export default async function AdminRoleEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
