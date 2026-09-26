import Link from "next/link";

// Landing page: the pitch. What it is, what it does, why it matters —
// written for someone (a judge) who has never seen the product.
// Every number on this page comes from running the app on the real
// challenge data; sources are linked at the bottom.

export default function LandingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4">
      {/* ---------- top bar ---------- */}
      <header className="flex items-center justify-between py-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-accent text-base font-bold text-[#06110c]">
            Z
          </span>
          <span className="font-semibold">
            Zamiigo <span className="text-zinc-500">Fulfillment</span>
          </span>
        </div>
        <Link href="/overview" className="btn btn-secondary">
          Open the app →
        </Link>
      </header>

      {/* ---------- hero ---------- */}
      <section className="grid items-center gap-10 py-10 lg:grid-cols-2 lg:py-16">
        <div>
          <p className="kicker">Wilderness North × Zamiigo · fly-in grocery logistics</p>
          <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Groceries fly into remote Ontario.
            <span className="text-emerald-400"> We make every pound count.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-zinc-400">
            Webequie, Summer Beaver and Neskantaga get their groceries by
            Cessna Caravan. One app carries every order from the retailer’s
            checkout to the aircraft: typed in minutes, packed into shared
            totes, loaded to the pound.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/entry" className="btn btn-primary px-6 py-3 text-base">
              Try the live demo
            </Link>
            <a href="#how" className="btn btn-secondary px-6 py-3 text-base">
              How it works ↓
            </a>
          </div>
          <p className="mt-3 text-sm text-zinc-500">
            No login. One click loads sample data — or upload your own CSV.
          </p>
        </div>
        <img
          src="/hero.jpg"
          alt="A family on a lakeside dock watching a Cessna Caravan fly over their community"
          className="w-full rounded-2xl border border-edge shadow-2xl shadow-black/40"
        />
      </section>

      {/* ---------- numbers band ---------- */}
      <section className="grid gap-3 rounded-2xl border border-edge bg-surface p-6 sm:grid-cols-2 lg:grid-cols-4">
        <Stat n="40%" label="fewer totes than one-per-household, on the real challenge data" />
        <Stat n="98%" label="of a flight’s payload used — and the app tells you weight binds before space" />
        <Stat n="2.37 h" label="of flight time saved by pairing two communities into one round trip" />
        <Stat n="0" label="hard-coded numbers: aircraft, cabin and payloads all cite public sources" />
      </section>

      {/* ---------- the problem ---------- */}
      <section className="py-16" id="how">
        <p className="kicker">The problem</p>
        <h2 className="mt-2 max-w-3xl text-2xl font-bold tracking-tight sm:text-3xl">
          Retailers won’t integrate. So a person retypes every order, packs
          every box, and guesses what the plane can lift.
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <ProblemCard
            title="Manual re-entry"
            body="Every household order is re-created by hand in the retailer’s consumer website — their single largest source of work, growing with every customer."
          />
          <ProblemCard
            title="Wasted aircraft space"
            body="One tote per household flies half-empty boxes 169 nautical miles. Aircraft payload is the scarcest resource in the whole chain."
          />
          <ProblemCard
            title="Subsidies need separation"
            body="Nutrition North applies per household. Orders, substitutions and receipts must stay traceable from entry to doorstep — through shared totes."
          />
        </div>
      </section>

      {/* ---------- feature sections ---------- */}
      <Feature
        kicker="Step 1 · Order entry"
        title="Retype the batch in minutes, not hours"
        img="/shots/assistant.jpg"
        alt="Retailer typing assistant"
        body="Upload the orders CSV and work household by household: click-to-copy each product into the retailer’s search, tick it off, mark submitted, next. A progress bar tracks the whole batch, statuses flow entered → picked, and printable retailer sheets back the whole thing up."
        points={[
          "Column names normalized — a fresh CSV with renamed headers just works",
          "Copy a whole household list in one click",
          "Batch chips split multi-day uploads",
        ]}
      />
      <Feature
        flip
        kicker="Step 2 · Packing"
        title="Households share totes. Nothing overflows."
        img="/shots/picking.jpg"
        alt="Order picking with shared totes"
        body="First-fit-decreasing packing puts whole orders into shared totes by weight and volume, splits anything too big across linked totes, and shows the savings against one-tote-per-household. Staff can still move any order by hand — moves that would overflow are blocked, not allowed."
        points={[
          "Real data: 120 orders → 40 totes at 98% average fill",
          "Split orders stay together on one picker cart",
          "The 50 lb tote cap is a stated, adjustable assumption",
        ]}
      />
      <Feature
        kicker="Step 2½ · The store run"
        title="One pass through the store"
        img="/shots/handheld.jpg"
        alt="Handheld pick list"
        phone
        body="A cart-by-cart pick list, printable or on a handheld: big tap targets, tote by tote, household by household. The grab list totals identical products across the cart — pick seven milks in one reach, then distribute. Out of stock? Record the substitution right there; it follows the order onto every document."
        points={[
          "Printable and handheld — the brief’s exact words",
          "Grab list kills repeat trips down the same aisle",
          "Substitutions keep subsidy paperwork honest",
        ]}
      />
      <Feature
        flip
        kicker="Step 3 · Flight planning"
        title="See the plane fill up — before it does"
        img="/shots/flights.jpg"
        alt="Flight management with cabin seat map"
        body="Totes flow onto dated departures within three limits at once: payload, cargo volume and tote count — with the binding one named per flight. The cabin is drawn like an airline seat map from a real stacking model of the Cessna 208B, and orders that miss a flight are shown rolling to the next one, not silently dropped."
        points={[
          "Airline-style seat map: click a tote, see its orders",
          "What-if: shrink a departure’s hold and re-plan instantly",
          "Manifests, driver drop-off sheets and household slips — all printable",
        ]}
      />
      <Feature
        kicker="Bonus · Multi-community"
        title="Three communities. One aircraft. The math, shown."
        img="/shots/bonus.jpg"
        alt="Multi-community route planner"
        body="Each route out of Nakina has its own payload, because fuel comes out of lift. The planner packs each community’s totes separately, checks every flight against its own route, then tests whether one round trip touching two communities beats separate flights — every option scored in hours and dollars, the winner explained."
        points={[
          "Per-route payloads straight from the sponsor’s table",
          "Combined-trip fuel math stated, not hand-waved",
          "Result on bonus data: 2 flights instead of 3 — 2.37 h saved",
        ]}
      />
      <Feature
        flip
        kicker="After the flight"
        title="From order to doorstep — and the totes come back"
        img="/shots/track.jpg"
        alt="Order tracking timeline"
        body="Someone calls asking where their groceries are: type their household, get the whole journey — status, tote, flight, delivered. Returnable totes are tracked packed → flown → delivered → returned with a still-out counter, because totes that don’t come back are money that doesn’t either."
        points={[
          "One search answers the phone call",
          "Tote lifecycle with days-out per flight",
          "Driver gets a signature sheet per departure",
        ]}
      />
      <Feature
        kicker="The control tower"
        title="Every number that matters, on one screen"
        img="/shots/overview.jpg"
        alt="Ops overview dashboard"
        body="Orders by status, totes packed and saved, the next departure’s load, totes still in the community, substitutions recorded, and the estimated cost per order — computed from real flight hours and an adjustable charter rate."
        points={[
          "Cost per order: the number the whole operation runs on",
          "Live from the same data every tab shares",
        ]}
      />

      {/* ---------- judge-proofing ---------- */}
      <section className="py-16">
        <p className="kicker">For the judges</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          Built to survive a fresh dataset
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ProblemCard
            title="Bring your own CSV"
            body="Headers are normalized and aliased — “Order Number”, “Weight (lb)”, “Max Totes” all parse. Missing capacity columns fall back to the full aircraft instead of zero."
          />
          <ProblemCard
            title="Cited, not invented"
            body="Cessna 208B confirmed via TSB investigation A23O0028; cabin 178″×62″×51″ from DHL Aviation’s dimension sheet; payloads from the challenge brief. Links in the footer of every page."
          />
          <ProblemCard
            title="Tested on the real data"
            body="Three sanity suites run the full pipeline on Stage 1, Stage 2 and the bonus dataset — packing limits, date rules, rollover, route payloads — before every push."
          />
          <ProblemCard
            title="Nothing to install"
            body="Deployed, no login, state lives in your browser. Every judge who opens the link gets their own clean sandbox."
          />
        </div>
      </section>

      {/* ---------- final CTA ---------- */}
      <section className="mb-16 rounded-2xl border border-emerald-800/60 bg-emerald-950/20 px-6 py-12 text-center">
        <h2 className="text-3xl font-bold tracking-tight">
          See it move groceries.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-zinc-400">
          One click loads a sample batch; the whole chain — entry, packing,
          pick lists, flight plan, manifests — takes about two minutes to walk.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/entry" className="btn btn-primary px-8 py-3 text-base">
            Try the live demo
          </Link>
          <Link href="/overview" className="btn btn-secondary px-8 py-3 text-base">
            Ops dashboard
          </Link>
        </div>
      </section>

      {/* ---------- footer ---------- */}
      <footer className="border-t border-edge py-8 text-center text-xs leading-relaxed text-zinc-500">
        Built by Dhara, Bhavya and Prajith for the AI Collective hackathon ·
        Wilderness North / Zamiigo challenge. Sources:{" "}
        <a
          href="https://www.tsb.gc.ca/eng/rapports-reports/aviation/2023/a23o0028/a23o0028.html"
          target="_blank"
          rel="noreferrer"
          className="text-emerald-400 underline decoration-emerald-400/40 underline-offset-2"
        >
          TSB A23O0028
        </a>{" "}
        ·{" "}
        <a
          href="https://aviationcargo.dhl.com/sites/default/files/aircraft_dimension_sheets/cessna-caravan-c208B.pdf"
          target="_blank"
          rel="noreferrer"
          className="text-emerald-400 underline decoration-emerald-400/40 underline-offset-2"
        >
          DHL C208B dimension sheet
        </a>{" "}
        · challenge brief.
      </footer>
    </div>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div>
      <p className="text-3xl font-bold tracking-tight text-emerald-400">{n}</p>
      <p className="mt-1 text-sm leading-snug text-zinc-400">{label}</p>
    </div>
  );
}

function ProblemCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-5">
      <h3 className="font-semibold text-zinc-100">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{body}</p>
    </div>
  );
}

function Feature({
  kicker,
  title,
  body,
  points,
  img,
  alt,
  flip = false,
  phone = false,
}: {
  kicker: string;
  title: string;
  body: string;
  points: string[];
  img: string;
  alt: string;
  flip?: boolean;
  phone?: boolean;
}) {
  return (
    <section className="grid items-center gap-8 border-t border-edge py-14 lg:grid-cols-2 lg:gap-14">
      <div className={flip ? "lg:order-2" : ""}>
        <p className="kicker">{kicker}</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h2>
        <p className="mt-4 leading-relaxed text-zinc-400">{body}</p>
        <ul className="mt-5 space-y-2">
          {points.map((pt) => (
            <li key={pt} className="flex gap-2.5 text-sm text-zinc-300">
              <span className="mt-0.5 text-emerald-400">✓</span>
              {pt}
            </li>
          ))}
        </ul>
      </div>
      <div className={`${flip ? "lg:order-1" : ""} ${phone ? "mx-auto w-64" : ""}`}>
        <div className="overflow-hidden rounded-xl border border-edge bg-surface shadow-xl shadow-black/30">
          <div className="flex gap-1.5 border-b border-edge px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          </div>
          <img src={img} alt={alt} loading="lazy" className="w-full" />
        </div>
      </div>
    </section>
  );
}
