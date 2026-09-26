// Sanity check for the bonus objective: three communities, per-route
// payloads, and the combined-trip comparison.
// Run from web/:  npx tsx scripts/sanity-routes.ts

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { groupIntoOrders, parseOrdersCsvText } from "../lib/csv";
import { packOrdersByBatch } from "../lib/packing";
import { planRoutes, routeFor, toteCommunity } from "../lib/routes";
import { TOTE } from "../lib/types";

const CANDIDATES = [
  join(__dirname, "../../Wilderness North Bonus/Bonus/bonus_challange.csv"),
  join(
    process.env.HOME ?? "",
    "Downloads/Wilderness North Bonus/Bonus/bonus_challange.csv",
  ),
];
const path = CANDIDATES.find((p) => existsSync(p));
if (!path) {
  console.error("bonus_challange.csv not found — get it from Prajith");
  process.exit(1);
}

let failed = false;
function check(ok: boolean, msg: string) {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) failed = true;
}

const orders = groupIntoOrders(parseOrdersCsvText(readFileSync(path, "utf8")));
const totes = packOrdersByBatch(orders);
const plan = planRoutes(totes);

console.log(`\n=== Bonus: ${orders.length} orders -> ${totes.length} totes -> ${plan.flights.length} flights ===`);

// Totes never mix communities.
const mixed = totes.filter(
  (t) =>
    new Set(t.contents.flatMap((c) => c.items.map((i) => i.destinationCommunity)))
      .size > 1,
);
check(mixed.length === 0, `no tote mixes communities (${mixed.length} mixed)`);

// Every tote flies exactly once.
const flown = plan.flights.flatMap((f) => f.loadedToteIds);
check(
  flown.length === totes.length && new Set(flown).size === totes.length,
  `every tote on exactly one flight (${flown.length}/${totes.length})`,
);

// Each flight within its own route limits.
const toteById = new Map(totes.map((t) => [t.toteId, t]));
for (const f of plan.flights) {
  const loaded = f.loadedToteIds.map((id) => toteById.get(id)!);
  const w = loaded.reduce((s, t) => s + t.weightLb, 0);
  const vol = loaded.length * TOTE.nominalVolumeCuFt;
  console.log(
    `  info: ${f.departureDate} -> ${f.destination}: ${loaded.length} totes, ${w.toFixed(0)}/${f.availablePayloadLb} lb, ${(f.flightHours ?? 0).toFixed(2)} h`,
  );
  check(w <= f.availablePayloadLb + 1e-9, `${f.destination}: payload within route limit`);
  check(loaded.length <= 90 && vol <= 187.5 + 0.05, `${f.destination}: totes/volume within aircraft`);
  // Flight's totes match its declared destination(s).
  const comms = new Set(loaded.map((t) => toteCommunity(t)));
  check(
    [...comms].every((c) => (f.destination ?? "").includes(c)),
    `${f.destination}: totes match destination`,
  );
}

// Comparison honest: chosen never slower than all-separate.
console.log("  options:");
for (const o of plan.options)
  console.log(
    `    ${o.feasible ? "ok " : "X  "} ${o.label} -> ${o.totalHours.toFixed(2)} h, ${o.flightsCount} flights${o.reason ? ` (${o.reason})` : ""}`,
  );
check(
  plan.savedHours >= -1e-9,
  `chosen "${plan.chosenLabel}" saves ${plan.savedHours.toFixed(2)} h vs separate (${plan.separateHours.toFixed(2)} h)`,
);

// Route table matches the brief exactly.
check(routeFor("Webequie").payloadLb === 2877, "Webequie payload 2,877 lb");
check(routeFor("Summer Beaver").payloadLb === 2887, "Summer Beaver payload 2,887 lb");
check(routeFor("Neskantaga").payloadLb === 3062, "Neskantaga payload 3,062 lb");

console.log(failed ? "\nSANITY FAILED" : "\nALL SANITY CHECKS PASSED");
process.exit(failed ? 1 : 0);
