import { redirect } from "next/navigation";
import { getCurrentAdmin, hasAdminPermission } from "@/lib/auth";
import { AdminForbiddenCard } from "@/components/admin/AdminForbiddenCard";
import { AdminAccountForm } from "@/components/admin/AdminAccountForm";

export const dynamic = "force-dynamic";

export default async function AdminAccountCreatePage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/account/login");
  if (!hasAdminPermission(admin, "admin_create")) {
    return (
      <AdminForbiddenCard
        title="Bạn không có quyền tạo tài khoản quản trị"
        backHref="/admin/settings/accounts"
        backLabel="Quay lại tài khoản quản trị"
      />
    );
  }
  return <AdminAccountForm mode="create" />;
}
