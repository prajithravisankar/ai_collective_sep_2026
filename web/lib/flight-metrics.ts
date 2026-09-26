import { TOTE, type Flight, type Tote } from "./types";

// Display convention from Flight Management: highest capped utilization,
// with ties resolved toward tote slots, then space, then weight.
export function flightMetrics(flights: Flight[], totes: Tote[]) {
  const ids = new Set(flights.flatMap((flight) => flight.loadedToteIds));
  const loaded = totes.filter((tote) => ids.has(tote.toteId));
  const weight = loaded.reduce((sum, tote) => sum + tote.weightLb, 0);
  const volume = loaded.length * TOTE.nominalVolumeCuFt;
  const payload = flights.reduce((sum, flight) => sum + flight.availablePayloadLb, 0);
  const space = flights.reduce((sum, flight) => sum + flight.availableVolumeCuFt, 0);
  const slots = flights.reduce((sum, flight) => sum + flight.availableTotes, 0);
  const fraction = (used: number, available: number) => available ? Math.min(1, used / available) : 0;
  const margins = [
    ["weight", fraction(weight, payload)],
    ["space", fraction(volume, space)],
    ["totes", fraction(loaded.length, slots)],
  ] as const;
  const binding = margins.reduce((a, b) => b[1] >= a[1] ? b : a);
  const orders = new Map<string, string[]>();
  for (const tote of totes) for (const content of tote.contents) {
    orders.set(content.orderId, [...(orders.get(content.orderId) ?? []), tote.toteId]);
  }
  const completeOrders = [...orders.values()].filter((toteIds) => toteIds.every((id) => ids.has(id))).length;
  return { loaded, weight, volume, payload, space, slots, margins, binding, completeOrders };
}
