import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TourForm, TourScheduleItem } from "@/components/admin/TourForm";

export const dynamic = "force-dynamic";

export default async function AdminTourEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await prisma.tour.findFirst({
    where: { id, deleted: false },
  });

  if (!item) {
    notFound();
  }

  const images = Array.isArray(item.images)
    ? item.images.map((v) => String(v))
    : [];
  const locations = Array.isArray(item.locations)
    ? item.locations.map((v) => String(v))
    : [];
  const schedules: TourScheduleItem[] = Array.isArray(item.schedules)
    ? (item.schedules as Array<{ title?: unknown; description?: unknown }>).map(
        (s) => ({
          title: String(s?.title || ""),
          description: String(s?.description || ""),
        })
      )
    : [];

  return (
    <TourForm
      mode="edit"
      initialData={{
        id: item.id,
        code: item.code,
        name: item.name,
        categoryId: item.categoryId,
        position: item.position,
        status: item.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
        avatar: item.avatar || "",
        images,
        priceAdult: item.priceAdult,
        priceChild: item.priceChild,
        priceBaby: item.priceBaby,
        priceNewAdult: item.priceNewAdult,
        priceNewChild: item.priceNewChild,
        priceNewBaby: item.priceNewBaby,
        stockAdult: item.stockAdult,
        stockChild: item.stockChild,
        stockBaby: item.stockBaby,
        locations,
        time: item.time,
        vehicle: item.vehicle,
        departureDate: item.departureDate
          ? item.departureDate.toISOString().slice(0, 10)
          : "",
        information: item.information || "",
        schedules,
      }}
    />
  );
}
