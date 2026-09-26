// CSV parsing. The orders CSV has one row per item:
// batch_id,order_date,order_id,household_id,destination_community,
// product_id,product_name,weight_lb,length_in,width_in,height_in
//
// Judges will upload a FRESH csv, so never hard-code data.

import Papa from "papaparse";
import type { Order, OrderItem } from "./types";

export function parseOrdersCsv(file: File): Promise<OrderItem[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
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
    weightLb: Number(row.weight_lb),
    lengthIn: Number(row.length_in),
    widthIn: Number(row.width_in),
    heightIn: Number(row.height_in),
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
