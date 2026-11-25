import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  RecordStatus,
  RefundStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/client-auth";
import { revalidateClientToursCache } from "@/lib/cache-tags";
import {
  calculateCouponDiscount,
  evaluateCouponEligibility,
} from "@/lib/knowledge/coupons";
import {
  calculateMaxRedeemablePoints,
  computeMemberTier,
  InsufficientPointsError,
  POINT_VALUE_VND,
  redeemPointsForOrderTx,
} from "@/lib/loyalty";
import { signOrderClaimToken } from "@/lib/order-claim";
import {
  ORDER_HOLD_TTL_MS,
  releaseExpiredOrderHolds,
  reserveOrderItemStock,
} from "@/lib/order-holds";
import { sendOrderConfirmationEmail } from "@/lib/email";
import type { OrderPassengerInput } from "@/types/ota";
import {
  checkRateLimit,
  getClientIp,
  rateLimitExceededResponse,
} from "@/lib/rate-limit";

interface OrderRequestItem {
  tourId: string;
  departureId?: string | null;
  departureLocation?: string;
  quantityAdult?: number;
  quantityChild?: number;
  quantityBaby?: number;
  singleRoomCount?: number;
  passengers?: OrderPassengerInput[];
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

const VALID_GENDERS = new Set(["MALE", "FEMALE", "OTHER"]);
const VALID_TIERS = new Set(["ADULT", "CHILD", "BABY"]);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseNonNegativeInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function isValidCalendarBirthDate(birthDate: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return false;
  const [year, month, day] = birthDate.split("-").map(Number);
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const utcCheck = new Date(Date.UTC(year, month - 1, day));
  if (
    utcCheck.getUTCFullYear() !== year ||
    utcCheck.getUTCMonth() !== month - 1 ||
    utcCheck.getUTCDate() !== day
  ) {
    return false;
  }
  const todayVN = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());
  return birthDate <= todayVN;
}

function sanitizePassenger(
  raw: unknown,
  indexLabel: string
): OrderPassengerInput {
  if (!raw || typeof raw !== "object") {
    throw new OrderValidationError(
      `Thông tin ${indexLabel} không hợp lệ`
    );
  }
  const p = raw as Record<string, unknown>;
  const fullName = String(p.fullName || "")
    .trim()
    .replace(/\s+/g, " ");
  const gender = String(p.gender || "").toUpperCase();
  const birthDate = String(p.birthDate || "").trim();
  const tier = String(p.tier || "").toUpperCase();
  const documentNumber = p.documentNumber
    ? String(p.documentNumber).trim().slice(0, 50)
    : undefined;

  if (fullName.length < 2 || fullName.length > 100) {
    throw new OrderValidationError(
      `Họ tên của ${indexLabel} phải từ 2 đến 100 ký tự`
    );
  }
  if (!VALID_GENDERS.has(gender)) {
    throw new OrderValidationError(
      `Giới tính của ${indexLabel} không hợp lệ`
    );
  }
  if (!birthDate) {
    throw new OrderValidationError(
      `Vui lòng nhập ngày sinh cho ${indexLabel}`
    );
  }
  if (!isValidCalendarBirthDate(birthDate)) {
    throw new OrderValidationError(
      `Ngày sinh của ${indexLabel} không hợp lệ (định dạng YYYY-MM-DD)`
    );
  }
  if (!VALID_TIERS.has(tier)) {
    throw new OrderValidationError(
      `Hạng vé của ${indexLabel} không hợp lệ`
    );
  }

  return {
    fullName,
    gender: gender as OrderPassengerInput["gender"],
    birthDate,
    tier: tier as OrderPassengerInput["tier"],
    ...(documentNumber ? { documentNumber } : {}),
  };
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

    let body: Record<string, unknown>;
    try {
      const raw = await req.json();
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return NextResponse.json(
          { message: "Dữ liệu đơn hàng không hợp lệ" },
          { status: 400 }
        );
      }
      body = raw as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { message: "Payload JSON không hợp lệ" },
        { status: 400 }
      );
    }

    const fullName = String(body.fullName || "").trim();
    const phone = String(body.phone || "").trim();
    const email = String(body.email || "").trim();
    const agreedTerms = body.agreedTerms === true;
    const note = body.note ? String(body.note).trim() : null;
    const couponRaw = String(body.couponCode || "");
    const paymentMethodRaw = String(
      body.paymentMethod || PaymentMethod.CASH
    ).toUpperCase();
    const itemsInput: OrderRequestItem[] = Array.isArray(body.items)
      ? (body.items as OrderRequestItem[])
      : [];
    const rawPassengers: unknown[] = Array.isArray(body.passengers)
      ? body.passengers
      : [];
    const saveTravelers = body.saveTravelers === true;

    let requestedRedeemPoints = 0;
    if (body.redeemPoints !== undefined && body.redeemPoints !== null) {
      if (
        typeof body.redeemPoints !== "number" ||
        !Number.isSafeInteger(body.redeemPoints) ||
        body.redeemPoints < 0
      ) {
        return NextResponse.json(
          { message: "Số điểm quy đổi phải là số nguyên không âm" },
          { status: 400 }
        );
      }
      requestedRedeemPoints = body.redeemPoints === 0 ? 0 : body.redeemPoints;
    }

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

    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { message: "Vui lòng nhập địa chỉ email hợp lệ để nhận e-Voucher" },
        { status: 400 }
      );
    }

    if (!agreedTerms) {
      return NextResponse.json(
        {
          message:
            "Vui lòng xác nhận đồng ý với Điều khoản đặt tour và Chính sách hoàn hủy",
        },
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

    const totalRequestedPassengers = itemsInput.reduce((sum, item) => {
      return (
        sum +
        parseNonNegativeInt(item.quantityAdult) +
        parseNonNegativeInt(item.quantityChild) +
        parseNonNegativeInt(item.quantityBaby)
      );
    }, 0);

    if (totalRequestedPassengers <= 0) {
      return NextResponse.json(
        { message: "Mỗi tour đặt phải có ít nhất 1 hành khách" },
        { status: 400 }
      );
    }

    if (rawPassengers.length !== totalRequestedPassengers) {
      return NextResponse.json(
        {
          message: `Vui lòng nhập đầy đủ thông tin cho cả ${totalRequestedPassengers} hành khách`,
        },
        { status: 400 }
      );
    }

    const validatedPassengers = rawPassengers.map((p, idx) =>
      sanitizePassenger(p, `Hành khách ${idx + 1}`)
    );

    const paymentMethod: PaymentMethod = VALID_PAYMENT_METHODS.has(
      paymentMethodRaw
    )
      ? (paymentMethodRaw as PaymentMethod)
      : PaymentMethod.CASH;

    const currentUser = await getCurrentUser();

    if (requestedRedeemPoints > 0 && !currentUser) {
      return NextResponse.json(
        { message: "Vui lòng đăng nhập để sử dụng điểm thưởng" },
        { status: 401 }
      );
    }

    // Release expired holds before reserving stock so stale holds don't block valid bookings
    await releaseExpiredOrderHolds();

    let order = null;
    let orderPassengersSnapshot: OrderPassengerInput[] = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const txResult = await prisma.$transaction(async (tx) => {
          let subTotal = 0;
          let passengerOffset = 0;

          const snapshotItems: Prisma.OrderItemCreateWithoutOrderInput[] = [];
          const allOrderPassengers: OrderPassengerInput[] = [];

          for (const item of itemsInput) {
            const tourId = String(item.tourId || "").trim();
            const departureId = item.departureId
              ? String(item.departureId).trim()
              : null;
            const quantityAdult = parseNonNegativeInt(item.quantityAdult);
            const quantityChild = parseNonNegativeInt(item.quantityChild);
            const quantityBaby = parseNonNegativeInt(item.quantityBaby);

            if (!tourId) {
              throw new OrderValidationError(
                "Thiếu thông tin tour trong giỏ hàng"
              );
            }

            const itemPassengerCount =
              quantityAdult + quantityChild + quantityBaby;
            if (itemPassengerCount <= 0) {
              throw new OrderValidationError(
                "Mỗi tour đặt phải có ít nhất 1 hành khách"
              );
            }

            const singleRoomCount = Math.min(
              quantityAdult,
              parseNonNegativeInt(item.singleRoomCount)
            );

            const itemPassengers =
              Array.isArray(item.passengers) &&
              item.passengers.length === itemPassengerCount
                ? item.passengers.map((p, idx) =>
                    sanitizePassenger(p, `Hành khách ${idx + 1}`)
                  )
                : validatedPassengers.slice(
                    passengerOffset,
                    passengerOffset + itemPassengerCount
                  );
            passengerOffset += itemPassengerCount;
            allOrderPassengers.push(...itemPassengers);

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

            if (departureId) {
              const dep = await tx.tourDeparture.findFirst({
                where: {
                  id: departureId,
                  tourId: tour.id,
                  status: RecordStatus.ACTIVE,
                },
              });

              if (!dep) {
                throw new OrderValidationError(
                  `Lịch khởi hành đã chọn cho tour "${tour.name}" không tồn tại hoặc đã ngừng nhận khách`,
                  404
                );
              }

              if (
                quantityAdult > dep.stockAdult ||
                quantityChild > dep.stockChild ||
                quantityBaby > dep.stockBaby
              ) {
                throw new OrderValidationError(
                  `Lịch khởi hành ${dep.code} của tour "${tour.name}" không đủ số chỗ còn lại (Người lớn: ${dep.stockAdult}, Trẻ em: ${dep.stockChild}, Em bé: ${dep.stockBaby})`,
                  409
                );
              }

              const reserved = await reserveOrderItemStock(tx, {
                tourId: tour.id,
                departureId: dep.id,
                quantityAdult,
                quantityChild,
                quantityBaby,
              });

              if (!reserved) {
                throw new OrderValidationError(
                  `Lịch khởi hành ${dep.code} của tour "${tour.name}" vừa hết chỗ khi bạn thao tác, vui lòng kiểm tra lại số lượng`,
                  409
                );
              }

              const unitAdult =
                dep.priceNewAdult > 0 ? dep.priceNewAdult : dep.priceAdult;
              const unitChild =
                dep.priceNewChild > 0 ? dep.priceNewChild : dep.priceChild;
              const unitBaby =
                dep.priceNewBaby > 0 ? dep.priceNewBaby : dep.priceBaby;
              const surchargeUnit = dep.singleRoomSurcharge;

              subTotal +=
                quantityAdult * unitAdult +
                quantityChild * unitChild +
                quantityBaby * unitBaby +
                singleRoomCount * surchargeUnit;

              snapshotItems.push({
                tour: { connect: { id: tour.id } },
                departure: { connect: { id: dep.id } },
                departureCode: dep.code,
                airline: dep.airline,
                flightOut: dep.flightOut,
                flightBack: dep.flightBack,
                name: tour.name,
                avatar: tour.avatar,
                departureDate: dep.departureDate,
                departureLocation: dep.departureLocation,
                quantityAdult,
                priceNewAdult: unitAdult,
                quantityChild,
                priceNewChild: unitChild,
                quantityBaby,
                priceNewBaby: unitBaby,
                singleRoomCount,
                singleRoomSurcharge: surchargeUnit,
                passengers: itemPassengers as unknown as Prisma.InputJsonValue,
              });
            } else {
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

              const reserved = await reserveOrderItemStock(tx, {
                tourId: tour.id,
                departureId: null,
                quantityAdult,
                quantityChild,
                quantityBaby,
              });

              if (!reserved) {
                throw new OrderValidationError(
                  `Tour "${tour.name}" vừa hết chỗ khi bạn thao tác, vui lòng kiểm tra lại số lượng`,
                  409
                );
              }

              const unitAdult =
                tour.priceNewAdult > 0 ? tour.priceNewAdult : tour.priceAdult;
              const unitChild =
                tour.priceNewChild > 0 ? tour.priceNewChild : tour.priceChild;
              const unitBaby =
                tour.priceNewBaby > 0 ? tour.priceNewBaby : tour.priceBaby;
              const surchargeUnit = tour.singleRoomSurcharge;

              subTotal +=
                quantityAdult * unitAdult +
                quantityChild * unitChild +
                quantityBaby * unitBaby +
                singleRoomCount * surchargeUnit;

              const locations = Array.isArray(tour.locations)
                ? (tour.locations as string[])
                : [];
              const departureLocation =
                String(item.departureLocation || "").trim() ||
                locations[0] ||
                "Hà Nội";

              snapshotItems.push({
                tour: { connect: { id: tour.id } },
                departureCode: null,
                airline: null,
                flightOut: null,
                flightBack: null,
                name: tour.name,
                avatar: tour.avatar,
                departureDate: tour.departureDate,
                departureLocation,
                quantityAdult,
                priceNewAdult: unitAdult,
                quantityChild,
                priceNewChild: unitChild,
                quantityBaby,
                priceNewBaby: unitBaby,
                singleRoomCount,
                singleRoomSurcharge: surchargeUnit,
                passengers: itemPassengers as unknown as Prisma.InputJsonValue,
              });
            }
          }

          const freshUser = currentUser
            ? await tx.user.findFirst({
                where: {
                  id: currentUser.id,
                  deleted: false,
                  status: RecordStatus.ACTIVE,
                },
                select: {
                  id: true,
                  loyaltyPoints: true,
                  lifetimePoints: true,
                },
              })
            : null;

          if (requestedRedeemPoints > 0 && !freshUser) {
            throw new OrderValidationError(
              "Tài khoản thành viên không khả dụng để đổi điểm",
              403
            );
          }

          const couponRes = calculateCouponDiscount(couponRaw, subTotal);
          if (!couponRes.valid) {
            throw new OrderValidationError(
              `Mã giảm giá "${couponRes.normalizedCode}" không hợp lệ hoặc đã hết hạn`,
              400
            );
          }

          if (couponRes.coupon) {
            const paidOrderCount =
              freshUser &&
              couponRes.coupon.minTier &&
              couponRes.coupon.allowPaidOrderBypass
                ? await tx.order.count({
                    where: {
                      userId: freshUser.id,
                      deleted: false,
                      status: OrderStatus.APPROVED,
                      paymentStatus: PaymentStatus.PAID,
                      refundStatus: { not: RefundStatus.REFUNDED },
                    },
                  })
                : 0;

            const memberTier = freshUser
              ? computeMemberTier(freshUser.lifetimePoints).tier
              : null;

            const eligibility = evaluateCouponEligibility(couponRes.coupon, {
              subTotal,
              isAuthenticated: Boolean(freshUser),
              memberTier,
              paidOrderCount,
            });

            if (!eligibility.eligible) {
              const errStatus = eligibility.requiresAuth
                ? 401
                : eligibility.reason?.startsWith("Mã này yêu cầu hạng")
                  ? 403
                  : 400;
              throw new OrderValidationError(
                eligibility.reason || "Mã giảm giá không đủ điều kiện áp dụng",
                errStatus
              );
            }
          }

          const discount = couponRes.discount;
          const normalizedCode = couponRes.normalizedCode;
          const postCouponSubTotal = Math.max(0, subTotal - discount);

          if (requestedRedeemPoints > 0 && freshUser) {
            const maxBySubTotal = calculateMaxRedeemablePoints(
              postCouponSubTotal,
              Number.MAX_SAFE_INTEGER
            );
            if (requestedRedeemPoints > maxBySubTotal) {
              throw new OrderValidationError(
                postCouponSubTotal === 0
                  ? "Không thể quy đổi điểm cho đơn hàng có giá trị sau giảm giá bằng 0đ"
                  : `Số điểm quy đổi tối đa cho đơn này là ${maxBySubTotal.toLocaleString("vi-VN")} điểm (tối đa 20% giá trị đơn)`,
                400
              );
            }

            const maxRedeemable = calculateMaxRedeemablePoints(
              postCouponSubTotal,
              freshUser.loyaltyPoints
            );
            if (requestedRedeemPoints > maxRedeemable) {
              throw new InsufficientPointsError();
            }
          }

          const pointsRedeemed = requestedRedeemPoints;
          const pointsDiscount = pointsRedeemed * POINT_VALUE_VND;
          const total = Math.max(0, postCouponSubTotal - pointsDiscount);

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

          const expiresAt =
            paymentMethod === PaymentMethod.CASH
              ? null
              : new Date(Date.now() + ORDER_HOLD_TTL_MS);

          const createdOrder = await tx.order.create({
            data: {
              code: nextCode,
              userId: freshUser?.id ?? null,
              fullName,
              phone,
              email,
              note,
              subTotal,
              discount,
              couponCode: normalizedCode,
              total,
              pointsRedeemed,
              pointsDiscount,
              pointsEarned: 0,
              paymentMethod,
              paymentStatus: PaymentStatus.UNPAID,
              refundStatus: RefundStatus.NONE,
              status: OrderStatus.INITIAL,
              expiresAt,
              agreedTerms: true,
              items: {
                create: snapshotItems,
              },
            },
            include: {
              items: true,
            },
          });

          if (pointsRedeemed > 0 && freshUser) {
            await redeemPointsForOrderTx(tx, {
              userId: freshUser.id,
              orderId: createdOrder.id,
              orderCode: createdOrder.code,
              pointsToRedeem: pointsRedeemed,
            });
          }

          return { createdOrder, allOrderPassengers };
        });
        order = txResult.createdOrder;
        orderPassengersSnapshot = txResult.allOrderPassengers;
        break;
      } catch (err) {
        const isCodeCollision =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002" &&
          Array.isArray(err.meta?.target) &&
          err.meta.target.includes("code");
        if (isCodeCollision && attempt < 2) {
          continue;
        }
        throw err;
      }
    }

    revalidateClientToursCache();

    if (saveTravelers && currentUser && order) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT "id" FROM "User" WHERE "id" = ${currentUser.id} FOR UPDATE`;

          const existingTravelers = await tx.savedTraveler.findMany({
            where: { userId: currentUser.id },
            select: { fullName: true, birthDate: true },
          });
          const seenKeys = new Set(
            existingTravelers.map(
              (t) =>
                `${t.fullName.trim().toLowerCase().replace(/\s+/g, " ")}|${t.birthDate.trim()}`
            )
          );
          let remainingSlots = Math.max(0, 20 - existingTravelers.length);
          const toCreate: Prisma.SavedTravelerCreateManyInput[] = [];

          for (const p of orderPassengersSnapshot) {
            if (remainingSlots <= 0) break;
            const normalizedBirthDate = p.birthDate.trim();
            if (!isValidCalendarBirthDate(normalizedBirthDate)) continue;
            const normalizedFullName = p.fullName.trim().replace(/\s+/g, " ");
            const key = `${normalizedFullName.toLowerCase()}|${normalizedBirthDate}`;
            if (seenKeys.has(key)) continue;
            seenKeys.add(key);
            remainingSlots -= 1;
            const trimmedDoc = p.documentNumber?.trim() || "";
            toCreate.push({
              userId: currentUser.id,
              fullName: normalizedFullName,
              gender: p.gender,
              birthDate: normalizedBirthDate,
              defaultTier: p.tier,
              documentNumber: trimmedDoc ? trimmedDoc.slice(0, 30) : null,
              relationship: null,
            });
          }

          if (toCreate.length > 0) {
            await tx.savedTraveler.createMany({ data: toCreate });
          }
        });
      } catch {
        // Best-effort saved travelers must never fail order creation
      }
    }

    if (order && order.email) {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const voucherUrl = `${baseUrl}/orders/${encodeURIComponent(
        order.code
      )}/voucher?phone=${encodeURIComponent(order.phone)}`;

      try {
        await sendOrderConfirmationEmail({
          to: order.email,
          orderCode: order.code,
          fullName: order.fullName,
          total: order.total,
          paymentStatus: order.paymentStatus,
          voucherUrl,
          items: order.items,
        });
      } catch {
        // Best-effort email must never block order creation
      }
    }

    const claimToken =
      !currentUser && order && order.email && order.phone
        ? signOrderClaimToken({
            orderId: order.id,
            orderCode: order.code,
            email: order.email,
            phone: order.phone,
          })
        : undefined;

    return NextResponse.json(
      {
        message: "Đặt tour thành công!",
        order,
        ...(claimToken ? { claimToken } : {}),
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
    if (error instanceof InsufficientPointsError) {
      return NextResponse.json(
        { message: error.message, code: error.code },
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
