import { redirect } from "next/navigation";
import {
  extractPermissionStrings,
  getCurrentAdmin,
  isSuperAdmin,
} from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { ALL_PERMISSION_KEYS } from "@/lib/permissions";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/admin/account/login");
  }

  const effectivePermissions = isSuperAdmin(admin)
    ? ALL_PERMISSION_KEYS
    : extractPermissionStrings(admin.role?.permissions);

  return (
    <AdminShell
      admin={{
        id: admin.id,
        fullName: admin.fullName,
        email: admin.email,
        avatar: admin.avatar,
        roleName: admin.role?.name || "Quản trị viên",
        permissions: effectivePermissions,
      }}
    >
      {children}
    </AdminShell>
  );
}
