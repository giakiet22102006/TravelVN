import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { NewsForm } from "@/components/admin/NewsForm";

export const dynamic = "force-dynamic";

export default async function AdminNewsEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await prisma.newsArticle.findFirst({
    where: { id, deleted: false },
  });

  if (!item) {
    notFound();
  }

  return (
    <NewsForm
      mode="edit"
      initialData={{
        id: item.id,
        slug: item.slug,
        title: item.title,
        category: item.category,
        excerpt: item.excerpt,
        content: item.content,
        avatar: item.avatar || "",
        featured: item.featured,
        relatedDestination: item.relatedDestination || "",
        position: item.position,
        status: item.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
        publishedAt: item.publishedAt.toISOString().slice(0, 10),
      }}
    />
  );
}
