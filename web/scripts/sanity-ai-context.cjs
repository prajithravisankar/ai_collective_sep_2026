/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const assert = require("node:assert/strict");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  module._compile(output, filename);
};

const { buildAIContext, copilotSuggestions } = require("../lib/ai-context.ts");
const item = { orderDate: "2026-09-25" };
const order = { orderId: "O1", householdId: "H1", batchId: "B1", orderDate: "2026-09-25", destinationCommunity: "Webequie", status: "entered", totalWeightLb: 12, totalVolumeCuIn: 100, items: [item] };
const tote = { toteId: "T1", weightLb: 12, fillPercent: 20, contents: [{ orderId: "O1", items: [item] }] };
const flight = { departureId: "F1", departureDate: "2026-09-26", availableTotes: 2, availablePayloadLb: 100, availableVolumeCuFt: 5, loadedToteIds: ["T1"] };
const state = {
  orders: [order], items: [{ ...item, productName: "Rice", weightLb: 12 }],
  totes: [tote], carts: [{ cartId: "C1", toteIds: ["T1"] }],
  baselineToteCount: 2, maxToteWeightLb: 50, capacities: [flight],
  plan: { flights: [flight], rolledOverToteIds: [] },
};

for (const path of ["/", "/entry", "/entry/assistant", "/picking", "/picking/handheld", "/flights", "/track", "/dashboard"]) {
  const context = buildAIContext(path, state, "O1");
  assert.equal(context.pathname, path);
  assert.ok(context.page);
  assert.ok(copilotSuggestions(path).length >= 3);
}
assert.notDeepEqual(copilotSuggestions("/entry"), copilotSuggestions("/flights"));
assert.equal(buildAIContext("/picking", state).totesSaved, 1);
assert.equal(buildAIContext("/flights", state).departures[0].remaining.payloadLb, 88);
assert.equal(buildAIContext("/dashboard", state).selectedTab, null);
console.log("AI context and route suggestions: pass");
