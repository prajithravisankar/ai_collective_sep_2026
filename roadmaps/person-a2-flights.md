# Person A2 — Flight Planning Roadmap

Your file: `web/lib/flights.ts` (stub exists). Types in `web/lib/types.ts`.
Goal: put totes on departures without breaking any limit, roll the rest over.

## Milestone 1 — Capacity CSV

- [ ] Add `parseFlightCapacityCsv` to `web/lib/csv.ts` (same PapaParse pattern
      as orders). Columns: `departure_id, departure_date, available_totes,
      available_payload_lb, available_volume_cuft`
- [ ] Map rows to the `Flight` type
- [ ] Stage 1 has no capacity CSV: default to one full plane —
      `AIRCRAFT` in types.ts (90 totes, 2,877 lb, 187.5 cu ft)

## Milestone 2 — Load one flight

- [ ] `planFlights(totes, flights)`: fill the first departure with totes until
      any limit would be broken:
  - [ ] tote count ≤ `availableTotes`
  - [ ] total weight ≤ `availablePayloadLb`
  - [ ] total volume ≤ `availableVolumeCuFt` (careful: totes are cu IN, flights cu FT)
- [ ] Report per flight: weight left, space left, totes left
- [ ] Report **which limit binds** — the one with the least room left (weight,
      volume, or tote count). The brief explicitly asks for this.

## Milestone 3 — Multiple departures + rollover (Stage 2)

- [ ] Fill departures in date order
- [ ] An order can only fly on a departure ON/AFTER its order date
      (batch from June 3 can't be on the June 2 flight)
- [ ] Totes that don't fit roll to the next departure; return them in
      `rolledOverToteIds` with which departure they ended up on
- [ ] Prefer complete orders: all totes of one order on the same flight
- [ ] Sanity test: Stage 2 = 120 orders / 1,492 lb over departures with
      703 / 1,151 / 2,877 lb — first flight WILL overflow, rollover must show

## Milestone 4 — Manifest data + hand off

- [ ] Per flight, produce manifest data: totes on board → orders in each tote →
      total weight → space used (B renders it; keep it a plain object)
- [ ] No `throw` left; tell B and A1 it's ready

## Don'ts

- Don't hard-code the 3 sample departures — judges may give different ones
- Don't invent your own tote weights — use what A1's totes carry
