// Flight load planning — TO BUILD (Person A2).
//
// Stage 1: one flight, everything fits. Report weight + space left.
// Stage 2: several departures with limited capacity
// (flight_capacity CSV: departure_id,departure_date,available_totes,
// available_payload_lb,available_volume_cuft).
// Choose which orders fly on which departure; the rest roll over.
// Only orders placed BEFORE a departure date can be on it.
// For each flight report: totes on board, weight left, space left,
// and which limit binds (weight vs volume vs tote count).

import type { Flight, Tote } from "./types";

export interface LoadPlan {
  flights: Flight[];
  rolledOverToteIds: string[]; // totes that missed every given departure
}

export function planFlights(totes: Tote[], flights: Flight[]): LoadPlan {
  // TODO(Person A2): fill departures in date order without exceeding
  // available totes, payload or volume; report leftovers per flight.
  void totes;
  void flights;
  throw new Error("planFlights not implemented yet");
}
