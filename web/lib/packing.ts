// Tote packing (bin packing) — Person A1.
//
// Strategy: first-fit decreasing.
// 1. Sort orders largest-first (by volume).
// 2. Place each whole order into the first tote where its weight AND volume fit.
// 3. An order too large for one tote is split across totes item by item.
// Goals: fewest totes, keep whole orders together when possible.

import type { Cart, Order, OrderItem, Tote } from "./types";
import { TOTE } from "./types";

const itemVolume = (i: OrderItem) => i.lengthIn * i.widthIn * i.heightIn;

function makeTote(totes: Tote[]): Tote {
  const tote: Tote = {
    toteId: `T${totes.length + 1}`,
    contents: [],
    weightLb: 0,
    volumeCuIn: 0,
    fillPercent: 0,
  };
  totes.push(tote);
  return tote;
}

function fits(tote: Tote, weightLb: number, volumeCuIn: number): boolean {
  return (
    tote.weightLb + weightLb <= TOTE.maxWeightLb &&
    tote.volumeCuIn + volumeCuIn <= TOTE.volumeCuIn
  );
}

function addToTote(tote: Tote, orderId: string, items: OrderItem[]) {
  let entry = tote.contents.find((c) => c.orderId === orderId);
  if (!entry) {
    entry = { orderId, items: [] };
    tote.contents.push(entry);
  }
  entry.items.push(...items);
  tote.weightLb += items.reduce((s, i) => s + i.weightLb, 0);
  tote.volumeCuIn += items.reduce((s, i) => s + itemVolume(i), 0);
  tote.fillPercent = (tote.volumeCuIn / TOTE.volumeCuIn) * 100;
}

export function packOrdersIntoTotes(orders: Order[]): Tote[] {
  const totes: Tote[] = [];
  // Largest orders first: big orders claim fresh totes, small ones
  // fill the gaps left behind.
  const sorted = [...orders].sort(
    (a, b) => b.totalVolumeCuIn - a.totalVolumeCuIn,
  );

  for (const order of sorted) {
    const wholeOrderFits =
      order.totalWeightLb <= TOTE.maxWeightLb &&
      order.totalVolumeCuIn <= TOTE.volumeCuIn;

    if (wholeOrderFits) {
      const tote =
        totes.find((t) => fits(t, order.totalWeightLb, order.totalVolumeCuIn)) ??
        makeTote(totes);
      addToTote(tote, order.orderId, order.items);
    } else {
      splitOrderAcrossTotes(order, totes);
    }
  }
  return totes;
}

// An order that cannot fit one tote fills its own run of totes,
// largest items first. Its last tote is left open, so later
// (smaller) whole orders can still top it up via first-fit above.
function splitOrderAcrossTotes(order: Order, totes: Tote[]) {
  const ownTotes: Tote[] = [];
  const items = [...order.items].sort((a, b) => itemVolume(b) - itemVolume(a));

  for (const item of items) {
    const w = item.weightLb;
    const v = itemVolume(item);
    let target = ownTotes.find((t) => fits(t, w, v));
    if (!target) {
      target = makeTote(totes);
      ownTotes.push(target);
    }
    // If a single item alone exceeds the tote limits, it still goes in a
    // tote of its own rather than crashing; the UI will show >100% fill
    // so staff can deal with it.
    addToTote(target, order.orderId, [item]);
  }
}

export function assignTotesToCarts(
  totes: Tote[],
  totesPerCart: number = 5,
): Cart[] {
  // TODO(Person A1): keep every tote of a given order on the same cart.
  void totes;
  void totesPerCart;
  throw new Error("assignTotesToCarts not implemented yet");
}
