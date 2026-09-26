"use client";

// Ops overview — the control tower. Live numbers from the shared store;
// the three workflow cards below take you to the work.

import Link from "next/link";
import { useMemo } from "react";
import {
  CAT,
  ChartCard,
  ColumnChart,
  DataTable,
  HBarList,
  MeterList,
  ORDINAL,
  ShareBar,
} from "@/components/charts";
import { STATUS_DOT } from "@/components/ui";
import { STATUS_FLOW, useAppStore } from "@/lib/store";
import { AIRCRAFT } from "@/lib/types";

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
    desc: "Load totes onto the Caravan, respect payload and space limits, roll orders over between departures, produce manifests.",
  },
];

export default function Home() {
  const store = useAppStore();
  const hasData = store.orders.length > 0;

  // --- derived stats ---
  const statusCounts = STATUS_FLOW.map(
    (s) => [s, store.orders.filter((o) => o.status === s).length] as const,
  );
  const avgFill = store.totes.length
    ? store.totes.reduce((a, t) => a + t.fillPercent, 0) / store.totes.length
    : 0;
  const totesSaved =
    store.baselineToteCount !== null && store.totes.length > 0
      ? store.baselineToteCount - store.totes.length
      : null;

  const lifeOf = (id: string) => store.toteLifecycle[id]?.status ?? "packed";
  const totesOut = store.totes.filter((t) =>
    ["flown", "delivered"].includes(lifeOf(t.toteId)),
  ).length;
  const totesBack = store.totes.filter(
    (t) => lifeOf(t.toteId) === "returned",
  ).length;

  const flownFlights =
    store.plan?.flights.filter((f) => f.loadedToteIds.length > 0) ?? [];
  const nextFlight = flownFlights[0];
  const nextFlightWeight = nextFlight
    ? nextFlight.loadedToteIds.reduce(
        (a, id) =>
          a + (store.totes.find((t) => t.toteId === id)?.weightLb ?? 0),
        0,
      )
    : 0;
  const ordersFlying = new Set(
    flownFlights.flatMap((f) =>
      f.loadedToteIds.flatMap(
        (id) =>
          store.totes
            .find((t) => t.toteId === id)
            ?.contents.map((c) => c.orderId) ?? [],
      ),
    ),
  ).size;
  const costPerOrder =
    flownFlights.length > 0 && ordersFlying > 0 && store.hourlyCostCad > 0
      ? (flownFlights.length * AIRCRAFT.roundTripHours * store.hourlyCostCad) /
        ordersFlying
      : null;
  const subCount = Object.keys(store.substitutions).length;

  // ---------- analytics ----------
  const byDay = useMemo(() => {
    const m = new Map<string, { orders: Set<string>; weight: number }>();
    for (const o of store.orders) {
      const d = o.orderDate || "batch";
      const e = m.get(d) ?? { orders: new Set<string>(), weight: 0 };
      e.orders.add(o.orderId);
      e.weight += o.totalWeightLb;
      m.set(d, e);
    }
    return [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, e]) => ({
        label: label.slice(5) || label,
        value: e.weight,
        orders: e.orders.size,
      }));
  }, [store.orders]);

  const byCommunity = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of store.orders)
      m.set(
        o.destinationCommunity,
        (m.get(o.destinationCommunity) ?? 0) + o.totalWeightLb,
      );
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({
        label,
        value,
        color: CAT[i % CAT.length],
      }));
  }, [store.orders]);

  const fillBuckets = useMemo(() => {
    const buckets = [
      { label: "<70%", value: 0 },
      { label: "70–85%", value: 0 },
      { label: "85–95%", value: 0 },
      { label: "95%+", value: 0 },
    ];
    for (const t of store.totes) {
      const f = t.fillPercent;
      buckets[f < 70 ? 0 : f < 85 ? 1 : f < 95 ? 2 : 3].value += 1;
    }
    return buckets;
  }, [store.totes]);

  const topProducts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of store.items)
      m.set(i.productName, (m.get(i.productName) ?? 0) + i.weightLb);
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value }));
  }, [store.items]);

  const utilization = useMemo(() => {
    if (!store.plan) return [];
    return store.plan.flights
      .filter((f) => f.loadedToteIds.length > 0)
      .map((f) => ({
        label: f.destination
          ? `${f.departureDate} · ${f.destination}`
          : `#${f.departureId} · ${f.departureDate}`,
        used: f.loadedToteIds.reduce(
          (s2, id) =>
            s2 + (store.totes.find((t) => t.toteId === id)?.weightLb ?? 0),
          0,
        ),
        limit: f.availablePayloadLb,
        detail: `${f.loadedToteIds.length} totes`,
      }))
      .map((d) => ({ ...d, detail: `${d.used.toFixed(0)}/${d.limit} lb · ${d.detail}` }));
  }, [store.plan, store.totes]);

  const statusSegs = statusCounts
    .map(([label, n], i) => ({ label, value: n, color: ORDINAL[i] }))
    .filter((seg) => seg.value > 0);

  return (
    <div>
      <p className="kicker">Nakina → Webequie · Cessna 208B</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">
        {hasData ? "Ops overview" : "Groceries from Nakina to Webequie, in fewer totes."}
      </h1>
      {!hasData && (
        <p className="mt-2 max-w-2xl text-zinc-400">
          One app, three steps: orders in, totes packed, aircraft loaded. Built
          for the Wilderness North / Zamiigo hackathon challenge. Start with
          the sample data on Order Entry.
        </p>
      )}

      {hasData && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Tile label="Orders in batch" value={String(store.orders.length)}>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {statusCounts.map(([s, n]) => (
                <span
                  key={s}
                  className="flex items-center gap-1 text-xs text-zinc-400"
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[s]}`}
                  />
                  {n} {s}
                </span>
              ))}
            </div>
          </Tile>

          <Tile
            label="Totes packed"
            value={store.totes.length ? String(store.totes.length) : "—"}
          >
            <p className="mt-2 text-xs text-zinc-400">
              {store.totes.length
                ? `${Math.round(avgFill)}% average fill${
                    totesSaved !== null && totesSaved > 0
                      ? ` · saves ${totesSaved} totes vs one-per-household`
                      : ""
                  }`
                : "Pack the batch on Order Picking"}
            </p>
          </Tile>

          <Tile
            label="Next departure"
            value={
              nextFlight
                ? `#${nextFlight.departureId} · ${nextFlight.departureDate}`
                : "—"
            }
          >
            <p className="mt-2 text-xs text-zinc-400">
              {nextFlight
                ? `${nextFlight.loadedToteIds.length} totes · ${nextFlightWeight.toFixed(0)} of ${nextFlight.availablePayloadLb} lb`
                : "Plan flights on Flight Management"}
            </p>
          </Tile>

          <Tile label="Returnable totes" value={`${totesOut} out`}>
            <p className="mt-2 text-xs text-zinc-400">
              {totesBack} returned · {store.totes.length - totesOut - totesBack}{" "}
              at the store
            </p>
          </Tile>

          <Tile label="Substitutions" value={String(subCount)}>
            <p className="mt-2 text-xs text-zinc-400">
              recorded by pickers · follow every order to the receipt
            </p>
          </Tile>

          <Tile
            label="Est. cost per order"
            value={costPerOrder !== null ? `$${costPerOrder.toFixed(0)}` : "—"}
          >
            <p className="mt-2 text-xs text-zinc-400">
              {costPerOrder !== null
                ? `${flownFlights.length} flight${flownFlights.length > 1 ? "s" : ""} × ${AIRCRAFT.roundTripHours} h × $${store.hourlyCostCad}/h ÷ ${ordersFlying} orders`
                : "plan flights + set $/hr on Flight Management"}
            </p>
          </Tile>
        </div>
      )}

      {hasData && (
        <section className="mt-8">
          <p className="kicker">Analytics · this batch</p>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Demand by day"
              sub="weight placed per order day — how big is tomorrow's plane?"
            >
              <ColumnChart
                data={byDay}
                unit="lb"
                tooltip={(d) => {
                  const day = byDay.find((x) => x.label === d.label);
                  return [
                    d.label,
                    `${Math.round(d.value).toLocaleString()} lb · ${day?.orders ?? 0} orders`,
                  ];
                }}
              />
              <DataTable
                head={["Day", "Orders", "Weight (lb)"]}
                rows={byDay.map((d) => [d.label, d.orders, d.value.toFixed(1)])}
              />
            </ChartCard>

            <ChartCard
              title="Order pipeline"
              sub="every order's stage, entered → picked"
            >
              {statusSegs.length > 0 ? (
                <>
                  <ShareBar
                    segments={statusSegs}
                    format={(v) => `${v} orders`}
                  />
                  <DataTable
                    head={["Status", "Orders"]}
                    rows={statusCounts.map(([sName, n]) => [sName, n])}
                  />
                </>
              ) : (
                <p className="text-xs text-zinc-500">No orders yet.</p>
              )}
              <div className="mt-4 border-t border-edge pt-3">
                <p className="mb-2 text-xs font-medium text-zinc-300">
                  Heaviest products in the batch
                </p>
                <HBarList
                  data={topProducts}
                  format={(v) => `${v.toFixed(0)} lb`}
                />
              </div>
            </ChartCard>

            {byCommunity.length > 1 && (
              <ChartCard
                title="Load by community"
                sub="who this batch flies to, by weight"
              >
                <ShareBar
                  segments={byCommunity}
                  format={(v) => `${v.toFixed(0)} lb`}
                />
                <DataTable
                  head={["Community", "Weight (lb)"]}
                  rows={byCommunity.map((c) => [c.label, c.value.toFixed(1)])}
                />
              </ChartCard>
            )}

            {store.totes.length > 0 && (
              <ChartCard
                title="Tote fill distribution"
                sub="how tightly the packer fills each tote (by volume)"
              >
                <ColumnChart
                  data={fillBuckets}
                  unit="totes"
                  tooltip={(d) => [d.label + " full", `${d.value} totes`]}
                />
                <DataTable
                  head={["Fill", "Totes"]}
                  rows={fillBuckets.map((b) => [b.label, b.value])}
                />
              </ChartCard>
            )}

            {utilization.length > 0 && (
              <ChartCard
                title="Payload used per departure"
                sub="fill of each flight against its own payload limit"
              >
                <MeterList data={utilization} />
                <DataTable
                  head={["Departure", "Used (lb)", "Limit (lb)"]}
                  rows={utilization.map((u) => [
                    u.label,
                    u.used.toFixed(0),
                    u.limit,
                  ])}
                />
              </ChartCard>
            )}
          </div>
        </section>
      )}

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

      <p className="mt-6 text-sm text-zinc-500">
        Someone calling about their order?{" "}
        <Link
          href="/track"
          className="text-emerald-400 underline decoration-emerald-400/40 underline-offset-2 hover:text-emerald-300"
        >
          Track an order →
        </Link>
      </p>
    </div>
  );
}

function Tile({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="card p-4">
      <p className="text-[11px] uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums tracking-tight">
        {value}
      </p>
      {children}
    </div>
  );
}
