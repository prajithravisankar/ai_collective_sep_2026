# Person B — Dashboard UI Roadmap

Your folders: `web/app/entry/`, `web/app/picking/`, `web/app/flights/`,
`web/components/`. CSV parsing already works (`web/lib/csv.ts`).
Don't wait for A1/A2 — build against fake data shaped like `web/lib/types.ts`.

## Milestone 1 — Order Entry tab (`app/entry/`)

- [ ] CSV upload (file input is fine) → `parseOrdersCsv` → `groupIntoOrders`
- [ ] Order table: order id, household, # items, weight, date, status
- [ ] Click an order → see its items (this is the "retailer order entry" view)
- [ ] Status flow: entered → submitted → picking → picked (buttons or dropdown)
- [ ] Save orders + statuses to localStorage so refresh doesn't lose anything
- [ ] Share state across tabs (React context or a tiny zustand store — pick one)

## Milestone 2 — Order Picking tab (`app/picking/`)

- [ ] "Pack" button → calls A1's `packOrdersIntoTotes` (fake it until A1 lands)
- [ ] Tote cards: tote id, weight, fill % bar, orders inside
- [ ] Adjust grouping by hand: move an order to another tote
      (dropdown "move to tote…" is enough; drag-and-drop only if time)
- [ ] Block a move that would overflow the target tote (weight or volume)
- [ ] Cart view: totes per cart (input for totes-per-cart, default 5)
- [ ] Pick list per cart: items grouped by tote → household, with a print
      stylesheet (`@media print`) so it's the required printable form

## Milestone 3 — Flight Management tab (`app/flights/`)

- [ ] Stage 2: upload flight capacity CSV; Stage 1: one default plane
- [ ] "Plan flights" → calls A2's `planFlights` (fake it until A2 lands)
- [ ] Per departure card: totes on board, weight-left bar, space-left bar,
      binding-limit badge ("weight-limited" / "space-limited" / "tote-limited")
- [ ] Rollover section: which totes/orders wait for the next departure
- [ ] Manifest view per flight (printable, same `@media print` trick):
      totes → orders inside → total weight → space used
- [ ] Show cabin dimensions + stacking assumptions with source (get numbers
      from `AIRCRAFT` in types.ts; C's 3D view replaces this later)

## Milestone 4 — Polish for judges

- [ ] Empty states: every tab says what to do before data is loaded
- [ ] A "load sample data" button so judges see the app working in one click
- [ ] Numbers formatted (lb with 1 decimal, % rounded) and nothing overflows on mobile

## Don'ts

- Don't build your own order/tote/flight shapes — import from `web/lib/types.ts`
- Don't block on A1/A2 — wire fake data first, swap the real functions in later
