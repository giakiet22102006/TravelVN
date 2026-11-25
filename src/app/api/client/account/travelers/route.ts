import { NextRequest, NextResponse } from "next/server";
import type { SavedTraveler } from "@prisma/client";
import { getCurrentUser } from "@/lib/client-auth";
import { prisma } from "@/lib/prisma";
import type { SavedTravelerItem } from "@/types/ota";

export const dynamic = "force-dynamic";

const MAX_SAVED_TRAVELERS = 20;
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

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { message: "Vui lòng đăng nhập để xem Sổ hành khách." },
        { status: 401 }
      );
    }

    const rows = await prisma.savedTraveler.findMany({
      where: { userId: currentUser.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    return NextResponse.json({
      travelers: rows.map(serializeTraveler),
    });
  } catch (error) {
    console.error("[GET /api/client/account/travelers] Error:", error);
    return NextResponse.json(
      { message: "Không thể tải danh sách hành khách." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { message: "Vui lòng đăng nhập để lưu hành khách." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = parseAndValidateTravelerBody(body);
    const normalizedName = normalizeTravelerName(parsed.fullName);

    const created = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "User" WHERE "id" = ${currentUser.id} FOR UPDATE
      `;

      const existing = await tx.savedTraveler.findMany({
        where: { userId: currentUser.id },
        select: { id: true, fullName: true, birthDate: true },
      });

      if (existing.length >= MAX_SAVED_TRAVELERS) {
        throw new TravelerApiError(
          400,
          `Sổ hành khách đã đạt giới hạn tối đa ${MAX_SAVED_TRAVELERS} người.`
        );
      }

      const duplicate = existing.some(
        (t) =>
          normalizeTravelerName(t.fullName) === normalizedName &&
          t.birthDate === parsed.birthDate
      );
      if (duplicate) {
        throw new TravelerApiError(
          409,
          "Hành khách này đã có trong Sổ hành khách."
        );
      }

      return tx.savedTraveler.create({
        data: {
          userId: currentUser.id,
          fullName: parsed.fullName,
          gender: parsed.gender,
          birthDate: parsed.birthDate,
          defaultTier: parsed.defaultTier,
          documentNumber: parsed.documentNumber,
          relationship: parsed.relationship,
        },
      });
    });

    return NextResponse.json(
      {
        message: "Đã thêm hành khách vào sổ!",
        traveler: serializeTraveler(created),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof TravelerApiError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status }
      );
    }
    console.error("[POST /api/client/account/travelers] Error:", error);
    return NextResponse.json(
      { message: "Không thể thêm hành khách lúc này." },
      { status: 500 }
    );
  }
}
