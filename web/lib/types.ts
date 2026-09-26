// Shared types for the whole app. Keep all data shapes here.

// One row of the orders CSV = one item in someone's order.
export interface OrderItem {
  batchId: string;
  orderDate: string; // e.g. "2026-06-01"
  orderId: string;
  householdId: string;
  destinationCommunity: string;
  productId?: string;
  productName: string;
  weightLb: number;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
}

export type OrderStatus = "entered" | "submitted" | "picking" | "picked";

// One household order = all items with the same orderId.
export interface Order {
  orderId: string;
  householdId: string;
  batchId: string;
  orderDate: string;
  destinationCommunity: string;
  items: OrderItem[];
  totalWeightLb: number;
  totalVolumeCuIn: number;
  status: OrderStatus;
}

// The tote (box). Internal size 23.5 x 14 x 11 in ≈ 3,619 cu in.
export const TOTE = {
  lengthIn: 23.5,
  widthIn: 14,
  heightIn: 11,
  volumeCuIn: 23.5 * 14 * 11,
  // OUR assumption — the brief demands a per-tote weight check but gives no
  // number. 50 lb = safe one-person lift. Operator-adjustable in the UI.
  maxWeightLb: 50,
  // Nominal footprint used for AIRCRAFT volume accounting: the brief's
  // "roughly 3,600 cu in" figure. The Stage 2 capacity CSV matches this
  // exactly (available_volume_cuft = totes x 2.0833).
  nominalVolumeCuFt: 3600 / 1728,
};

export interface Tote {
  toteId: string;
  // orderIds whose items (or part of them) are in this tote
  contents: { orderId: string; items: OrderItem[] }[];
  weightLb: number;
  volumeCuIn: number;
  fillPercent: number; // volume used / tote volume
  cartId?: string;
}

export interface Cart {
  cartId: string;
  toteIds: string[];
}

// One departure (from flight_capacity CSV in Stage 2,
// or the full plane in Stage 1).
export interface Flight {
  departureId: string;
  departureDate: string;
  availableTotes: number;
  availablePayloadLb: number;
  availableVolumeCuFt: number;
  loadedToteIds: string[];
}

// Cessna 208 Caravan reference numbers (Nakina -> Webequie).
export const AIRCRAFT = {
  maxTotes: 90,
  payloadLb: 2877,
  cargoVolumeCuFt: 90 * (3600 / 1728), // 187.5, matches the capacity data

  // Published cabin figures; confirm & cite source in the flight tab UI.
  cabinWidthIn: 64,
  cabinHeightIn: 54,
  cabinLengthIn: 150, // 12.5 ft (208); 208B is ~4 ft longer
};
