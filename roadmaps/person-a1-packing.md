# Person A1 — Tote Packing Roadmap

Your file: `web/lib/packing.ts` (stub exists). Types in `web/lib/types.ts`.
Goal: turn a list of household orders into the fewest possible totes, then carts.

## Milestone 1 — Basic packing works

- [ ] Read `Order`, `Tote`, `TOTE` in `web/lib/types.ts` so we share shapes
- [ ] Sort orders largest → smallest by volume (first-fit decreasing)
- [ ] Place each order into the first tote where BOTH fit:
  - [ ] tote weight + order weight ≤ `TOTE.maxWeightLb`
  - [ ] tote volume + order volume ≤ `TOTE.volumeCuIn`
- [ ] Open a new tote when no existing tote fits
- [ ] Give each tote: `weightLb`, `volumeCuIn`, `fillPercent` (volume / tote volume)
- [ ] Sanity test: Stage 1 CSV (30 orders, 334 lb) should need ~10–15 totes, not 30

## Milestone 2 — Oversized orders (required, Stage 2 has 4 of them)

- [ ] If an order alone doesn't fit one tote, split it: fill a tote item by item,
      open the next tote, continue (largest items first)
- [ ] Keep the pieces linked: every tote's `contents` records which `orderId`
      the items belong to, so a split order can be traced
- [ ] Sanity test: Stage 2 CSV — the 4 orders over 3,619 cu in get split, nothing crashes

## Milestone 3 — Carts

- [ ] `assignTotesToCarts(totes, totesPerCart = 5)`
- [ ] Rule: all totes of one order go on the SAME cart (a split order is picked in one trip)
- [ ] Simple approach: group totes by "order group" first, then fill carts group by group

## Milestone 4 — Hand off

- [ ] Export clean functions; no `throw` left, no console spam
- [ ] Tell B the functions are ready (B is building UI against fake data until then)
- [ ] Quick check with A2: your totes' weights are what flight planning uses

## Don'ts

- Don't hard-code anything from the sample CSVs — judges upload a fresh file
- Don't optimize past first-fit decreasing unless everything else is done
