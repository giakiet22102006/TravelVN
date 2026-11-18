import { NextResponse } from "next/server";
import { ContactStatus, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasAdminPermission, requireAdmin } from "@/lib/auth";
import { formatCurrencyVND } from "@/lib/format";

export interface AdminNotificationItem {
  id: string;
  type: "order" | "contact";
  title: string;
  description: string;
  href: string;
  createdAt: string;
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { admin } = auth;

    const canViewOrders = hasAdminPermission(admin, "order_view");
    const canViewContacts = hasAdminPermission(admin, "contact_view");

    const [pendingOrdersCount, newContactsCount, recentOrders, recentContacts] =
      await Promise.all([
        canViewOrders
          ? prisma.order.count({
              where: { deleted: false, status: OrderStatus.INITIAL },
            })
          : Promise.resolve(0),
        canViewContacts
          ? prisma.contact.count({
              where: { deleted: false, status: ContactStatus.NEW },
            })
          : Promise.resolve(0),
        canViewOrders
          ? prisma.order.findMany({
              where: { deleted: false, status: OrderStatus.INITIAL },
              orderBy: { createdAt: "desc" },
              take: 5,
              select: {
                id: true,
                code: true,
                fullName: true,
                total: true,
                createdAt: true,
              },
            })
          : Promise.resolve([]),
        canViewContacts
          ? prisma.contact.findMany({
              where: { deleted: false, status: ContactStatus.NEW },
              orderBy: { createdAt: "desc" },
              take: 5,
              select: {
                id: true,
                email: true,
                createdAt: true,
              },
            })
          : Promise.resolve([]),
      ]);

    const items: AdminNotificationItem[] = [
      ...recentOrders.map((ord) => ({
        id: `order-${ord.id}`,
        type: "order" as const,
        title: `Đơn mới ${ord.code}`,
        description: `${ord.fullName} • ${formatCurrencyVND(ord.total)}`,
        href: `/admin/orders/edit/${ord.id}`,
        createdAt: ord.createdAt.toISOString(),
      })),
      ...recentContacts.map((c) => ({
        id: `contact-${c.id}`,
        type: "contact" as const,
        title: "Liên hệ đăng ký nhận tin",
        description: c.email,
        href: "/admin/contacts",
        createdAt: c.createdAt.toISOString(),
      })),
    ]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 8);

    return NextResponse.json({
      totalCount: pendingOrdersCount + newContactsCount,
      pendingOrdersCount,
      newContactsCount,
      items,
    });
  } catch (error) {
    console.error("GET /api/admin/notifications error:", error);
    return NextResponse.json(
      { message: "Lỗi tải thông báo" },
      { status: 500 }
    );
  }
}
