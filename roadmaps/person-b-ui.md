# Person B — Dashboard UI Roadmap

Your folders: `web/app/entry/`, `web/app/picking/`, `web/app/flights/`,
`web/components/`. CSV parsing already works (`web/lib/csv.ts`).
Don't wait for A1/A2 — build against fake data shaped like `web/lib/types.ts`.

## Milestone 1 — Order Entry tab (`app/entry/`)

- [x] CSV upload (file input is fine) → `parseOrdersCsv` → `groupIntoOrders`
- [x] Order table: order id, household, # items, weight, date, status
- [x] Click an order → see its items (this is the "retailer order entry" view)
- [x] Status flow: entered → submitted → picking → picked (buttons or dropdown)
- [x] Save orders + statuses to localStorage so refresh doesn't lose anything
- [x] Share state across tabs (React context or a tiny zustand store — pick one)

## Milestone 2 — Order Picking tab (`app/picking/`)

- [x] "Pack" button → calls A1's `packOrdersIntoTotes` (fake it until A1 lands)
- [x] Tote cards: tote id, weight, fill % bar, orders inside
- [x] Adjust grouping by hand: move an order to another tote
      (dropdown "move to tote…" is enough; drag-and-drop only if time)
- [x] Block a move that would overflow the target tote (weight or volume)
- [x] Cart view: totes per cart (input for totes-per-cart, default 5)
- [x] Pick list per cart: items grouped by tote → household, with a print
      stylesheet (`@media print`) so it's the required printable form

## Milestone 3 — Flight Management tab (`app/flights/`)

- [x] Stage 2: upload flight capacity CSV; Stage 1: one default plane
- [x] "Plan flights" → calls A2's `planFlights` (fake it until A2 lands)
- [x] Per departure card: totes on board, weight-left bar, space-left bar,
      binding-limit badge ("weight-limited" / "space-limited" / "tote-limited")
- [x] Rollover section: which totes/orders wait for the next departure
- [x] Manifest view per flight (printable, same `@media print` trick):
      totes → orders inside → total weight → space used
- [x] Show cabin dimensions + stacking assumptions with source (get numbers
      from `AIRCRAFT` in types.ts; C's 3D view replaces this later)

## Milestone 4 — Polish for judges

- [x] Empty states: every tab says what to do before data is loaded
- [x] A "load sample data" button so judges see the app working in one click
- [x] Numbers formatted (lb with 1 decimal, % rounded) and nothing overflows on mobile

## Don'ts

- Don't build your own order/tote/flight shapes — import from `web/lib/types.ts`
- Don't block on A1/A2 — wire fake data first, swap the real functions in later
