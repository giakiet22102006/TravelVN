import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin, hasAdminPermission } from "@/lib/auth";
import { AdminForbiddenCard } from "@/components/admin/AdminForbiddenCard";
import { AdminAccountForm } from "@/components/admin/AdminAccountForm";

export const dynamic = "force-dynamic";

export default async function AdminAccountEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/account/login");
  if (!hasAdminPermission(admin, "admin_edit")) {
    return (
      <AdminForbiddenCard
        title="Bạn không có quyền chỉnh sửa tài khoản quản trị"
        backHref="/admin/settings/accounts"
        backLabel="Quay lại tài khoản quản trị"
      />
    );
  }

  const { id } = await params;
  const item = await prisma.adminAccount.findFirst({
    where: { id, deleted: false },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      roleId: true,
      positionCompany: true,
      status: true,
      avatar: true,
    },
  });

  if (!item) {
    notFound();
  }

  return (
    <AdminAccountForm
      mode="edit"
      initialData={{
        id: item.id,
        fullName: item.fullName,
        email: item.email,
        phone: item.phone || "",
        roleId: item.roleId || "",
        positionCompany: item.positionCompany || "",
        status: item.status,
        avatar: item.avatar || "",
      }}
    />
  );
}
