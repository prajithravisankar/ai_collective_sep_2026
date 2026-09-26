// Whitelisted tools the copilot's agent loop may request. Everything
// here is executed in the BROWSER against the shared store:
//  - read tools call the pure planners / read state, never mutate;
//  - the one write path (proposals) renders a confirm card and only
//    runs when the human clicks it, through the same store actions the
//    UI buttons use (with the same validations).
// Args are validated hard: unknown tools, unknown ids and out-of-range
// numbers come back as error strings the model has to acknowledge.

import { planFlights, toteReadyDate } from "./flights";
import { toteCommunity } from "./routes";
import type { Flight, Tote } from "./types";

// Minimal surface of the store the tools need (keeps this testable).
export interface ToolStore {
  orders: {
    orderId: string;
    householdId: string;
    orderDate: string;
    destinationCommunity: string;
    status: string;
    items: { productName: string; weightLb: number }[];
    totalWeightLb: number;
  }[];
  totes: Tote[];
  capacities: Flight[];
  plan: { flights: Flight[]; rolledOverToteIds: string[] } | null;
  toteLifecycle: Record<string, { status: string; at: number }>;
  substitutions: Record<string, string>;
}

export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
}

export const TOOL_SPEC = `Available tools (request at most one per turn, only when the context alone cannot answer):
- whatIfPlan: re-runs the REAL flight planner with modified departure capacities and reports the diff vs the current plan. Args: departureId (string, required), plus any of payloadLb, availableTotes, volumeCuFt (numbers). Use for every "what if a flight loses/gains capacity" question.
- lookupOrder: full journey of orders matching an order id or household id. Args: query (string).
- toteDetail: one tote's weight, fill, contents, flight and lifecycle. Args: toteId (string like "T12").
- proposeAction: propose a state change for the human to confirm (never executes by itself). Args: actionKind one of "advanceAll" | "markFlightTotes" | "applyCapacity"; for markFlightTotes: departureId and status ("flown"|"delivered"); for applyCapacity: departureId plus payloadLb/availableTotes/volumeCuFt; label (short human sentence describing the change).`;

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

export function executeTool(call: ToolCall, store: ToolStore): string {
  try {
    switch (call.tool) {
      case "whatIfPlan":
        return whatIfPlan(call.args, store);
      case "lookupOrder":
        return lookupOrder(call.args, store);
      case "toteDetail":
        return toteDetail(call.args, store);
      default:
        return JSON.stringify({ error: `Unknown tool "${call.tool}".` });
    }
  } catch (e) {
    return JSON.stringify({
      error: `Tool failed: ${e instanceof Error ? e.message : String(e)}`,
    });
  }
}

function flightLoad(f: Flight, totes: Tote[]) {
  const loaded = f.loadedToteIds
    .map((id) => totes.find((t) => t.toteId === id))
    .filter((t): t is Tote => !!t);
  return {
    departureId: f.departureId,
    date: f.departureDate,
    totes: loaded.length,
    orders: new Set(loaded.flatMap((t) => t.contents.map((c) => c.orderId))).size,
    payloadUsedLb: Math.round(loaded.reduce((s, t) => s + t.weightLb, 0)),
    payloadLimitLb: f.availablePayloadLb,
  };
}

function whatIfPlan(args: Record<string, unknown>, store: ToolStore): string {
  if (store.totes.length === 0)
    return JSON.stringify({ error: "No totes packed yet — pack on Order Picking first." });
  if (store.capacities.length === 0)
    return JSON.stringify({ error: "No departures configured — load capacities on Flight Management first." });

  const depId = String(args.departureId ?? "");
  const target = store.capacities.find((f) => f.departureId === depId);
  if (!target)
    return JSON.stringify({
      error: `No departure "${depId}". Known: ${store.capacities.map((f) => f.departureId).join(", ")}`,
    });

  const payloadLb = num(args.payloadLb);
  const availableTotes = num(args.availableTotes);
  const volumeCuFt = num(args.volumeCuFt);
  if (payloadLb === undefined && availableTotes === undefined && volumeCuFt === undefined)
    return JSON.stringify({ error: "Provide payloadLb, availableTotes or volumeCuFt to change." });
  const bad = [payloadLb, availableTotes, volumeCuFt].some(
    (v) => v !== undefined && (v < 0 || v > 20000),
  );
  if (bad) return JSON.stringify({ error: "Capacity values must be between 0 and 20000." });

  const modified = store.capacities.map((f) =>
    f.departureId === depId
      ? {
          ...f,
          availablePayloadLb: payloadLb ?? f.availablePayloadLb,
          availableTotes: availableTotes ?? f.availableTotes,
          availableVolumeCuFt: volumeCuFt ?? f.availableVolumeCuFt,
        }
      : f,
  );

  const before = store.plan ?? planFlights(store.totes, store.capacities);
  const after = planFlights(store.totes, modified);

  // orders whose flight changed
  const flightOf = (plan: { flights: Flight[] }) =>
    new Map(
      plan.flights.flatMap((f) =>
        f.loadedToteIds.flatMap((id) => {
          const t = store.totes.find((x) => x.toteId === id);
          return (t?.contents ?? []).map((c) => [c.orderId, f.departureId] as const);
        }),
      ),
    );
  const beforeMap = flightOf(before);
  const afterMap = flightOf(after);
  const moved: string[] = [];
  for (const [orderId, dep] of afterMap)
    if (beforeMap.get(orderId) !== dep) moved.push(orderId);
  for (const [orderId] of beforeMap)
    if (!afterMap.has(orderId)) moved.push(orderId + " (now unassigned)");

  return JSON.stringify({
    change: { departureId: depId, payloadLb, availableTotes, volumeCuFt },
    before: {
      flights: before.flights.map((f) => flightLoad(f, store.totes)),
      strandedTotes: before.rolledOverToteIds.length,
    },
    after: {
      flights: after.flights.map((f) => flightLoad(f, store.totes)),
      strandedTotes: after.rolledOverToteIds.length,
    },
    ordersOnDifferentFlight: { count: moved.length, sample: moved.slice(0, 8) },
    note: "Hypothetical only — the live plan is unchanged unless the operator applies it.",
  });
}

function lookupOrder(args: Record<string, unknown>, store: ToolStore): string {
  const query = String(args.query ?? "").trim().toLowerCase();
  if (!query) return JSON.stringify({ error: "query is required" });
  const matches = store.orders
    .filter(
      (o) =>
        o.orderId.toLowerCase().includes(query) ||
        o.householdId.toLowerCase().includes(query),
    )
    .slice(0, 5);
  if (matches.length === 0)
    return JSON.stringify({ error: `No order or household matches "${query}" in this batch.` });
  return JSON.stringify(
    matches.map((o) => {
      const toteIds = store.totes
        .filter((t) => t.contents.some((c) => c.orderId === o.orderId))
        .map((t) => t.toteId);
      const flight = store.plan?.flights.find((f) =>
        f.loadedToteIds.some((id) => toteIds.includes(id)),
      );
      const subs = Object.entries(store.substitutions)
        .filter(([k]) => k.startsWith(`${o.orderId}::`))
        .map(([k, v]) => `${k.split("::")[1]} -> ${v}`);
      return {
        orderId: o.orderId,
        householdId: o.householdId,
        community: o.destinationCommunity,
        placed: o.orderDate,
        status: o.status,
        items: o.items.length,
        weightLb: Math.round(o.totalWeightLb * 10) / 10,
        totes: toteIds,
        flight: flight
          ? `${flight.departureId} · ${flight.departureDate}${flight.destination ? ` · ${flight.destination}` : ""}`
          : store.plan
            ? "not on a flight yet"
            : "no flight plan yet",
        toteStatus: toteIds.map(
          (id) => `${id}: ${store.toteLifecycle[id]?.status ?? "packed"}`,
        ),
        substitutions: subs,
      };
    }),
  );
}

function toteDetail(args: Record<string, unknown>, store: ToolStore): string {
  const id = String(args.toteId ?? "").trim().toUpperCase();
  const tote = store.totes.find((t) => t.toteId.toUpperCase() === id);
  if (!tote)
    return JSON.stringify({ error: `No tote "${id}". Totes run T1–T${store.totes.length}.` });
  const flight = store.plan?.flights.find((f) => f.loadedToteIds.includes(tote.toteId));
  return JSON.stringify({
    toteId: tote.toteId,
    community: toteCommunity(tote),
    weightLb: Math.round(tote.weightLb * 10) / 10,
    fillPercent: Math.round(tote.fillPercent),
    readyDate: toteReadyDate(tote),
    lifecycle: store.toteLifecycle[tote.toteId]?.status ?? "packed",
    flight: flight ? `${flight.departureId} · ${flight.departureDate}` : "unassigned",
    orders: tote.contents.map((c) => ({
      orderId: c.orderId,
      householdId: c.items[0]?.householdId,
      items: c.items.length,
    })),
  });
}

// ---------- proposals (write path, human-confirmed) ----------

export interface Proposal {
  actionKind: "advanceAll" | "markFlightTotes" | "applyCapacity";
  label: string;
  departureId?: string;
  status?: "flown" | "delivered";
  payloadLb?: number;
  availableTotes?: number;
  volumeCuFt?: number;
}

export function validateProposal(args: Record<string, unknown>): Proposal | string {
  const kind = args.actionKind;
  const label = typeof args.label === "string" ? args.label.slice(0, 140) : "";
  if (kind === "advanceAll")
    return { actionKind: "advanceAll", label: label || "Advance every order one step" };
  if (kind === "markFlightTotes") {
    const status = args.status;
    if (status !== "flown" && status !== "delivered")
      return "markFlightTotes needs status flown|delivered";
    const departureId = String(args.departureId ?? "");
    if (!departureId) return "markFlightTotes needs departureId";
    return {
      actionKind: "markFlightTotes",
      departureId,
      status,
      label: label || `Mark departure ${departureId}'s totes ${status}`,
    };
  }
  if (kind === "applyCapacity") {
    const departureId = String(args.departureId ?? "");
    if (!departureId) return "applyCapacity needs departureId";
    const payloadLb = num(args.payloadLb);
    const availableTotes = num(args.availableTotes);
    const volumeCuFt = num(args.volumeCuFt);
    if (payloadLb === undefined && availableTotes === undefined && volumeCuFt === undefined)
      return "applyCapacity needs a capacity value";
    return {
      actionKind: "applyCapacity",
      departureId,
      payloadLb,
      availableTotes,
      volumeCuFt,
      label: label || `Apply new capacity to departure ${departureId} and re-plan`,
    };
  }
  return "Unknown actionKind";
}
