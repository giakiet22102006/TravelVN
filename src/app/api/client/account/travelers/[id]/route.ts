import { NextRequest, NextResponse } from "next/server";
import { Prisma, type SavedTraveler } from "@prisma/client";
import { getCurrentUser } from "@/lib/client-auth";
import { prisma } from "@/lib/prisma";
import type { SavedTravelerItem } from "@/types/ota";

export const dynamic = "force-dynamic";

const VALID_GENDERS = new Set<SavedTravelerItem["gender"]>([
  "MALE",
  "FEMALE",
  "OTHER",
]);
const VALID_TIERS = new Set<SavedTravelerItem["defaultTier"]>([
  "ADULT",
  "CHILD",
  "BABY",
]);

class TravelerApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface ParsedTravelerInput {
  fullName: string;
  gender: SavedTravelerItem["gender"];
  birthDate: string;
  defaultTier: SavedTravelerItem["defaultTier"];
  documentNumber: string | null;
  relationship: string | null;
}

function serializeTraveler(row: SavedTraveler): SavedTravelerItem {
  return {
    id: row.id,
    fullName: row.fullName,
    gender: row.gender as SavedTravelerItem["gender"],
    birthDate: row.birthDate,
    defaultTier: row.defaultTier as SavedTravelerItem["defaultTier"],
    documentNumber: row.documentNumber,
    relationship: row.relationship,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function normalizeTravelerName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function parseOptionalText(
  value: unknown,
  fieldLabel: string,
  maxLen: number
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new TravelerApiError(400, `${fieldLabel} không hợp lệ.`);
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLen) {
    throw new TravelerApiError(
      400,
      `${fieldLabel} không được vượt quá ${maxLen} ký tự.`
    );
  }
  return trimmed;
}

function parseAndValidateTravelerBody(body: unknown): ParsedTravelerInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new TravelerApiError(400, "Dữ liệu hành khách không hợp lệ.");
  }

  const record = body as Record<string, unknown>;

  if (typeof record.fullName !== "string") {
    throw new TravelerApiError(400, "Họ tên hành khách không hợp lệ.");
  }
  const fullName = record.fullName.trim().replace(/\s+/g, " ");
  if (fullName.length < 2 || fullName.length > 100) {
    throw new TravelerApiError(
      400,
      "Họ tên hành khách phải từ 2 đến 100 ký tự."
    );
  }

  const genderRaw =
    typeof record.gender === "string"
      ? record.gender.trim().toUpperCase()
      : "";
  if (!VALID_GENDERS.has(genderRaw as SavedTravelerItem["gender"])) {
    throw new TravelerApiError(
      400,
      "Giới tính phải là MALE, FEMALE hoặc OTHER."
    );
  }
  const gender = genderRaw as SavedTravelerItem["gender"];

  const tierRaw =
    typeof record.defaultTier === "string"
      ? record.defaultTier.trim().toUpperCase()
      : "";
  if (!VALID_TIERS.has(tierRaw as SavedTravelerItem["defaultTier"])) {
    throw new TravelerApiError(
      400,
      "Nhóm khách phải là ADULT, CHILD hoặc BABY."
    );
  }
  const defaultTier = tierRaw as SavedTravelerItem["defaultTier"];

  const birthDate =
    typeof record.birthDate === "string" ? record.birthDate.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    throw new TravelerApiError(
      400,
      "Ngày sinh phải đúng định dạng YYYY-MM-DD."
    );
  }

  const [year, month, day] = birthDate.split("-").map(Number);
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) {
    throw new TravelerApiError(400, "Ngày sinh không hợp lệ.");
  }

  const utcCheck = new Date(Date.UTC(year, month - 1, day));
  if (
    utcCheck.getUTCFullYear() !== year ||
    utcCheck.getUTCMonth() !== month - 1 ||
    utcCheck.getUTCDate() !== day
  ) {
    throw new TravelerApiError(400, "Ngày sinh không tồn tại trên lịch.");
  }

  const todayVN = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());
  if (birthDate > todayVN) {
    throw new TravelerApiError(
      400,
      "Ngày sinh không được lớn hơn ngày hiện tại."
    );
  }

  const documentNumber = parseOptionalText(
    record.documentNumber,
    "Số CCCD / Hộ chiếu",
    30
  );
  const relationship = parseOptionalText(
    record.relationship,
    "Quan hệ",
    50
  );

  return {
    fullName,
    gender,
    birthDate,
    defaultTier,
    documentNumber,
    relationship,
  };
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { message: "Vui lòng đăng nhập để cập nhật hành khách." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const travelerId = id.trim();
    if (!travelerId) {
      return NextResponse.json(
        { message: "Mã hành khách không hợp lệ." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = parseAndValidateTravelerBody(body);
    const normalizedName = normalizeTravelerName(parsed.fullName);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "User" WHERE "id" = ${currentUser.id} FOR UPDATE
      `;

      const existingList = await tx.savedTraveler.findMany({
        where: { userId: currentUser.id },
        select: { id: true, fullName: true, birthDate: true },
      });

      const target = existingList.find((t) => t.id === travelerId);
      if (!target) {
        throw new TravelerApiError(404, "Không tìm thấy hành khách.");
      }

      const duplicate = existingList.some(
        (t) =>
          t.id !== travelerId &&
          normalizeTravelerName(t.fullName) === normalizedName &&
          t.birthDate === parsed.birthDate
      );
      if (duplicate) {
        throw new TravelerApiError(
          409,
          "Đã tồn tại hành khách khác có cùng họ tên và ngày sinh."
        );
      }

      return tx.savedTraveler.update({
        where: { id: travelerId },
        data: {
          fullName: parsed.fullName,
          gender: parsed.gender,
          birthDate: parsed.birthDate,
          defaultTier: parsed.defaultTier,
          documentNumber: parsed.documentNumber,
          relationship: parsed.relationship,
        },
      });
    });

    return NextResponse.json({
      message: "Cập nhật hành khách thành công!",
      traveler: serializeTraveler(updated),
    });
  } catch (error) {
    if (error instanceof TravelerApiError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status }
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { message: "Không tìm thấy hành khách." },
        { status: 404 }
      );
    }
    console.error("[PUT /api/client/account/travelers/[id]] Error:", error);
    return NextResponse.json(
      { message: "Không thể cập nhật hành khách lúc này." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { message: "Vui lòng đăng nhập để xóa hành khách." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const travelerId = id.trim();
    if (!travelerId) {
      return NextResponse.json(
        { message: "Mã hành khách không hợp lệ." },
        { status: 400 }
      );
    }

    const deleted = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "User" WHERE "id" = ${currentUser.id} FOR UPDATE
      `;
      return tx.savedTraveler.deleteMany({
        where: { id: travelerId, userId: currentUser.id },
      });
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { message: "Không tìm thấy hành khách." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Đã xóa hành khách khỏi sổ!",
    });
  } catch (error) {
    console.error("[DELETE /api/client/account/travelers/[id]] Error:", error);
    return NextResponse.json(
      { message: "Không thể xóa hành khách lúc này." },
      { status: 500 }
    );
  }
}
