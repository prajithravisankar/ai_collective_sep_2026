// Bonus objective: three communities, one Caravan, payload per route.
// Route figures below are the sponsor's own table from the bonus brief
// (one-way nm, round-trip statute miles, flight hours at 170 mph,
// payload = 3,923 lb low operational weight minus estimated fuel).
//
// Inter-community distances (for the two-stop comparison) come from
// public airport coordinates + great-circle math. Validation: the same
// coordinates reproduce the brief's own Nakina one-way distances to
// within 1 nm (CYWP 169, CJV7 167, CYLH 130), so the A->B legs rest on
// the sponsor's numbers, not ours.

import { groupLinkedTotes } from "./packing";
import { TOTE, type Flight, type Tote } from "./types";

export interface Route {
  community: string;
  airport: string; // code · name
  oneWayNm: number;
  roundTripStatuteMi: number;
  flightHours: number;
  fuelLb: number;
  payloadLb: number;
}

export const LOW_OPERATIONAL_WEIGHT_LB = 3923;
export const AVG_SPEED_MPH = 170;

export const ROUTES: Record<string, Route> = {
  Webequie: {
    community: "Webequie",
    airport: "CYWP",
    oneWayNm: 169,
    roundTripStatuteMi: 389,
    flightHours: 2.49,
    fuelLb: 1046,
    payloadLb: 2877,
  },
  "Summer Beaver": {
    community: "Summer Beaver",
    airport: "CJV7",
    oneWayNm: 167,
    roundTripStatuteMi: 384,
    flightHours: 2.46,
    fuelLb: 1036,
    payloadLb: 2887,
  },
  Neskantaga: {
    community: "Neskantaga",
    airport: "CYLH · Landsdowne House",
    oneWayNm: 130,
    roundTripStatuteMi: 299,
    flightHours: 1.96,
    fuelLb: 861,
    payloadLb: 3062,
  },
};

// A community the judges' data names that the brief didn't: assume the
// longest route (Webequie figures) and say so, rather than crash.
export function routeFor(community: string): Route {
  return (
    ROUTES[community] ?? {
      ...ROUTES.Webequie,
      community,
      airport: "unknown — Webequie figures assumed",
    }
  );
}

// Airport coordinates (public data; validated against the brief, above).
export const COORDS: Record<string, [number, number]> = {
  Nakina: [50.18, -86.7],
  Webequie: [52.96, -87.37],
  "Summer Beaver": [52.71, -88.54],
  Neskantaga: [52.2, -87.93],
};

export function greatCircleNm(a: [number, number], b: [number, number]): number {
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLon = (b[1] - a[1]) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * Math.asin(Math.sqrt(h)) * 3440.065; // earth radius in nm
}

// Fuel burn implied by the sponsor's own table, averaged across the
// three routes (lb per statute mile). The short route burns more per
// mile (climb), so the average is conservative for long combined trips.
const FUEL_LB_PER_MI =
  (Object.values(ROUTES).reduce(
    (s, r) => s + r.fuelLb / r.roundTripStatuteMi,
    0,
  ) /
    3) as number;

// One round trip touching two communities: Nakina -> A -> B -> Nakina,
// same payload method as the brief (3,923 lb minus estimated fuel).
export function combinedTrip(a: string, b: string) {
  const ca = COORDS[a] ?? COORDS.Webequie;
  const cb = COORDS[b] ?? COORDS.Webequie;
  const nm =
    greatCircleNm(COORDS.Nakina, ca) +
    greatCircleNm(ca, cb) +
    greatCircleNm(cb, COORDS.Nakina);
  const statuteMi = nm * 1.15078;
  const fuelLb = statuteMi * FUEL_LB_PER_MI;
  return {
    statuteMi,
    flightHours: statuteMi / AVG_SPEED_MPH,
    payloadLb: LOW_OPERATIONAL_WEIGHT_LB - fuelLb,
  };
}

export function toteCommunity(tote: Tote): string {
  return tote.contents[0]?.items[0]?.destinationCommunity ?? "?";
}

// ---------------- multi-route planner ----------------

export interface RoutePlanOption {
  label: string; // e.g. "Webequie + Summer Beaver combined, Neskantaga separate"
  totalHours: number;
  flightsCount: number;
  feasible: boolean;
  reason?: string;
}

export interface RoutePlan {
  flights: Flight[]; // destination/flightHours filled; ordered = flying sequence
  options: RoutePlanOption[];
  chosenLabel: string;
  separateHours: number;
  savedHours: number;
}

interface CommLoad {
  community: string;
  totes: Tote[];
  weightLb: number;
}

// Plan every community's totes onto route-limited flights, then test
// whether any single round trip touching two communities beats flying
// them separately (the brief's explicit ask). Small N: enumerate.
export function planRoutes(totes: Tote[]): RoutePlan {
  const byComm = new Map<string, Tote[]>();
  // Keep linked (split-order) totes together by grouping first.
  for (const group of groupLinkedTotes(totes)) {
    const comm = toteCommunity(group[0]);
    byComm.set(comm, [...(byComm.get(comm) ?? []), ...group]);
  }
  const loads: CommLoad[] = [...byComm.entries()].map(([community, ts]) => ({
    community,
    totes: ts,
    weightLb: ts.reduce((s, t) => s + t.weightLb, 0),
  }));

  // All ways to fly: each community separate, or one pair combined.
  const partitions: CommLoad[][][] = [loads.map((l) => [l])];
  for (let i = 0; i < loads.length; i++)
    for (let j = i + 1; j < loads.length; j++) {
      const rest = loads.filter((_, k) => k !== i && k !== j).map((l) => [l]);
      partitions.push([[loads[i], loads[j]], ...rest]);
    }

  const evaluated = partitions.map((partition) => {
    const legs = partition.map((group) => makeLeg(group));
    const feasible = legs.every((l) => l.feasible);
    return {
      partition,
      legs,
      label: partition
        .map((g) => g.map((l) => l.community).join(" + "))
        .join(", then "),
      totalHours: legs.reduce((s, l) => s + l.hours, 0),
      flightsCount: legs.reduce((s, l) => s + l.flights.length, 0),
      feasible,
      reason: legs.find((l) => !l.feasible)?.reason,
    };
  });

  const separate = evaluated[0];
  const best = evaluated
    .filter((e) => e.feasible)
    .sort((a, b) => a.totalHours - b.totalHours || a.flightsCount - b.flightsCount)[0];

  // Sequence: heaviest load flies first (most groceries delivered earliest).
  const flights = best.legs
    .flatMap((l) => l.flights)
    .sort((a, b) => weightOf(b, totes) - weightOf(a, totes))
    .map((f, i) => ({ ...f, departureId: String(i + 1), departureDate: `leg ${i + 1}` }));

  return {
    flights,
    options: evaluated.map(({ label, totalHours, flightsCount, feasible, reason }) => ({
      label,
      totalHours,
      flightsCount,
      feasible,
      reason,
    })),
    chosenLabel: best.label,
    separateHours: separate.totalHours,
    savedHours: separate.totalHours - best.totalHours,
  };
}

function weightOf(f: Flight, totes: Tote[]): number {
  return f.loadedToteIds.reduce(
    (s, id) => s + (totes.find((t) => t.toteId === id)?.weightLb ?? 0),
    0,
  );
}

function makeLeg(group: CommLoad[]): {
  flights: Flight[];
  hours: number;
  feasible: boolean;
  reason?: string;
} {
  const volPerTote = TOTE.nominalVolumeCuFt;

  if (group.length === 1) {
    // Single community: split across repeat flights on the same route
    // if one plane can't lift it all.
    const { community, totes } = group[0];
    const route = routeFor(community);
    const flights: Flight[] = [];
    let current: Tote[] = [];
    let w = 0;
    const flush = () => {
      if (!current.length) return;
      flights.push(routeFlight(route.community, route.payloadLb, route.flightHours, current));
      current = [];
      w = 0;
    };
    for (const t of totes) {
      if (
        w + t.weightLb > route.payloadLb ||
        current.length + 1 > 90 ||
        (current.length + 1) * volPerTote > 90 * volPerTote
      )
        flush();
      current.push(t);
      w += t.weightLb;
    }
    flush();
    return {
      flights,
      hours: flights.length * route.flightHours,
      feasible: true,
    };
  }

  // Pair: one round trip touching both. Only valid if everything fits
  // one aircraft on the combined-leg payload.
  const [a, b] = group;
  const trip = combinedTrip(a.community, b.community);
  const totalW = a.weightLb + b.weightLb;
  const totalTotes = a.totes.length + b.totes.length;
  if (totalW > trip.payloadLb)
    return {
      flights: [],
      hours: 0,
      feasible: false,
      reason: `${totalW.toFixed(0)} lb exceeds the ${trip.payloadLb.toFixed(0)} lb combined-trip payload`,
    };
  if (totalTotes > 90)
    return { flights: [], hours: 0, feasible: false, reason: "over 90 totes" };

  // First stop's totes load LAST so they sit aft, nearest the cargo door.
  const ordered = [...b.totes, ...a.totes];
  return {
    flights: [
      routeFlight(
        `${a.community} + ${b.community}`,
        trip.payloadLb,
        trip.flightHours,
        ordered,
      ),
    ],
    hours: trip.flightHours,
    feasible: true,
  };
}

function routeFlight(
  destination: string,
  payloadLb: number,
  flightHours: number,
  totes: Tote[],
): Flight {
  return {
    departureId: "?",
    departureDate: "",
    availableTotes: 90,
    availablePayloadLb: Math.round(payloadLb),
    availableVolumeCuFt: 187.5,
    loadedToteIds: totes.map((t) => t.toteId),
    destination,
    flightHours,
  };
}
