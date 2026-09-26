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

function fits(
  tote: Tote,
  weightLb: number,
  volumeCuIn: number,
  maxWeightLb: number,
): boolean {
  return (
    tote.weightLb + weightLb <= maxWeightLb &&
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

// maxToteWeightLb is OUR assumption (no number in the challenge materials),
// so it is a parameter the UI can change. Default: safe one-person lift.
export function packOrdersIntoTotes(
  orders: Order[],
  maxToteWeightLb: number = TOTE.maxWeightLb,
): Tote[] {
  const totes: Tote[] = [];
  // Largest orders first: big orders claim fresh totes, small ones
  // fill the gaps left behind.
  const sorted = [...orders].sort(
    (a, b) => b.totalVolumeCuIn - a.totalVolumeCuIn,
  );

  for (const order of sorted) {
    const wholeOrderFits =
      order.totalWeightLb <= maxToteWeightLb &&
      order.totalVolumeCuIn <= TOTE.volumeCuIn;

    if (wholeOrderFits) {
      const tote =
        totes.find((t) =>
          fits(t, order.totalWeightLb, order.totalVolumeCuIn, maxToteWeightLb),
        ) ?? makeTote(totes);
      addToTote(tote, order.orderId, order.items);
    } else {
      splitOrderAcrossTotes(order, totes, maxToteWeightLb);
    }
  }
  return totes;
}

// An order that cannot fit one tote fills its own run of totes,
// largest items first. Its last tote is left open, so later
// (smaller) whole orders can still top it up via first-fit above.
function splitOrderAcrossTotes(
  order: Order,
  totes: Tote[],
  maxToteWeightLb: number,
) {
  const ownTotes: Tote[] = [];
  const items = [...order.items].sort((a, b) => itemVolume(b) - itemVolume(a));

  for (const item of items) {
    const w = item.weightLb;
    const v = itemVolume(item);
    let target = ownTotes.find((t) => fits(t, w, v, maxToteWeightLb));
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

// Rule: every tote of a given order rides the same cart, so a split
// order is picked in one trip. Totes linked by a shared order form a
// group; groups are placed on carts whole, in tote order.
export function assignTotesToCarts(
  totes: Tote[],
  totesPerCart: number = 5,
): Cart[] {
  const groups = groupLinkedTotes(totes);
  const carts: Cart[] = [];
  let current: string[] = [];

  const flush = () => {
    if (current.length === 0) return;
    carts.push({ cartId: `C${carts.length + 1}`, toteIds: current });
    current = [];
  };

  for (const group of groups) {
    if (current.length + group.length > totesPerCart) flush();
    current.push(...group.map((t) => t.toteId));
    // A single group bigger than a cart still stays together: that cart
    // simply runs oversized rather than splitting the order's totes.
    if (current.length >= totesPerCart) flush();
  }
  flush();

  // Stamp the cart back onto each tote for the UI.
  const cartOfTote = new Map(
    carts.flatMap((c) => c.toteIds.map((id) => [id, c.cartId] as const)),
  );
  for (const tote of totes) tote.cartId = cartOfTote.get(tote.toteId);
  return carts;
}

// Connected components: totes sharing any orderId belong together.
function groupLinkedTotes(totes: Tote[]): Tote[][] {
  const parent = totes.map((_, i) => i);
  const find = (i: number): number =>
    parent[i] === i ? i : (parent[i] = find(parent[i]));
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };

  const firstToteOfOrder = new Map<string, number>();
  totes.forEach((tote, i) => {
    for (const { orderId } of tote.contents) {
      const seen = firstToteOfOrder.get(orderId);
      if (seen === undefined) firstToteOfOrder.set(orderId, i);
      else union(i, seen);
    }
  });

  const groups = new Map<number, Tote[]>();
  totes.forEach((tote, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), tote]);
  });
  // Keep picking order stable: groups sorted by their first tote.
  return [...groups.values()];
}
