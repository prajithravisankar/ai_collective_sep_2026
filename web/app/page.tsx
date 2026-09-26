import Link from "next/link";

const tabs = [
  {
    href: "/entry",
    title: "1 · Order Entry",
    desc: "Upload the orders CSV, prepare each household order for the retailer, track status from entered to picked.",
  },
  {
    href: "/picking",
    title: "2 · Order Picking",
    desc: "Group orders into shared totes, adjust the grouping, assign totes to carts, print pick lists, see weight and fill per tote.",
  },
  {
    href: "/flights",
    title: "3 · Flight Management",
    desc: "Load totes onto the Caravan, respect payload and space limits, roll orders over between departures, produce manifests. 3D load view lives here.",
  },
];

export default function Home() {
  return (
    <div>
      <h1 className="text-2xl font-bold">
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
            className="rounded-lg border border-zinc-700 bg-zinc-950 p-5 transition-colors hover:border-emerald-400"
          >
            <h2 className="font-semibold text-emerald-400">{t.title}</h2>
            <p className="mt-2 text-sm text-zinc-400">{t.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
