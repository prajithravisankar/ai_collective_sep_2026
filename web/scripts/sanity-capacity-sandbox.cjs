/* eslint-disable @typescript-eslint/no-require-imports */
// Run from web/: node scripts/sanity-capacity-sandbox.cjs
const fs = require("node:fs");
const assert = require("node:assert/strict");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
};
const { planFlights } = require("../lib/flights.ts");
const { calculateScenario, compareScenarios } = require("../lib/scenario-comparison.ts");
const { flightMetrics } = require("../lib/flight-metrics.ts");
const { sampleOrderItems, sampleFlightCapacities } = require("../lib/sample-data.ts");
const { groupIntoOrders } = require("../lib/csv.ts");
const { packOrdersByBatch } = require("../lib/packing.ts");
const { TOTE, AIRCRAFT } = require("../lib/types.ts");

function fixture() {
  const item = (orderId) => ({ orderId, orderDate: "2026-09-01", batchId: "judge-batch", householdId: orderId, destinationCommunity: "Webequie", productName: "Test item", weightLb: 10, lengthIn: 5, widthIn: 5, heightIn: 5 });
  const totes = ["split", "split", "single"].map((orderId, i) => ({ toteId: `judge-tote-${i}`, weightLb: 10, volumeCuIn: 125, fillPercent: 5, contents: [{ orderId, items: [item(orderId)] }] }));
  const capacities = ["alpha", "omega"].map((departureId, i) => ({ departureId, departureDate: `2026-09-0${i + 2}`, availableTotes: 3, availablePayloadLb: 30, availableVolumeCuFt: 6.25, loadedToteIds: [] }));
  return { totes, capacities, items: totes.flatMap((tote) => tote.contents.flatMap((content) => content.items)) };
}
function freeze(value) {
  Object.freeze(value);
  Object.values(value).forEach((child) => { if (child && typeof child === "object") freeze(child); });
  return value;
}
function run() {
  const { totes, capacities } = freeze(fixture());
  const original = JSON.stringify({ totes, capacities });
  const baseline = freeze(planFlights(totes, capacities));
  const baselineJSON = JSON.stringify(baseline);
  const values = { availablePayloadLb: 0, availableTotes: 3, availableVolumeCuFt: 6.25 };
  const scenario = calculateScenario(totes, capacities, "alpha", values);
  assert.deepEqual(scenario.flights[0].loadedToteIds, []);
  assert.equal(scenario.flights[1].loadedToteIds.length, 3);
  const impact = compareScenarios(totes, baseline, scenario);
  assert.equal(impact.moved.length, 3);
  assert.equal(impact.orders.length, 2);
  assert.equal(impact.delayedOrders, 2);
  assert.ok(impact.moved.every((move) => move.movement === "moved later"));
  assert.equal(flightMetrics([scenario.flights[1]], totes).completeOrders, 2);
  assert.equal(flightMetrics([{ ...scenario.flights[1], loadedToteIds: ["judge-tote-0"] }], totes).completeOrders, 0);
  assert.ok(compareScenarios(totes, scenario, baseline).moved.every((move) => move.movement === "moved earlier"));
  const single = planFlights(totes, capacities.slice(0, 1));
  const unscheduled = calculateScenario(totes, capacities.slice(0, 1), "alpha", values);
  assert.equal(unscheduled.rolledOverToteIds.length, 3);
  assert.ok(compareScenarios(totes, single, unscheduled).orders.every((order) => order.becameUnscheduled && !order.delayed));
  assert.ok(compareScenarios(totes, unscheduled, single).orders.every((order) => order.becameScheduled));
  assert.equal(compareScenarios(totes, unscheduled, unscheduled).delayedOrders, 0);
  assert.equal(compareScenarios(totes, unscheduled, unscheduled).orders.length, 0);
  const tied = capacities.map((flight) => ({ ...flight, departureDate: "2026-09-02" }));
  const tiedImpact = compareScenarios(totes, planFlights(totes, tied), calculateScenario(totes, tied, "alpha", values));
  assert.equal(tiedImpact.delayedOrders, 0);
  assert.ok(tiedImpact.moved.every((move) => move.movement === "different departure (same date)"));
  for (const patch of [{ availableTotes: 1 }, { availableVolumeCuFt: 2.0833 }, { availablePayloadLb: 10 }]) {
    const constrained = calculateScenario(totes, capacities, "alpha", { ...capacities[0], ...patch });
    assert.deepEqual(constrained.flights[0].loadedToteIds, ["judge-tote-2"]);
    assert.deepEqual(new Set(constrained.flights[1].loadedToteIds), new Set(["judge-tote-0", "judge-tote-1"]));
  }
  for (const patch of [{ availableTotes: 1.5 }, { availablePayloadLb: -1 }, { availablePayloadLb: NaN }, { availableVolumeCuFt: Infinity }]) {
    assert.throws(() => calculateScenario(totes, capacities, "alpha", { ...values, ...patch }));
  }
  assert.throws(() => calculateScenario(totes, capacities, "missing", values));
  const restored = calculateScenario(totes, capacities, "alpha", { availablePayloadLb: 30, availableTotes: 3, availableVolumeCuFt: 6.25 });
  assert.deepEqual(restored, baseline);
  assert.equal(compareScenarios(totes, baseline, restored).moved.length, 0);
  assert.equal(JSON.stringify({ totes, capacities }), original);
  assert.equal(JSON.stringify(baseline), baselineJSON);
  // Available checkout fixtures: exercise the unchanged A1 -> A2 pipeline
  // for both a full aircraft and the demo's constrained dated departures.
  const packed = packOrdersByBatch(groupIntoOrders(sampleOrderItems()));
  const demo = sampleFlightCapacities();
  for (const flights of [demo, [{ ...demo[demo.length - 1], availablePayloadLb: AIRCRAFT.payloadLb, availableTotes: AIRCRAFT.maxTotes, availableVolumeCuFt: AIRCRAFT.cargoVolumeCuFt }]]) {
    const result = planFlights(packed, flights);
    const allIds = [...result.flights.flatMap((flight) => flight.loadedToteIds), ...result.rolledOverToteIds];
    assert.equal(allIds.length, packed.length);
    assert.equal(new Set(allIds).size, packed.length);
    const assigned = new Map();
    for (const flight of result.flights) {
      const metrics = flightMetrics([flight], packed);
      assert.ok(metrics.weight <= flight.availablePayloadLb);
      assert.ok(metrics.volume <= flight.availableVolumeCuFt + 0.05);
      assert.ok(metrics.loaded.length <= flight.availableTotes);
      assert.equal(metrics.volume, metrics.loaded.length * TOTE.nominalVolumeCuFt);
      for (const tote of metrics.loaded) {
        for (const content of tote.contents) {
          assert.ok(content.items.every((item) => item.orderDate <= flight.departureDate));
          if (assigned.has(content.orderId)) assert.equal(assigned.get(content.orderId), flight.departureId);
          assigned.set(content.orderId, flight.departureId);
        }
      }
    }
    assert.ok(compareScenarios(packed, result, result).moved.length === 0);
  }
  // Preserve the original flight card's display math, including ties/zero.
  for (const flight of [...baseline.flights, ...scenario.flights, ...unscheduled.flights]) {
    const loaded = flight.loadedToteIds.map((id) => totes.find((tote) => tote.toteId === id));
    const w = loaded.reduce((sum, tote) => sum + tote.weightLb, 0);
    const frac = (used, available) => available ? Math.min(1, used / available) : 0;
    const margins = [["weight", frac(w, flight.availablePayloadLb)], ["space", frac(loaded.length * (3600 / 1728), flight.availableVolumeCuFt)], ["totes", frac(loaded.length, flight.availableTotes)]];
    const actual = flightMetrics([flight], totes);
    assert.deepEqual(actual.margins, margins);
    assert.deepEqual(actual.binding, margins.reduce((a, b) => b[1] >= a[1] ? b : a));
  }
  console.log("PASS: baseline preserved; recalculation; rollover; linked orders; earlier/later/same-date movements; scheduling changes; reset capacities; input validation; existing flight metrics.");
}
if (require.main === module) run();
module.exports = { fixture, run };
