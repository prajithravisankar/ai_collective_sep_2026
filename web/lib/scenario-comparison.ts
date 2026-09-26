import { planFlights, type LoadPlan } from "./flights";
import type { Flight, Tote } from "./types";

export type CapacityValues = Pick<Flight, "availablePayloadLb" | "availableTotes" | "availableVolumeCuFt">;
export type Movement = "moved later" | "moved earlier" | "became unscheduled" | "became scheduled" | "different departure (same date)";

export function calculateScenario(totes: Tote[], capacities: Flight[], departureId: string, values: CapacityValues): LoadPlan {
  if (!capacities.some((flight) => flight.departureId === departureId)) throw new Error("Select an available departure.");
  const { availablePayloadLb, availableTotes, availableVolumeCuFt } = values;
  const patch = { availablePayloadLb, availableTotes, availableVolumeCuFt };
  if (Object.values(patch).some((value) => !Number.isFinite(value) || value < 0) || !Number.isInteger(availableTotes)) {
    throw new Error("Use finite, non-negative capacities and a whole number of tote slots.");
  }
  const flights = capacities.map((flight) => ({
    ...flight,
    ...(flight.departureId === departureId ? patch : {}),
    loadedToteIds: [...flight.loadedToteIds],
  }));
  return planFlights(totes, flights);
}

function assignments(plan: LoadPlan) {
  return new Map(plan.flights.flatMap((flight) => flight.loadedToteIds.map((id) => [id, flight] as const)));
}

export function compareScenarios(totes: Tote[], baseline: LoadPlan, scenario: LoadPlan) {
  const before = assignments(baseline);
  const after = assignments(scenario);
  const moved = totes.flatMap((tote) => {
    const from = before.get(tote.toteId) ?? null;
    const to = after.get(tote.toteId) ?? null;
    if (from?.departureId === to?.departureId) return [];
    const movement: Movement = !from ? "became scheduled" : !to ? "became unscheduled"
      : to.departureDate > from.departureDate ? "moved later"
      : to.departureDate < from.departureDate ? "moved earlier" : "different departure (same date)";
    return [{ toteId: tote.toteId, orderIds: [...new Set(tote.contents.map((content) => content.orderId))], from, to, movement }];
  });
  const affectedIds = new Set(moved.flatMap((move) => move.orderIds));
  const orders = [...affectedIds].sort().map((orderId) => {
    const toteIds = totes.filter((tote) => tote.contents.some((content) => content.orderId === orderId)).map((tote) => tote.toteId);
    const wasScheduled = toteIds.every((id) => before.has(id));
    const isScheduled = toteIds.every((id) => after.has(id));
    const changes = moved.filter((move) => move.orderIds.includes(orderId));
    return {
      orderId, toteIds,
      from: [...new Set(toteIds.map((id) => before.get(id)?.departureId ?? "Unscheduled"))],
      to: [...new Set(toteIds.map((id) => after.get(id)?.departureId ?? "Unscheduled"))],
      delayed: changes.some((move) => move.movement === "moved later"),
      becameUnscheduled: wasScheduled && !isScheduled,
      becameScheduled: !wasScheduled && isScheduled,
      movements: [...new Set(changes.map((move) => move.movement))],
    };
  });
  return { moved, orders, delayedOrders: orders.filter((order) => order.delayed).length };
}
