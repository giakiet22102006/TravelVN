export type TourTagCode =
  | "NO_SHOP"
  | "BAY_THANG"
  | "GIA_DINH"
  | "NGHI_DUONG"
  | "KHUYEN_MAI";

export const TOUR_TAG_LABELS: Record<TourTagCode | string, string> = {
  NO_SHOP: "Không mua sắm",
  BAY_THANG: "Bay thẳng",
  GIA_DINH: "Phù hợp gia đình",
  NGHI_DUONG: "Nghỉ dưỡng cao cấp",
  KHUYEN_MAI: "Ưu đãi đặc biệt",
};

export interface TourWaypoint {
  day: number;
  label: string;
  lat: number;
  lng: number;
  note?: string;
}

export interface TourDeparturePublic {
  id: string;
  tourId: string;
  code: string;
  departureDate: string;
  returnDate: string | null;
  departureLocation: string;
  airline: string | null;
  flightOut: string | null;
  flightBack: string | null;
  hotelStar: number;
  priceAdult: number;
  priceChild: number;
  priceBaby: number;
  priceNewAdult: number;
  priceNewChild: number;
  priceNewBaby: number;
  singleRoomSurcharge: number;
  stockAdult: number;
  stockChild: number;
  stockBaby: number;
}

export interface OrderPassengerInput {
  fullName: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  birthDate: string;
  tier: "ADULT" | "CHILD" | "BABY";
  documentNumber?: string;
}

export type MemberTier = "BRONZE" | "SILVER" | "GOLD";

export interface MemberTierInfo {
  tier: MemberTier;
  label: string;
  nextTier: MemberTier | null;
  nextTierMinPoints: number | null;
  progressPercent: number;
  pointsToNext: number;
}

export interface SavedTravelerItem {
  id: string;
  fullName: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  birthDate: string;
  defaultTier: "ADULT" | "CHILD" | "BABY";
  documentNumber: string | null;
  relationship: string | null;
  createdAt: string;
  updatedAt: string;
}

export type LoyaltyTransactionType =
  | "WELCOME_BONUS"
  | "ORDER_EARN"
  | "ORDER_REDEEM"
  | "ORDER_REDEEM_REFUND"
  | "ORDER_REFUND_REVOKE";

export interface LoyaltyTransactionItem {
  id: string;
  orderId: string | null;
  type: LoyaltyTransactionType;
  points: number;
  description: string;
  createdAt: string;
}

export type ClaimOrderPayload =
  | {
      mode: "quick-register";
      claimToken: string;
      password: string;
      fullName?: string;
    }
  | {
      mode: "link";
      claimToken?: string;
      orderCode?: string;
      phone?: string;
    };
