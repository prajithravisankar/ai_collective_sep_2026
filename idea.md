# Our Idea: Zamiigo Fulfillment Dashboard + 3D Load View

Team: Dhara, Bhavya, Prajith

## The problem (in one paragraph)

Wilderness North flies groceries from Nakina to Webequie in a Cessna 208 Caravan.
Customers order in the Zamiigo app. Staff re-type every order into the retailer's
website by hand, pack each household into its own tote (box), and fly the totes out.
One tote per household wastes plane space. They want one web app with **three tabs**
that carries orders from entry → totes → plane, and it **must be deployed online**
(local demos are rejected).

## What we build

**One web app: a dashboard with 3 tabs + a 3D view.**

1. **Order Entry tab** — Upload the orders CSV. See every order as a card/row with
   a status: Entered → Submitted → Picking → Picked. Judges can click through statuses.

2. **Order Picking tab** — Our packing algorithm groups household orders into shared
   totes (fewest totes, whole orders kept together, big orders split across totes).
   Staff can drag orders between totes to adjust. Totes are assigned to carts
   (5 totes per cart, configurable) and we generate a printable pick list per cart,
   grouped by tote → household. Every tote shows total weight + % full.

3. **Flight Management tab** — Assign totes to flights. For Stage 2, orders arrive
   over several days and each departure has limited payload/space (given in a CSV),
   so the planner picks which orders fly now and which roll over to the next flight.
   Shows weight left, space left, which limit is binding (weight vs volume), and a
   manifest per flight (totes on board → orders inside → totals).

4. **The showpiece: 3D view (Three.js)** — Spin-around 3D of the Caravan cabin with
   totes stacked inside, and a tote view showing how items fill it. This is our
   "wow" for judges and it also answers a hard requirement: _show your stacking
   assumptions and leftover cabin space_.

## The math (already checked against the real data)

- Tote: 23.5 × 14 × 11 inches ≈ **3,600 cubic inches (~2.1 cu ft)**, straight walls OK.
- Plane: max **90 totes**, payload to Webequie **2,877 lb** → avg tote can only weigh
  ~32 lb before weight (not space) becomes the limit. We must report which one binds.
- Stage 1 data: 30 orders, 334 lb total, every order fits in one tote → one flight, easy.
- Stage 2 data: 120 orders over 4 days, 1,492 lb total, **4 orders too big for one tote**
  (must split), 3 departures with partial capacity (22/36/90 totes). Rollover logic matters.
- Packing = bin packing. Simple **first-fit decreasing** (sort orders big → small, place
  into first tote that fits by weight AND volume) is good enough and easy to explain.
- Judges will run a **fresh CSV** through the app, so everything is driven by the upload,
  nothing hard-coded.

## Tech + Deployment (the crucial part)

- **One Next.js app. Deployed on Vercel from hour one.** Push to `main` = live URL.
  No servers to manage, free tier, judges get a link that just works.
- Packing/flight logic is plain TypeScript inside the same app — **no separate backend,
  no database needed**. CSV is parsed in the browser (PapaParse); app state lives in
  the browser (localStorage) so statuses and edits survive refresh.
- 3D: **react-three-fiber** (Three.js for React). Boxes in a box — simple shapes, big impact.
- UI: Tailwind + shadcn/ui for a clean dashboard fast.

**Rule: deploy first, then build.** Skeleton app with 3 empty tabs goes live on Vercel
before we write any logic. Every push after that updates the live URL. We are never
in the "it works on my laptop" trap.

## The split (MVP first, 3D after)

Person C's 3D view is **on hold until the MVP is built and deployed**. Until then
we are 3 people on the MVP: A1 (packing logic), A2 (flight logic), B (UI).

### Person A1 — Tote packing (`web/lib/packing.ts`)

1. `packOrdersIntoTotes(orders)`: first-fit decreasing — sort orders big → small,
   put each order in the first tote where its **weight AND volume** both fit.
2. Split any order too large for one tote across several totes, item by item
   (Stage 2 has 4 such orders — this is required, not optional).
3. `assignTotesToCarts(totes, totesPerCart = 5)`: fill carts, but keep **all totes
   of one order on the same cart**.
4. For every tote report: total weight (lb) and fill % by volume.
5. Constants (tote size, max weight) come from `web/lib/types.ts` — don't hard-code.

### Person A2 — Flight planning (`web/lib/flights.ts`)

1. Parse the flight capacity CSV (departure_id, date, available_totes,
   available_payload_lb, available_volume_cuft) — add this to `web/lib/csv.ts`.
2. `planFlights(totes, flights)`: fill departures in date order without going over
   tote count, payload, or volume. An order can only fly on a departure **after**
   its order date.
3. Rollover: totes that don't fit wait for the next departure; report which ones.
4. For every flight report: weight left, space left, and **which limit binds**
   (weight vs volume vs tote count).
5. Manifest data per flight: totes on board → orders in each tote → totals
   (B turns this into a printable view).

### Person B — Dashboard UI (`web/app/`)

1. Order Entry tab: CSV upload → order table (id, household, items, weight,
   status), status buttons entered → submitted → picking → picked, saved in
   localStorage.
2. Order Picking tab: tote cards (weight, fill %, orders inside), move orders
   between totes by hand, cart view with printable pick list per cart
   (grouped tote → household).
3. Flight Management tab: departure list, totes per flight, weight/space left
   bars, binding limit badge, rollover list, printable manifest.
4. Works with A1/A2's functions — until those are ready, build against fake data
   shaped like the types in `web/lib/types.ts`.

### Person C — later, after MVP is deployed

- 3D Caravan cabin with stacked totes + tote fill view (react-three-fiber,
  deps already installed). Also states stacking assumptions + leftover space.

## Nice-to-haves if time is left

- Scan-as-you-pick handheld view (big buttons, check off items).
- Cost-per-order per flight.
- Export manifest/pick list as PDF/print view.

## ideas:

- if time permits phone app that uses gemini api credits and updates the shared database.
