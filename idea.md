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
   "wow" for judges and it also answers a hard requirement: *show your stacking
   assumptions and leftover cabin space*.

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

## Suggested split (3 people)

- **Person A:** CSV parsing + packing & flight algorithms (the brain).
- **Person B:** Dashboard UI — 3 tabs, drag-and-drop totes, pick lists, manifests.
- **Person C:** 3D cabin/tote view + deployment + polish.

## Nice-to-haves if time is left

- Scan-as-you-pick handheld view (big buttons, check off items).
- Cost-per-order per flight.
- Export manifest/pick list as PDF/print view.
