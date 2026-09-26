// Tote packing (bin packing) — TO BUILD (Person A).
//
// Plan: first-fit decreasing.
// 1. Sort orders largest-first (by volume).
// 2. Place each order into the first tote where its weight AND volume fit.
// 3. If an order fits no single tote, split it across totes item by item.
// Goals: fewest totes, keep whole orders together when possible.
//
// Then assign totes to carts (default 5 per cart, configurable) keeping
// all totes of one order on the same cart.

import type { Cart, Order, Tote } from "./types";

export function packOrdersIntoTotes(orders: Order[]): Tote[] {
  // TODO(Person A): implement first-fit decreasing with order splitting.
  void orders;
  throw new Error("packOrdersIntoTotes not implemented yet");
}

export function assignTotesToCarts(
  totes: Tote[],
  totesPerCart: number = 5,
): Cart[] {
  // TODO(Person A): keep every tote of a given order on the same cart.
  void totes;
  void totesPerCart;
  throw new Error("assignTotesToCarts not implemented yet");
}
