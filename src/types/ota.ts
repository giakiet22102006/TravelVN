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
