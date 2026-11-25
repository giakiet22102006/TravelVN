import { redirect } from "next/navigation";
import { getCurrentAdmin, hasAdminPermission } from "@/lib/auth";
import { AdminForbiddenCard } from "@/components/admin/AdminForbiddenCard";
import { OrderEditForm } from "@/components/admin/OrderEditForm";

export const dynamic = "force-dynamic";

export default async function AdminOrderEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/account/login");
  if (!hasAdminPermission(admin, "order_edit")) {
    return (
      <AdminForbiddenCard
        title="Bạn không có quyền chỉnh sửa đơn hàng"
        backHref="/admin/orders"
        backLabel="Quay lại đơn hàng"
      />
    );
  }

  const { id } = await params;
  return <OrderEditForm id={id} />;
}
