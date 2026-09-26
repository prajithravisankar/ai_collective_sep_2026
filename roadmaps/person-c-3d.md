# Person C — 3D Load View Roadmap

**START ONLY AFTER THE MVP IS DEPLOYED.** Until then, help wherever someone is stuck.

Your spot: a component inside `web/app/flights/` (e.g. `web/components/CabinView.tsx`).
Deps already installed: `three`, `@react-three/fiber`, `@react-three/drei`.

## Milestone 1 — The cabin

- [ ] Look up the exact Caravan model Wilderness North flies and its cabin
      dimensions; note the source (required by the brief). Starting numbers
      are in `AIRCRAFT` in `web/lib/types.ts` (64" wide, 54" high, ~150" long)
- [ ] Render the cabin as a wireframe/transparent box with `<Canvas>` +
      `OrbitControls` from drei (spin + zoom)

## Milestone 2 — Stacked totes

- [ ] Model the stacking: totes are 25 × 15.5" at the rim, 11" deep →
      how many fit per row / per stack in a 64 × 54" cross-section?
      Write the arrangement down — this backs the "90 totes" assumption
- [ ] Render one box per tote from the REAL flight plan (A2's output),
      placed in that arrangement, filled slots colored, empty slots ghosted
- [ ] Hover/click a tote → show tote id, weight, orders inside
- [ ] Show leftover space visually (empty region) + as numbers

## Milestone 3 — Tote fill view (nice-to-have)

- [ ] Second small canvas: one tote with its items as boxes inside
      (simple stacking by item dimensions, no perfect 3D packing needed)
- [ ] Pick which tote via the tote list

## Milestone 4 — Judge polish

- [ ] A caption stating cabin dims, stacking assumption, and source
- [ ] Works on the deployed site (check bundle loads, no SSR crash —
      dynamic import with `ssr: false` for the canvas component)

## Don'ts

- Don't chase realistic 3D models of the plane — clean boxes read better
- Don't let the 3D view break the build; it must degrade gracefully
