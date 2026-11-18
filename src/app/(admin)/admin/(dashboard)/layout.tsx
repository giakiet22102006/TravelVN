import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/admin/account/login");
  }

  return (
    <AdminShell
      admin={{
        id: admin.id,
        fullName: admin.fullName,
        email: admin.email,
        avatar: admin.avatar,
        roleName: admin.role?.name || "Quản trị viên",
      }}
    >
      {children}
    </AdminShell>
  );
}
