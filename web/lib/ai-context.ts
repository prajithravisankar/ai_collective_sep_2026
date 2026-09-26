import { rolledOverOnto, toteReadyDate } from "./flights";
import type { useAppStore } from "./store";
import { TOTE } from "./types";

type AppState = ReturnType<typeof useAppStore>;

export function copilotPage(pathname: string) {
  if (pathname.startsWith("/entry")) return "Order Entry";
  if (pathname.startsWith("/picking")) return "Order Picking";
  if (pathname.startsWith("/flights")) return "Flight Management";
  if (pathname.startsWith("/dashboard")) return "Data Dashboard";
  if (pathname.startsWith("/track")) return "Order Tracking";
  if (pathname.startsWith("/hangar")) return "3D Hangar";
  return "Overview";
}

const suggestions: Record<string, string[]> = {
  "Order Entry": ["How many orders are waiting?", "Which orders are largest?", "How many households are in this batch?"],
  "Order Picking": ["Which tote is fullest?", "Were any orders split?", "How many totes did packing save?"],
  "Flight Management": ["What if departure 1 loses 200 lb?", "Which constraint is limiting us?", "Which orders rolled over?", "Summarize the flight plan."],
  "Data Dashboard": ["What are the main insights?", "Which products are heaviest?", "Which day had the most orders?"],
  "Order Tracking": ["How can I track an order?", "Which orders are still being picked?", "Are any orders awaiting a flight?"],
  "3D Hangar": ["What's inside tote T8?", "Which tote is the heaviest?", "Where are household 617's groceries?"],
  Overview: ["What does Zamiigo do?", "What is the current batch status?", "How does the workflow work?"],
};

export function copilotSuggestions(pathname: string) {
  return suggestions[copilotPage(pathname)];
}

// Send derived operational facts, never the uploaded CSV rows or product-level order contents.
export function buildAIContext(pathname: string, state: AppState, question = "") {
  const page = copilotPage(pathname);
  const statuses = Object.fromEntries(
    ["entered", "submitted", "picking", "picked"].map((status) => [
      status,
      state.orders.filter((order) => order.status === status).length,
    ]),
  );
  const orderIdsInQuestion = state.orders.filter((order) =>
    question.toLowerCase().includes(order.orderId.toLowerCase()),
  );
  const orderSummaries = [...new Map([
    ...orderIdsInQuestion.map((order) => [order.orderId, order] as const),
    ...[...state.orders].sort((a, b) => b.totalWeightLb - a.totalWeightLb).slice(0, 12).map((order) => [order.orderId, order] as const),
    ...state.orders.filter((order) => order.status !== "picked").sort((a, b) => a.orderDate.localeCompare(b.orderDate)).slice(0, 12).map((order) => [order.orderId, order] as const),
  ]).values()].slice(0, 30).map((order) => ({
    orderId: order.orderId,
    householdId: order.householdId,
    batchId: order.batchId,
    date: order.orderDate,
    community: order.destinationCommunity,
    status: order.status,
    itemCount: order.items.length,
    weightLb: order.totalWeightLb,
    volumeCuIn: order.totalVolumeCuIn,
  }));
  const common = {
    page,
    pathname,
    about:
      "Zamiigo (Wilderness North) flies groceries from Nakina, Ontario into remote fly-in First Nation communities — Webequie, Summer Beaver and Neskantaga — on a Cessna 208B Caravan. Households order in the Zamiigo app; staff re-enter orders at the retailer, pack households into shared returnable totes, and load flights against per-route payload limits. This dashboard runs that whole chain: entry, packing, pick lists, flight planning, manifests, delivery tracking. Aircraft payload is the scarcest resource; the Nutrition North subsidy applies per household, so orders stay separate end to end.",
    dataAvailable: state.orders.length > 0,
    summary: {
      orderCount: state.orders.length,
      householdCount: new Set(state.orders.map((order) => order.householdId)).size,
      itemCount: state.items.length,
      statusCounts: statuses,
      toteCount: state.totes.length,
      configuredDepartureCount: state.capacities.length,
      planAvailable: state.plan !== null,
    },
  };

  if (page === "Order Entry") {
    const countBy = (key: "batchId" | "orderDate" | "destinationCommunity") =>
      Object.fromEntries([...new Set(state.orders.map((order) => order[key]))].map((value) => [value, state.orders.filter((order) => order[key] === value).length]));
    return { ...common, batches: countBy("batchId"), ordersByDate: countBy("orderDate"), destinations: countBy("destinationCommunity"), selectedOrderSummaries: orderSummaries, selectionRule: "Mentioned orders, heaviest orders, and oldest unpicked orders", orderSummariesTruncated: state.orders.length > orderSummaries.length, workflow: "Upload CSV; each household order moves entered → submitted → picking → picked." };
  }

  if (page === "Order Picking") {
    const toteCounts = new Map<string, number>();
    for (const tote of state.totes) for (const content of tote.contents) toteCounts.set(content.orderId, (toteCounts.get(content.orderId) ?? 0) + 1);
    const splitOrders = [...toteCounts].filter(([, count]) => count > 1).map(([orderId, toteCount]) => ({ orderId, toteCount }));
    const saved = state.baselineToteCount === null ? null : state.baselineToteCount - state.totes.length;
    return { ...common,
      packingRun: state.totes.length > 0,
      maxToteWeightLb: state.maxToteWeightLb,
      toteNominalVolumeCuFt: TOTE.nominalVolumeCuFt,
      baselineHouseholdIsolatedTotes: state.baselineToteCount,
      optimizedTotes: state.totes.length,
      totesSaved: saved,
      reductionPercent: saved === null || !state.baselineToteCount ? null : 100 * saved / state.baselineToteCount,
      nominalToteCapacitySavedCuFt: saved === null ? null : saved * TOTE.nominalVolumeCuFt,
      averageFillPercent: state.totes.length ? state.totes.reduce((sum, tote) => sum + tote.fillPercent, 0) / state.totes.length : null,
      totes: state.totes.slice(0, 100).map((tote) => ({ id: tote.toteId, weightLb: tote.weightLb, fillPercent: tote.fillPercent, orderIds: tote.contents.map((c) => c.orderId), cartId: state.carts.find((cart) => cart.toteIds.includes(tote.toteId))?.cartId ?? null })),
      totesTruncated: state.totes.length > 100,
      splitOrders: splitOrders.slice(0, 60),
      splitOrdersTruncated: splitOrders.length > 60,
      cartCount: state.carts.length,
      note: "The isolated baseline packs each household order separately. Shared packing can place different households in one tote while their order records remain distinct. Manual tote moves may change the current count after the baseline was computed.",
    };
  }

  if (page === "Flight Management") {
    const byTote = new Map(state.totes.map((tote) => [tote.toteId, tote]));
    const rolledOnto = state.plan ? rolledOverOnto(state.plan, state.totes) : new Map<string, string[]>();
    const flights = state.plan?.flights ?? state.capacities;
    const assignedFlight = new Map(flights.flatMap((flight) => flight.loadedToteIds.map((id) => [id, flight.departureId] as const)));
    const assignedOrders = state.orders.map((order) => {
      const toteIds = state.totes.filter((tote) => tote.contents.some((content) => content.orderId === order.orderId)).map((tote) => tote.toteId);
      return { orderId: order.orderId, toteIds, departureIds: [...new Set(toteIds.map((id) => assignedFlight.get(id)).filter((id): id is string => !!id))] };
    });
    return { ...common,
      planAvailable: state.plan !== null,
      scenario: "The currently configured capacity values include any edits made in the Flight Management what-if controls. If planAvailable is false, no current flight assignment exists.",
      totalWaitingTotes: state.totes.length,
      totalWaitingWeightLb: state.totes.reduce((sum, tote) => sum + tote.weightLb, 0),
      nominalVolumePerToteCuFt: TOTE.nominalVolumeCuFt,
      departures: flights.slice(0, 40).map((flight) => {
        const loaded = flight.loadedToteIds.map((id) => byTote.get(id)).filter((tote) => tote !== undefined);
        const payloadUsed = loaded.reduce((sum, tote) => sum + tote.weightLb, 0);
        const volumeUsed = loaded.length * TOTE.nominalVolumeCuFt;
        const utilization = [
          ["tote slots", flight.availableTotes ? loaded.length / flight.availableTotes : 0],
          ["payload", flight.availablePayloadLb ? payloadUsed / flight.availablePayloadLb : 0],
          ["volume", flight.availableVolumeCuFt ? volumeUsed / flight.availableVolumeCuFt : 0],
        ] as const;
        return { departureId: flight.departureId, date: flight.departureDate, destination: flight.destination ?? null,
          capacity: { toteSlots: flight.availableTotes, payloadLb: flight.availablePayloadLb, volumeCuFt: flight.availableVolumeCuFt },
          used: { toteSlots: loaded.length, payloadLb: payloadUsed, volumeCuFt: volumeUsed },
          remaining: { toteSlots: flight.availableTotes - loaded.length, payloadLb: flight.availablePayloadLb - payloadUsed, volumeCuFt: flight.availableVolumeCuFt - volumeUsed },
          bindingConstraint: state.plan ? [...utilization].sort((a, b) => b[1] - a[1])[0][0] : null,
          loadedToteIds: flight.loadedToteIds.slice(0, 100), loadedToteIdsTruncated: flight.loadedToteIds.length > 100,
          rolledOverOntoThisDeparture: rolledOnto.get(flight.departureId) ?? [],
        };
      }),
      departuresTruncated: flights.length > 40,
      unassignedToteIds: state.plan?.rolledOverToteIds.slice(0, 100) ?? [],
      orderAssignments: assignedOrders.filter((order) => order.toteIds.length > 0).slice(0, 100),
      orderAssignmentsTruncated: assignedOrders.filter((order) => order.toteIds.length > 0).length > 100,
      relevantTotes: state.totes.slice(0, 100).map((tote) => ({ id: tote.toteId, weightLb: tote.weightLb, readyDate: toteReadyDate(tote), orderIds: tote.contents.map((c) => c.orderId) })),
      relevantTotesTruncated: state.totes.length > 100,
    };
  }

  if (page === "Data Dashboard") {
    const products = new Map<string, { itemCount: number; totalWeightLb: number }>();
    for (const item of state.items) {
      const value = products.get(item.productName) ?? { itemCount: 0, totalWeightLb: 0 };
      value.itemCount += 1; value.totalWeightLb += item.weightLb;
      products.set(item.productName, value);
    }
    return { ...common, dashboardExists: false, selectedTab: null, note: "This checkout has no dashboard page or selected tab. These insights are derived from the shared store only.", ordersByDate: Object.fromEntries([...new Set(state.orders.map((order) => order.orderDate))].map((date) => [date, state.orders.filter((order) => order.orderDate === date).length])), heaviestProductsByTotalWeight: [...products].sort((a, b) => b[1].totalWeightLb - a[1].totalWeightLb).slice(0, 15), flightCapacities: state.capacities.slice(0, 40).map((flight) => ({ departureId: flight.departureId, date: flight.departureDate, toteSlots: flight.availableTotes, payloadLb: flight.availablePayloadLb, volumeCuFt: flight.availableVolumeCuFt })) };
  }

  if (page === "Order Tracking") {
    return { ...common, relevantOrders: orderSummaries, relevantOrdersTruncated: state.orders.length > orderSummaries.length, workflow: "Search an order or household ID to view status, tote IDs, flight assignment, and tote lifecycle." };
  }

  return { ...common, workflow: ["Order Entry: upload CSV and track household statuses", "Order Picking: pack shared totes, assign carts, print lists", "Flight Management: plan departure loads and manifests", "Order Tracking: find an order across stages"], packingBaselineTotes: state.baselineToteCount, optimizedTotes: state.totes.length, plannedDepartures: state.plan?.flights.length ?? 0 };
}
