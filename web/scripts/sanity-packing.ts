// Sanity check for lib/packing.ts against the real challenge data.
// The data folder is not in git — get it from Prajith.
// Run from web/:  npx tsx scripts/sanity-packing.ts

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { groupIntoOrders, parseOrdersCsvText } from "../lib/csv";
import { assignTotesToCarts, packOrdersIntoTotes } from "../lib/packing";
import { TOTE } from "../lib/types";

const DATA = join(__dirname, "../../Wilderness North");
const stages = [
  ["Stage 1", join(DATA, "Stage 1/contestant_stage1_orders (1).csv")],
  ["Stage 2", join(DATA, "Stage 2/contestant_stage2_orders.csv")],
] as const;

let failed = false;
function check(ok: boolean, msg: string) {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) failed = true;
}

for (const [name, path] of stages) {
  const orders = groupIntoOrders(parseOrdersCsvText(readFileSync(path, "utf8")));
  const totes = packOrdersIntoTotes(orders);

  console.log(`\n=== ${name}: ${orders.length} orders -> ${totes.length} totes ===`);

  // No tote breaks its limits (oversized single items excepted by design).
  const overweight = totes.filter((t) => t.weightLb > TOTE.maxWeightLb + 1e-9);
  const overfull = totes.filter((t) => t.volumeCuIn > TOTE.volumeCuIn + 1e-9);
  check(overweight.length === 0, `no tote over ${TOTE.maxWeightLb} lb (${overweight.length} over)`);
  check(overfull.length === 0, `no tote over ${TOTE.volumeCuIn.toFixed(0)} cu in (${overfull.length} over)`);

  // Nothing lost, nothing duplicated: item counts match.
  const itemsIn = orders.reduce((s, o) => s + o.items.length, 0);
  const itemsOut = totes.reduce(
    (s, t) => s + t.contents.reduce((s2, c) => s2 + c.items.length, 0),
    0,
  );
  check(itemsIn === itemsOut, `all ${itemsIn} items packed exactly once (got ${itemsOut})`);

  // Fewer totes than orders (sharing actually happens).
  check(totes.length < orders.length, `sharing works: ${totes.length} totes < ${orders.length} orders`);

  // Split orders are traceable.
  const totesByOrder = new Map<string, string[]>();
  for (const t of totes)
    for (const c of t.contents)
      totesByOrder.set(c.orderId, [...(totesByOrder.get(c.orderId) ?? []), t.toteId]);
  const split = [...totesByOrder.entries()].filter(([, ids]) => ids.length > 1);
  console.log(`  info: ${split.length} orders split across totes: ${split.map(([id, ids]) => `${id}(${ids.length})`).join(", ") || "none"}`);

  const avgFill = totes.reduce((s, t) => s + t.fillPercent, 0) / totes.length;
  const totalW = totes.reduce((s, t) => s + t.weightLb, 0);
  console.log(`  info: avg fill ${avgFill.toFixed(0)}%, total weight ${totalW.toFixed(0)} lb, heaviest tote ${Math.max(...totes.map((t) => t.weightLb)).toFixed(1)} lb`);

  // Carts: capacity respected, split orders stay on one cart.
  const carts = assignTotesToCarts(totes, 5);
  const cartOfTote = new Map(carts.flatMap((c) => c.toteIds.map((t) => [t, c.cartId] as const)));
  const brokenOrders = split.filter(([, toteIds]) => new Set(toteIds.map((t) => cartOfTote.get(t))).size > 1);
  check(carts.every((c) => c.toteIds.length <= 5), `no cart over 5 totes (max ${Math.max(...carts.map((c) => c.toteIds.length))})`);
  check(brokenOrders.length === 0, `every split order rides one cart (${brokenOrders.length} broken)`);
  check(totes.every((t) => cartOfTote.has(t.toteId)), "every tote is on a cart");
  console.log(`  info: ${carts.length} carts: ${carts.map((c) => c.toteIds.length).join(", ")} totes`);
}

console.log(failed ? "\nSANITY FAILED" : "\nALL SANITY CHECKS PASSED");
process.exit(failed ? 1 : 0);
