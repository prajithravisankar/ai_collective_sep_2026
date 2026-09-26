import Link from "next/link";

const tabs = [
  {
    href: "/entry",
    step: "1",
    title: "Order Entry",
    desc: "Upload the orders CSV, prepare each household order for the retailer, track status from entered to picked.",
  },
  {
    href: "/picking",
    step: "2",
    title: "Order Picking",
    desc: "Group orders into shared totes, adjust the grouping, assign totes to carts, print pick lists, see weight and fill per tote.",
  },
  {
    href: "/flights",
    step: "3",
    title: "Flight Management",
    desc: "Load totes onto the Caravan, respect payload and space limits, roll orders over between departures, produce manifests. 3D load view lives here.",
  },
];

export default function Home() {
  return (
    <div>
      <p className="kicker">Nakina → Webequie · Cessna 208B</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">
        Groceries from Nakina to Webequie, in fewer totes.
      </h1>
      <p className="mt-2 max-w-2xl text-zinc-400">
        One app, three tabs: orders in, totes packed, aircraft loaded. Built
        for the Wilderness North / Zamiigo hackathon challenge.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="card group flex flex-col p-5 transition-colors hover:border-emerald-500/60 hover:shadow-lg hover:shadow-black/20"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-sm font-bold text-emerald-400">
                {t.step}
              </span>
              <h2 className="font-semibold text-zinc-100">{t.title}</h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              {t.desc}
            </p>
            <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-medium text-emerald-400">
              Open
              <span className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
