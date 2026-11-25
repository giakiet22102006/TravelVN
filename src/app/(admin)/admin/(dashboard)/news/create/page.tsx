import { redirect } from "next/navigation";
import { getCurrentAdmin, hasAdminPermission } from "@/lib/auth";
import { AdminForbiddenCard } from "@/components/admin/AdminForbiddenCard";
import { NewsForm } from "@/components/admin/NewsForm";

export const dynamic = "force-dynamic";

export default async function AdminNewsCreatePage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/account/login");
  if (!hasAdminPermission(admin, "news_create")) {
    return (
      <AdminForbiddenCard
        title="Bạn không có quyền tạo bài viết"
        backHref="/admin/news"
        backLabel="Quay lại danh sách tin tức"
      />
    );
  }
  return <NewsForm mode="create" />;
}
