// CSV parsing. The orders CSV has one row per item:
// batch_id,order_date,order_id,household_id,destination_community,
// product_id,product_name,weight_lb,length_in,width_in,height_in
//
// Judges will upload a FRESH csv, so never hard-code data.

import Papa from "papaparse";
import type { Flight, Order, OrderItem } from "./types";

// The brief warns: "Exact column names will be confirmed in the dataset
// provided at the start of the event." So headers are normalized
// (lowercase, punctuation -> underscore: "Weight (lb)" -> weight_lb) and
// common renames are mapped to our canonical names.
const HEADER_ALIASES: Record<string, string> = {
  order: "order_id",
  orderid: "order_id",
  order_no: "order_no", // placeholder, replaced below
  order_number: "order_id",
  household: "household_id",
  householdid: "household_id",
  hh_id: "household_id",
  customer_id: "household_id",
  item: "product_name",
  item_name: "product_name",
  product: "product_name",
  productname: "product_name",
  sku: "product_id",
  productid: "product_id",
  weight: "weight_lb",
  weight_lbs: "weight_lb",
  weightlb: "weight_lb",
  length: "length_in",
  length_inches: "length_in",
  width: "width_in",
  width_inches: "width_in",
  height: "height_in",
  height_inches: "height_in",
  depth: "height_in",
  date: "order_date",
  orderdate: "order_date",
  community: "destination_community",
  destination: "destination_community",
  dest: "destination_community",
  batch: "batch_id",
  batchid: "batch_id",
  // flight capacity file
  departure: "departure_id",
  departureid: "departure_id",
  flight_id: "departure_id",
  flight_date: "departure_date",
  departuredate: "departure_date",
  totes: "available_totes",
  max_totes: "available_totes",
  tote_capacity: "available_totes",
  payload: "available_payload_lb",
  payload_lb: "available_payload_lb",
  max_payload_lb: "available_payload_lb",
  volume: "available_volume_cuft",
  volume_cuft: "available_volume_cuft",
  space_cuft: "available_volume_cuft",
  cargo_volume_cuft: "available_volume_cuft",
};
HEADER_ALIASES.order_no = "order_id";

function normalizeHeader(header: string): string {
  const key = header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return HEADER_ALIASES[key] ?? key;
}

// Tolerant number parse: strips units and thousands separators
// ("1,046 lb" -> 1046).
function num(value: string | undefined): number {
  return Number(String(value ?? "").replace(/[^0-9.eE+-]/g, ""));
}

const PARSE_OPTIONS = {
  header: true as const,
  skipEmptyLines: true as const,
  transformHeader: normalizeHeader,
};

// Same parser but from raw CSV text (used by tests and any
// "load sample data" button).
export function parseOrdersCsvText(text: string): OrderItem[] {
  const results = Papa.parse<Record<string, string>>(text, PARSE_OPTIONS);
  return results.data.map(rowToItem);
}

export function parseOrdersCsv(file: File): Promise<OrderItem[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      ...PARSE_OPTIONS,
      complete: (results) => {
        try {
          const items = results.data.map(rowToItem);
          resolve(items);
        } catch (e) {
          reject(e);
        }
      },
      error: reject,
    });
  });
}

function rowToItem(row: Record<string, string>): OrderItem {
  return {
    batchId: row.batch_id ?? "",
    orderDate: row.order_date ?? "",
    orderId: row.order_id ?? "",
    householdId: row.household_id ?? "",
    destinationCommunity: row.destination_community ?? "",
    productId: row.product_id,
    productName: row.product_name ?? "",
    weightLb: num(row.weight_lb),
    lengthIn: num(row.length_in),
    widthIn: num(row.width_in),
    heightIn: num(row.height_in),
  };
}

// Group item rows into household orders.
export function groupIntoOrders(items: OrderItem[]): Order[] {
  const byOrder = new Map<string, OrderItem[]>();
  for (const item of items) {
    const list = byOrder.get(item.orderId) ?? [];
    list.push(item);
    byOrder.set(item.orderId, list);
  }
  return [...byOrder.entries()].map(([orderId, orderItems]) => {
    const first = orderItems[0];
    return {
      orderId,
      householdId: first.householdId,
      batchId: first.batchId,
      orderDate: first.orderDate,
      destinationCommunity: first.destinationCommunity,
      items: orderItems,
      totalWeightLb: sum(orderItems.map((i) => i.weightLb)),
      totalVolumeCuIn: sum(
        orderItems.map((i) => i.lengthIn * i.widthIn * i.heightIn),
      ),
      status: "entered" as const,
    };
  });
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

// Flight capacity CSV (Stage 2):
// departure_id,departure_date,available_totes,available_payload_lb,available_volume_cuft
export function parseFlightCapacityCsvText(text: string): Flight[] {
  const results = Papa.parse<Record<string, string>>(text, PARSE_OPTIONS);
  return results.data.map((row) => ({
    departureId: row.departure_id ?? "",
    departureDate: row.departure_date ?? "",
    availableTotes: num(row.available_totes),
    availablePayloadLb: num(row.available_payload_lb),
    availableVolumeCuFt: num(row.available_volume_cuft),
    loadedToteIds: [],
  }));
}

export async function parseFlightCapacityCsv(file: File): Promise<Flight[]> {
  return parseFlightCapacityCsvText(await file.text());
}
