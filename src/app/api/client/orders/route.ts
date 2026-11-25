import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  RecordStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/client-auth";
import { revalidateClientToursCache } from "@/lib/cache-tags";
import { calculateCouponDiscount } from "@/lib/knowledge/coupons";
import {
  checkRateLimit,
  getClientIp,
  rateLimitExceededResponse,
} from "@/lib/rate-limit";

interface OrderRequestItem {
  tourId: string;
  departureLocation?: string;
  quantityAdult?: number;
  quantityChild?: number;
  quantityBaby?: number;
}

class OrderValidationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const VALID_PAYMENT_METHODS = new Set<string>([
  PaymentMethod.CASH,
  PaymentMethod.MOMO,
  PaymentMethod.BANK_TRANSFER,
]);

function parseNonNegativeInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function computeCouponDiscount(couponRaw: string, subTotal: number): {
  discount: number;
  normalizedCode: string | null;
} {
  const res = calculateCouponDiscount(couponRaw, subTotal);
  if (!res.valid) {
    throw new OrderValidationError(
      `Mã giảm giá "${res.normalizedCode}" không hợp lệ hoặc đã hết hạn`,
      400
    );
  }
  return { discount: res.discount, normalizedCode: res.normalizedCode };
}

function randomUpperAlnum(length: number): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[crypto.randomInt(0, chars.length)];
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`client-order:${ip}`, 6, 5 * 60 * 1000);
    if (!rl.allowed) {
      return rateLimitExceededResponse(
        rl.retryAfterSec,
        "Bạn tạo đơn hàng quá nhanh, vui lòng thử lại sau ít phút."
      );
    }

    const body = await req.json();
    const fullName = String(body.fullName || "").trim();
    const phone = String(body.phone || "").trim();
    const note = body.note ? String(body.note).trim() : null;
    const couponRaw = String(body.couponCode || "");
    const paymentMethodRaw = String(body.paymentMethod || PaymentMethod.CASH).toUpperCase();
    const itemsInput: OrderRequestItem[] = Array.isArray(body.items) ? body.items : [];

    if (!fullName) {
      return NextResponse.json(
        { message: "Vui lòng nhập họ và tên khách hàng" },
        { status: 400 }
      );
    }

    if (fullName.length < 2 || fullName.length > 100) {
      return NextResponse.json(
        { message: "Họ và tên phải từ 2 đến 100 ký tự" },
        { status: 400 }
      );
    }

    const normalizedPhone = phone.replace(/[\s.-]/g, "");
    if (!/^(\+84|0)[0-9]{8,10}$/.test(normalizedPhone)) {
      return NextResponse.json(
        { message: "Số điện thoại không hợp lệ (ví dụ: 0912345678)" },
        { status: 400 }
      );
    }

    if (itemsInput.length === 0) {
      return NextResponse.json(
        { message: "Giỏ hàng đang trống, vui lòng chọn ít nhất 1 tour" },
        { status: 400 }
      );
    }

    if (itemsInput.length > 20) {
      return NextResponse.json(
        { message: "Mỗi đơn hàng tối đa 20 tour" },
        { status: 400 }
      );
    }

    const paymentMethod: PaymentMethod = VALID_PAYMENT_METHODS.has(paymentMethodRaw)
      ? (paymentMethodRaw as PaymentMethod)
      : PaymentMethod.CASH;

    const currentUser = await getCurrentUser();

    let order = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        order = await prisma.$transaction(async (tx) => {
          let subTotal = 0;
          const snapshotItems: {
            tourId: string;
            name: string;
            avatar: string | null;
            departureDate: Date | null;
            departureLocation: string;
            quantityAdult: number;
            priceNewAdult: number;
            quantityChild: number;
            priceNewChild: number;
            quantityBaby: number;
            priceNewBaby: number;
          }[] = [];

          for (const item of itemsInput) {
            const tourId = String(item.tourId || "").trim();
            const quantityAdult = parseNonNegativeInt(item.quantityAdult);
            const quantityChild = parseNonNegativeInt(item.quantityChild);
            const quantityBaby = parseNonNegativeInt(item.quantityBaby);

            if (!tourId) {
              throw new OrderValidationError("Thiếu thông tin tour trong giỏ hàng");
            }

            if (quantityAdult + quantityChild + quantityBaby <= 0) {
              throw new OrderValidationError(
                "Mỗi tour đặt phải có ít nhất 1 hành khách"
              );
            }

            const tour = await tx.tour.findFirst({
              where: {
                id: tourId,
                deleted: false,
                status: RecordStatus.ACTIVE,
                category: { deleted: false, status: RecordStatus.ACTIVE },
              },
            });

            if (!tour) {
              throw new OrderValidationError(
                "Một tour trong giỏ hàng không tồn tại hoặc đã ngừng nhận khách",
                404
              );
            }

            if (
              quantityAdult > tour.stockAdult ||
              quantityChild > tour.stockChild ||
              quantityBaby > tour.stockBaby
            ) {
              throw new OrderValidationError(
                `Tour "${tour.name}" không đủ số chỗ còn lại (Người lớn: ${tour.stockAdult}, Trẻ em: ${tour.stockChild}, Em bé: ${tour.stockBaby})`,
                409
              );
            }

            /**
             * Atomic conditional UPDATE inside PostgreSQL transaction:
             * Even if two requests pass the read check above concurrently (TOCTOU race),
             * PostgreSQL acquires a row-level lock on UPDATE and re-evaluates the WHERE
             * predicate (`stock >= qty`) against the latest committed tuple version.
             * If count === 0, another buyer just took the remaining slots -> roll back.
             */
            const decremented = await tx.tour.updateMany({
              where: {
                id: tour.id,
                deleted: false,
                status: RecordStatus.ACTIVE,
                stockAdult: { gte: quantityAdult },
                stockChild: { gte: quantityChild },
                stockBaby: { gte: quantityBaby },
              },
              data: {
                stockAdult: { decrement: quantityAdult },
                stockChild: { decrement: quantityChild },
                stockBaby: { decrement: quantityBaby },
              },
            });

            if (decremented.count === 0) {
              throw new OrderValidationError(
                `Tour "${tour.name}" vừa hết chỗ khi bạn thao tác, vui lòng kiểm tra lại số lượng`,
                409
              );
            }

            // Always compute line totals from server-side DB prices, never trust client totals
            subTotal +=
              quantityAdult * tour.priceNewAdult +
              quantityChild * tour.priceNewChild +
              quantityBaby * tour.priceNewBaby;

            const locations = Array.isArray(tour.locations)
              ? (tour.locations as string[])
              : [];
            const departureLocation =
              String(item.departureLocation || "").trim() ||
              locations[0] ||
              "Hà Nội";

            snapshotItems.push({
              tourId: tour.id,
              name: tour.name,
              avatar: tour.avatar,
              departureDate: tour.departureDate,
              departureLocation,
              quantityAdult,
              priceNewAdult: tour.priceNewAdult,
              quantityChild,
              priceNewChild: tour.priceNewChild,
              quantityBaby,
              priceNewBaby: tour.priceNewBaby,
            });
          }

          const { discount, normalizedCode } = computeCouponDiscount(couponRaw, subTotal);
          const total = Math.max(0, subTotal - discount);

          const latestOrder = await tx.order.findFirst({
            where: { code: { startsWith: "OD" } },
            orderBy: { code: "desc" },
            select: { code: true },
          });

          const lastNumber = latestOrder
            ? parseInt(latestOrder.code.replace(/^OD/, ""), 10) || 0
            : 0;
          const baseCode = `OD${String(lastNumber + 1).padStart(6, "0")}`;
          const nextCode =
            attempt === 2 ? `${baseCode}${randomUpperAlnum(2)}` : baseCode;

          const createdOrder = await tx.order.create({
            data: {
              code: nextCode,
              userId: currentUser?.id ?? null,
              fullName,
              phone,
              note,
              subTotal,
              discount,
              couponCode: normalizedCode,
              total,
              paymentMethod,
              paymentStatus: PaymentStatus.UNPAID,
              status: OrderStatus.INITIAL,
              items: {
                create: snapshotItems,
              },
            },
            include: {
              items: true,
            },
          });

          return createdOrder;
        });
        break;
      } catch (err) {
        const isCodeCollision =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002";
        if (isCodeCollision && attempt < 2) {
          continue;
        }
        throw err;
      }
    }

    revalidateClientToursCache();

    return NextResponse.json(
      {
        message: "Đặt tour thành công!",
        order,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof OrderValidationError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status }
      );
    }
    console.error("POST /api/client/orders error:", error);
    return NextResponse.json(
      { message: "Lỗi hệ thống khi tạo đơn đặt tour" },
      { status: 500 }
    );
  }
}
