// Sanity check for lib/flights.ts against the real challenge data.
// Runs the full pipeline the app uses: orders -> per-batch totes -> flights.
// Run from web/:  npx tsx scripts/sanity-flights.ts

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  groupIntoOrders,
  parseFlightCapacityCsvText,
  parseOrdersCsvText,
} from "../lib/csv";
import { planFlights, rolledOverOnto, toteReadyDate } from "../lib/flights";
import { packOrdersByBatch } from "../lib/packing";
import { AIRCRAFT, TOTE, type Flight } from "../lib/types";

const DATA = join(__dirname, "../../Wilderness North");

let failed = false;
function check(ok: boolean, msg: string) {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) failed = true;
}

function run(name: string, ordersPath: string, capacities: Flight[]) {
  const orders = groupIntoOrders(
    parseOrdersCsvText(readFileSync(ordersPath, "utf8")),
  );
  const totes = packOrdersByBatch(orders);
  const plan = planFlights(totes, capacities);

  console.log(`\n=== ${name}: ${orders.length} orders -> ${totes.length} totes -> ${plan.flights.length} departures ===`);

  const toteById = new Map(totes.map((t) => [t.toteId, t]));
  for (const f of plan.flights) {
    const loaded = f.loadedToteIds.map((id) => toteById.get(id)!);
    const w = loaded.reduce((s, t) => s + t.weightLb, 0);
    const vol = loaded.length * TOTE.nominalVolumeCuFt;
    const margins = [
      ["weight", w / f.availablePayloadLb],
      ["space", vol / f.availableVolumeCuFt],
      ["totes", loaded.length / f.availableTotes],
    ] as const;
    const binding = margins.reduce((a, b) => (b[1] > a[1] ? b : a));
    console.log(
      `  info: dep #${f.departureId} ${f.departureDate}: ${loaded.length}/${f.availableTotes} totes, ${w.toFixed(0)}/${f.availablePayloadLb} lb, ${vol.toFixed(1)}/${f.availableVolumeCuFt} cu ft -> ${binding[0]}-limited (${(binding[1] * 100).toFixed(0)}%)`,
    );
    check(loaded.length <= f.availableTotes, `dep #${f.departureId}: tote count within limit`);
    check(w <= f.availablePayloadLb + 1e-9, `dep #${f.departureId}: payload within limit`);
    check(vol <= f.availableVolumeCuFt + 0.05, `dep #${f.departureId}: volume within limit (rounding slack)`);
    check(
      loaded.every((t) => toteReadyDate(t) <= f.departureDate),
      `dep #${f.departureId}: no order flies before its order date`,
    );
  }

  // Every tote exactly once (on a flight or rolled over).
  const seen = [
    ...plan.flights.flatMap((f) => f.loadedToteIds),
    ...plan.rolledOverToteIds,
  ];
  check(
    seen.length === totes.length && new Set(seen).size === totes.length,
    `every tote appears exactly once (${seen.length}/${totes.length})`,
  );

  // Split orders fly together.
  const flightOfTote = new Map(
    plan.flights.flatMap((f) => f.loadedToteIds.map((id) => [id, f.departureId] as const)),
  );
  const totesByOrder = new Map<string, string[]>();
  for (const t of totes)
    for (const c of t.contents)
      totesByOrder.set(c.orderId, [...(totesByOrder.get(c.orderId) ?? []), t.toteId]);
  const broken = [...totesByOrder.values()].filter(
    (ids) => ids.length > 1 && new Set(ids.map((id) => flightOfTote.get(id))).size > 1,
  );
  check(broken.length === 0, `split orders fly on one flight (${broken.length} broken)`);

  console.log(
    `  info: rolled over past all departures: ${plan.rolledOverToteIds.length ? plan.rolledOverToteIds.join(", ") : "none"}`,
  );

  // Per-departure rollover: totes ready for an earlier flight that flew later.
  const rolled = rolledOverOnto(plan, totes);
  for (const [dep, ids] of rolled)
    console.log(`  info: dep #${dep} carries ${ids.length} rolled-over totes: ${ids.join(", ")}`);
  if (capacities.length > 1 && plan.flights.some((f, i) => i > 0 && f.loadedToteIds.length > 0)) {
    check(rolled.size > 0, "later departures report their rolled-over totes");
  }
}

// Stage 1: one full Caravan.
run("Stage 1", join(DATA, "Stage 1/contestant_stage1_orders (1).csv"), [
  {
    departureId: "1",
    departureDate: "2026-06-02",
    availableTotes: AIRCRAFT.maxTotes,
    availablePayloadLb: AIRCRAFT.payloadLb,
    availableVolumeCuFt: AIRCRAFT.cargoVolumeCuFt,
    loadedToteIds: [],
  },
]);

// Stage 2: the provided capacity CSV.
run(
  "Stage 2",
  join(DATA, "Stage 2/contestant_stage2_orders.csv"),
  parseFlightCapacityCsvText(
    readFileSync(join(DATA, "Stage 2/flight_capacity_stage2.csv"), "utf8"),
  ),
);

console.log(failed ? "\nSANITY FAILED" : "\nALL SANITY CHECKS PASSED");
process.exit(failed ? 1 : 0);
