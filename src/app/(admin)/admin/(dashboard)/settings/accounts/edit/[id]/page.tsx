import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminAccountForm } from "@/components/admin/AdminAccountForm";

export const dynamic = "force-dynamic";

export default async function AdminAccountEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
