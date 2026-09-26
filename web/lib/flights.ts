// Flight load planning — Person A2.
//
// Fill departures in date order without exceeding tote count, payload or
// volume. Rules:
// - A tote can only fly on a departure ON/AFTER the date of every order
//   inside it (its "ready date").
// - Totes linked by a shared (split) order fly together on one flight.
// - Greedy: eligible groups sorted oldest-first, then smallest-first, so
//   early customers aren't skipped and each flight carries the most
//   orders it can. Whatever doesn't fit rolls to the next departure.

import { groupLinkedTotes } from "./packing";
import type { Flight, Tote } from "./types";
import { TOTE } from "./types";

// The capacity CSV rounds volume to 2 decimals (22 totes -> "45.83" cu ft
// though 22 x 2.0833 = 45.833), so allow a hair of slack when comparing.
const VOLUME_SLACK_CUFT = 0.05;

export interface LoadPlan {
  flights: Flight[]; // sorted by departure date, loadedToteIds filled
  rolledOverToteIds: string[]; // totes that missed every given departure
}

// The earliest date a tote may fly: the latest order date inside it.
export function toteReadyDate(tote: Tote): string {
  let ready = "";
  for (const c of tote.contents)
    for (const i of c.items) if (i.orderDate > ready) ready = i.orderDate;
  return ready;
}

export function planFlights(totes: Tote[], flights: Flight[]): LoadPlan {
  const groups = groupLinkedTotes(totes).map((g) => ({
    totes: g,
    readyDate: g.reduce(
      (d, t) => (toteReadyDate(t) > d ? toteReadyDate(t) : d),
      "",
    ),
    weightLb: g.reduce((s, t) => s + t.weightLb, 0),
    assigned: false,
  }));

  const planned = [...flights]
    .sort((a, b) => a.departureDate.localeCompare(b.departureDate))
    .map((f) => ({ ...f, loadedToteIds: [] as string[] }));

  for (const flight of planned) {
    let totesLeft = flight.availableTotes;
    let weightLeft = flight.availablePayloadLb;
    let volumeLeft = flight.availableVolumeCuFt + VOLUME_SLACK_CUFT;

    const eligible = groups
      .filter((g) => !g.assigned && g.readyDate <= flight.departureDate)
      .sort(
        (a, b) =>
          a.readyDate.localeCompare(b.readyDate) ||
          a.totes.length - b.totes.length ||
          a.weightLb - b.weightLb,
      );

    for (const g of eligible) {
      const vol = g.totes.length * TOTE.nominalVolumeCuFt;
      if (
        g.totes.length <= totesLeft &&
        g.weightLb <= weightLeft &&
        vol <= volumeLeft
      ) {
        flight.loadedToteIds.push(...g.totes.map((t) => t.toteId));
        totesLeft -= g.totes.length;
        weightLeft -= g.weightLb;
        volumeLeft -= vol;
        g.assigned = true;
      }
    }
  }

  return {
    flights: planned,
    rolledOverToteIds: groups
      .filter((g) => !g.assigned)
      .flatMap((g) => g.totes.map((t) => t.toteId)),
  };
}

// Stage 2 brief: "show ... which orders roll over to the next departure".
// A tote "rolled over" onto a flight when it was ready in time for an
// earlier departure in the plan but only flew on this one.
// (Skipped for bonus route legs, which have no dates.)
export function rolledOverOnto(
  plan: LoadPlan,
  totes: Tote[],
): Map<string, string[]> {
  const byId = new Map(totes.map((t) => [t.toteId, t]));
  const dated = [...plan.flights]
    .filter((f) => !f.destination)
    .sort((a, b) => a.departureDate.localeCompare(b.departureDate));
  const map = new Map<string, string[]>();
  dated.forEach((f, i) => {
    if (i === 0) return;
    const earlierDates = dated.slice(0, i).map((x) => x.departureDate);
    const rolled = f.loadedToteIds.filter((id) => {
      const tote = byId.get(id);
      if (!tote) return false;
      const ready = toteReadyDate(tote);
      return ready !== "" && earlierDates.some((d) => ready <= d);
    });
    if (rolled.length) map.set(f.departureId, rolled);
  });
  return map;
}
