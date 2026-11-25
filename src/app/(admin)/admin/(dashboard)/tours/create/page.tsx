import { redirect } from "next/navigation";
import { getCurrentAdmin, hasAdminPermission } from "@/lib/auth";
import { AdminForbiddenCard } from "@/components/admin/AdminForbiddenCard";
import { TourForm } from "@/components/admin/TourForm";

export const dynamic = "force-dynamic";

export default async function AdminTourCreatePage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/account/login");
  if (!hasAdminPermission(admin, "tour_create")) {
    return (
      <AdminForbiddenCard
        title="Bạn không có quyền tạo tour"
        backHref="/admin/tours"
        backLabel="Quay lại danh sách tour"
      />
    );
  }
  return <TourForm mode="create" />;
}
