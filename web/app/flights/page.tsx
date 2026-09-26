"use client";

// Flight Management: put the picking tab's totes on departures, respect
// payload/space/tote limits, show rollover, print manifests.
// The planning algorithm itself is Person A2's planFlights().

import Link from "next/link";
import { useRef, useState } from "react";
import { EmptyState, FillBar } from "@/components/ui";
import { parseFlightCapacityCsv } from "@/lib/csv";
import { planFlights } from "@/lib/flights";
import { planRoutes, routeFor, toteCommunity } from "@/lib/routes";
import { cuft, lb } from "@/lib/format";
import { sampleFlightCapacities } from "@/lib/sample-data";
import CabinMap from "@/components/CabinMap";
import { computeStacking, STACKING } from "@/lib/stacking";
import { TOTE_LIFE_FLOW, useAppStore, type ToteLife } from "@/lib/store";
import { AIRCRAFT, TOTE, type Flight, type Tote } from "@/lib/types";

export default function FlightManagementPage() {
  const store = useAppStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const plan = store.plan;
  const [planError, setPlanError] = useState<string | null>(null);
  const [printDoc, setPrintDoc] = useState<
    { kind: "driver" | "slips"; departureId: string } | null
  >(null);

  function printFlightDoc(kind: "driver" | "slips", departureId: string) {
    setPrintDoc({ kind, departureId });
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintDoc(null), 500);
    }, 100);
  }

  function runPlan(capacities: Flight[]) {
    try {
      store.setPlan(planFlights(store.totes, capacities));
      setPlanError(null);
    } catch (e) {
      store.setPlan(null);
      setPlanError(e instanceof Error ? e.message : String(e));
    }
  }

  async function onCapacityFile(file: File | undefined) {
    if (!file) return;
    store.setCapacities(await parseFlightCapacityCsv(file));
  }

  if (store.totes.length === 0) {
    return (
      <div>
        <p className="kicker">Step 3 · Aircraft loaded</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          Flight Management
        </h1>
        <div className="mt-8">
          <EmptyState title="No totes to load">
            Pack the batch on the{" "}
            <Link href="/picking" className="text-emerald-400 underline decoration-emerald-400/40 underline-offset-2 hover:text-emerald-300">
              Order Picking tab
            </Link>{" "}
            first — flight planning uses those exact totes and weights.
          </EmptyState>
        </div>
      </div>
    );
  }

  const totalW = store.totes.reduce((s, t) => s + t.weightLb, 0);
  const totalVolCuFt = store.totes.length * TOTE.nominalVolumeCuFt;
  const communities = [...new Set(store.totes.map(toteCommunity))].sort();
  const routePreview = communities.length > 1 ? planRoutes(store.totes) : null;

  return (
    <div>
      {/* ---------- screen ---------- */}
      <div className="print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="kicker">Step 3 · Aircraft loaded</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              Flight Management
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              {store.totes.length} totes waiting · {lb(totalW)} ·{" "}
              {cuft(totalVolCuFt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => onCapacityFile(e.target.files?.[0])}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="btn btn-secondary"
            >
              Upload capacity CSV (Stage 2)
            </button>
            <button
              onClick={() => {
                store.setCapacities([fullCaravan()]);
              }}
              className="btn btn-secondary"
            >
              One full Caravan (Stage 1)
            </button>
            <button
              onClick={() => {
                store.setCapacities(sampleFlightCapacities());
              }}
              className="btn btn-secondary"
            >
              Sample departures
            </button>
          </div>
        </div>

        {communities.length > 1 && (
          <div className="card mt-6 p-4">
            <p className="kicker">Bonus objective · multi-community</p>
            <h2 className="mt-1 font-semibold">
              Route planner — {communities.length} communities, one Caravan
            </h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-edge">
              <table className="w-full min-w-[440px] text-sm">
                <thead className="bg-surface text-left text-[11px] uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Destination</th>
                    <th className="px-4 py-2.5 font-medium">Airport</th>
                    <th className="px-4 py-2.5 text-right font-medium">Flight hrs</th>
                    <th className="px-4 py-2.5 text-right font-medium">Payload</th>
                    <th className="px-4 py-2.5 text-right font-medium">Load waiting</th>
                  </tr>
                </thead>
                <tbody>
                  {communities.map((c) => {
                    const r = routeFor(c);
                    const w = store.totes
                      .filter((t) => toteCommunity(t) === c)
                      .reduce((s2, t) => s2 + t.weightLb, 0);
                    return (
                      <tr key={c} className="border-t border-edge">
                        <td className="px-4 py-2">{c}</td>
                        <td className="px-4 py-2 text-zinc-400">{r.airport}</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {r.flightHours.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {lb(r.payloadLb)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {lb(w)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {routePreview && (
              <div className="mt-3 space-y-1 text-xs">
                <p className="text-zinc-400">
                  Separate vs combined round trips (fuel by the brief&apos;s own
                  lb/mile; payload = 3,923 lb − fuel):
                </p>
                {routePreview.options.map((o) => (
                  <p
                    key={o.label}
                    className={
                      o.label === routePreview.chosenLabel
                        ? "font-medium text-emerald-300"
                        : o.feasible
                          ? "text-zinc-400"
                          : "text-zinc-600 line-through"
                    }
                  >
                    {o.label} → {o.totalHours.toFixed(2)} h · {o.flightsCount}{" "}
                    flight{o.flightsCount === 1 ? "" : "s"}
                    {o.label === routePreview.chosenLabel && " ← chosen"}
                    {o.reason && ` (${o.reason})`}
                  </p>
                ))}
                <p className="pt-1 text-zinc-300">
                  Best plan saves{" "}
                  <span className="font-semibold text-emerald-400">
                    {routePreview.savedHours.toFixed(2)} h
                  </span>{" "}
                  (≈ ${(routePreview.savedHours * store.hourlyCostCad).toFixed(0)}
                  ) vs flying each community separately. Sequence: heaviest
                  load first; on a two-stop trip the first stop&apos;s totes load
                  last, nearest the cargo door.
                </p>
              </div>
            )}

            <button
              onClick={() => {
                if (!routePreview) return;
                store.setPlan({
                  flights: routePreview.flights,
                  rolledOverToteIds: [],
                });
                setPlanError(null);
              }}
              className="btn btn-primary mt-3"
            >
              Plan routes
            </button>
          </div>
        )}

        {store.capacities.length > 0 && (
          <>
            <div className="mt-6 overflow-x-auto rounded-xl border border-edge">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-surface text-left text-[11px] uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Departure</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 text-right font-medium">Totes</th>
                    <th className="px-4 py-3 text-right font-medium">Payload</th>
                    <th className="px-4 py-3 text-right font-medium">Space</th>
                  </tr>
                </thead>
                <tbody>
                  {store.capacities.map((f) => (
                    <tr key={f.departureId} className="border-t border-edge transition-colors hover:bg-zinc-800/40">
                      <td className="px-4 py-3">#{f.departureId}</td>
                      <td className="px-4 py-3">{f.departureDate}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <CapInput
                          value={f.availableTotes}
                          onChange={(n) =>
                            store.updateCapacity(f.departureId, {
                              availableTotes: n,
                            })
                          }
                        />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <CapInput
                          value={f.availablePayloadLb}
                          onChange={(n) =>
                            store.updateCapacity(f.departureId, {
                              availablePayloadLb: n,
                            })
                          }
                        />{" "}
                        lb
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <CapInput
                          value={f.availableVolumeCuFt}
                          step={0.1}
                          onChange={(n) =>
                            store.updateCapacity(f.departureId, {
                              availableVolumeCuFt: n,
                            })
                          }
                        />{" "}
                        cu ft
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              What-if: hold space changes at the last minute — edit any
              number above and re-plan to see what rolls over.
              {store.capacities.length > 0 && !plan && " Plan is stale — hit Plan flights."}
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <button
                onClick={() => runPlan(store.capacities)}
                className="btn btn-primary"
              >
                Plan flights
              </button>
              <label className="text-xs text-zinc-400">
                Charter cost $/hr (assumption)
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={store.hourlyCostCad}
                  onChange={(e) => store.setHourlyCost(Number(e.target.value))}
                  className="input mt-1 block w-28 px-2 py-1.5 text-sm"
                />
              </label>
            </div>
          </>
        )}

        {store.capacities.length === 0 && communities.length <= 1 && !plan && (
          <div className="mt-8">
            <EmptyState title="No departures yet">
              Upload the Stage 2 flight capacity CSV, or use one full Caravan
              for Stage 1.
            </EmptyState>
          </div>
        )}

        {planError &&
          (planError.includes("not implemented") ? (
            <div className="mt-6 rounded-lg border border-amber-800 bg-amber-950/40 p-4 text-sm text-amber-200">
              <p className="font-semibold">
                Waiting on the flight planning engine (Person A2)
              </p>
              <p className="mt-1 text-amber-200/80">
                The totes, weights and departure capacities above are ready.
                As soon as <code>planFlights()</code> in{" "}
                <code>web/lib/flights.ts</code> is implemented, this tab shows
                the load plan, rollover and manifests with no UI changes.
              </p>
            </div>
          ) : (
            <p className="mt-6 rounded-lg border border-red-900/70 bg-red-950/60 px-4 py-2.5 text-sm text-red-300">
              Planning failed: {planError}
            </p>
          ))}

        {plan && (
          <>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {plan.flights.map((f) => (
                <FlightCard
                  key={f.departureId}
                  flight={f}
                  totes={store.totes}
                  onPrint={(kind) => printFlightDoc(kind, f.departureId)}
                  onMark={(status) => store.markFlightTotes(f.loadedToteIds, status)}
                  lifecycle={store.toteLifecycle}
                  hourlyCost={store.hourlyCostCad}
                />
              ))}
            </div>

            {plan.rolledOverToteIds.length > 0 && (
              <div className="mt-6 rounded-lg border border-amber-800 bg-amber-950/40 p-4 text-sm">
                <p className="font-semibold text-amber-200">
                  Rolled over ({plan.rolledOverToteIds.length} totes missed
                  every departure)
                </p>
                <p className="mt-1 text-amber-200/80">
                  {plan.rolledOverToteIds.join(", ")}
                </p>
              </div>
            )}

            <button
              onClick={() => window.print()}
              className="btn btn-secondary mt-6"
            >
              Print manifests
            </button>
          </>
        )}

        <details className="card mt-10 p-4 text-xs text-zinc-400">
          <summary className="cursor-pointer font-semibold text-zinc-300">
            Aircraft, stacking model and sources (stated per the brief)
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>
              {AIRCRAFT.model}. Wilderness North Air operates the Cessna 208B
              (TSB aviation investigation A23O0028: occurrence aircraft
              C-GMVB, based in Nakina).
            </li>
            <li>
              Freighter cabin {AIRCRAFT.cabinLengthIn}″ L ×{" "}
              {AIRCRAFT.cabinWidthIn}″ W × {AIRCRAFT.cabinHeightIn}″ H (341 cu
              ft), main cargo door {AIRCRAFT.cargoDoorIn[0]}″ ×{" "}
              {AIRCRAFT.cargoDoorIn[1]}″ — DHL Aviation C208B dimension
              sheet. Optional 83 cu ft belly pannier not counted.
            </li>
            <li>
              Stacking model: totes ({TOTE.lengthIn}×{TOTE.widthIn}×
              {TOTE.heightIn}″, rim 25×15.5″) load {STACKING.totesAcross}{" "}
              long-side across the {AIRCRAFT.cabinWidthIn}″ width (50″ used),
              stack {STACKING.layersHigh} high (44 of{" "}
              {AIRCRAFT.cabinHeightIn}″), in {STACKING.maxRows} rows of 15.5″
              along the cabin → {STACKING.maxTotesByDimensions} totes by
              dimensions, consistent with the operator’s 90-tote estimate in
              the brief.
            </li>
            <li>
              Payload to Webequie {lb(AIRCRAFT.payloadLb)} (brief: 169 nm leg,
              fuel deducted). Volume accounting uses the brief’s nominal tote
              footprint of 3,600 cu in ({TOTE.nominalVolumeCuFt.toFixed(2)} cu
              ft) — the Stage 2 capacity data matches it exactly.
            </li>
          </ul>
          <p className="mt-2">
            Sources:{" "}
            {AIRCRAFT.sources.map((src, i) => (
              <span key={src.label}>
                {i > 0 && " · "}
                {src.url ? (
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 underline decoration-emerald-400/40 underline-offset-2 hover:text-emerald-300"
                  >
                    {src.label}
                  </a>
                ) : (
                  src.label
                )}
              </span>
            ))}
          </p>
        </details>
      </div>

      {/* ---------- print: manifest per flight ---------- */}
      {plan && !printDoc && (
        <div className="hidden bg-white p-8 text-black print:block">
          {plan.flights.map((f) => {
            const loaded = f.loadedToteIds
              .map((id) => store.totes.find((t) => t.toteId === id))
              .filter((t): t is Tote => !!t);
            const w = loaded.reduce((s, t) => s + t.weightLb, 0);
            return (
              <section key={f.departureId} className="break-after-page">
                <h1 className="text-xl font-bold">
                  Flight manifest — Departure #{f.departureId} ·{" "}
                  {f.departureDate}
                </h1>
                <p className="text-sm">
                  Nakina (CYQN) → {f.destination ?? "Webequie (CYWP)"} ·{" "}
                  {loaded.length} totes ·{" "}
                  {lb(w)} of {lb(f.availablePayloadLb)} payload ·{" "}
                  {cuft(loaded.length * TOTE.nominalVolumeCuFt)} of{" "}
                  {cuft(f.availableVolumeCuFt)} · stacked 2 across × 4 high,{" "}
                  {computeStacking(loaded.length).rowsUsed} rows,{" "}
                  {computeStacking(loaded.length).lengthLeftIn.toFixed(0)}″
                  cabin length free
                </p>
                {loaded.map((t) => (
                  <div key={t.toteId} className="mt-3">
                    <h2 className="border-b border-black text-sm font-bold">
                      Tote {t.toteId} — {lb(t.weightLb)}
                    </h2>
                    <ul className="mt-1 pl-2 text-xs">
                      {t.contents.map((c) => (
                        <li key={c.orderId}>
                          Order {c.orderId} · Household{" "}
                          {c.items[0]?.householdId ?? "?"} · {c.items.length}{" "}
                          items
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      )}

      {/* ---------- print: driver sheet / household slips ---------- */}
      {plan && printDoc && (
        <FlightDocs
          kind={printDoc.kind}
          flight={plan.flights.find((f) => f.departureId === printDoc.departureId)}
          totes={store.totes}
          substitutions={store.substitutions}
        />
      )}

      {/* ---------- tote return tracker ---------- */}
      {store.totes.length > 0 && (
        <ToteTracker />
      )}
    </div>
  );
}

// Returnable totes are assets: "a local partner … brings the totes back".
function ToteTracker() {
  const store = useAppStore();
  const flightOfTote = new Map(
    (store.plan?.flights ?? []).flatMap((f) =>
      f.loadedToteIds.map((id) => [id, f] as const),
    ),
  );
  const out = store.totes.filter((t) => {
    const st = store.toteLifecycle[t.toteId]?.status ?? "packed";
    return st === "flown" || st === "delivered";
  }).length;
  const back = store.totes.filter(
    (t) => store.toteLifecycle[t.toteId]?.status === "returned",
  ).length;
  const days = (at?: number) =>
    at ? Math.max(0, Math.floor((Date.now() - at) / 86400000)) : 0;

  return (
    <div className="card mt-10 p-4 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="kicker">Returnable totes</p>
          <h2 className="mt-1 font-semibold">Tote tracker</h2>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="chip cursor-default">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> {out} still out
          </span>
          <span className="chip cursor-default">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {back} returned
          </span>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {groupTotesByFlight(store.totes, flightOfTote).map(([label, group]) => {
          const outHere = group.filter((t) =>
            ["flown", "delivered"].includes(
              store.toteLifecycle[t.toteId]?.status ?? "packed",
            ),
          ).length;
          return (
            <details
              key={label}
              className="rounded-xl border border-edge bg-surface"
            >
              <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
                <span className="font-medium">{label}</span>
                <span className="text-xs text-zinc-500">
                  {group.length} totes
                  {outHere > 0 && ` · ${outHere} still out`}
                </span>
              </summary>
              <ul className="border-t border-edge px-4 py-2">
                {group.map((t) => {
                  const life = store.toteLifecycle[t.toteId];
                  const status = life?.status ?? "packed";
                  return (
                    <li
                      key={t.toteId}
                      className="flex items-center justify-between gap-3 py-1.5 text-sm"
                    >
                      <span className="font-mono text-xs">{t.toteId}</span>
                      <span className="ml-auto text-xs text-zinc-500">
                        {status === "packed" || status === "returned"
                          ? ""
                          : `${days(life?.at)}d out`}
                      </span>
                      <select
                        value={status}
                        onChange={(e) =>
                          store.setToteStatus(
                            t.toteId,
                            e.target.value as ToteLife,
                          )
                        }
                        className="input px-2 py-1 text-xs"
                      >
                        {TOTE_LIFE_FLOW.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}
      </div>
    </div>
  );
}

function groupTotesByFlight(
  totes: Tote[],
  flightOfTote: Map<string, Flight>,
): [string, Tote[]][] {
  const groups = new Map<string, Tote[]>();
  for (const t of totes) {
    const f = flightOfTote.get(t.toteId);
    const label = f
      ? `Flight #${f.departureId} · ${f.departureDate}`
      : "Not on a flight yet";
    groups.set(label, [...(groups.get(label) ?? []), t]);
  }
  return [...groups.entries()];
}

// Printable docs for the drop-off partner and the households.
function FlightDocs({
  kind,
  flight,
  totes,
  substitutions,
}: {
  kind: "driver" | "slips";
  flight: Flight | undefined;
  totes: Tote[];
  substitutions: Record<string, string>;
}) {
  if (!flight) return null;
  const loaded = flight.loadedToteIds
    .map((id) => totes.find((t) => t.toteId === id))
    .filter((t): t is Tote => !!t);

  // household -> orders/totes/weight
  const households = new Map<
    string,
    { orders: Set<string>; toteIds: Set<string>; weightLb: number; items: { name: string; qty: number; sub?: string }[] }
  >();
  for (const t of loaded) {
    for (const c of t.contents) {
      const hh = c.items[0]?.householdId ?? "?";
      const entry =
        households.get(hh) ?? { orders: new Set(), toteIds: new Set(), weightLb: 0, items: [] };
      entry.orders.add(c.orderId);
      entry.toteIds.add(t.toteId);
      for (const i of c.items) {
        entry.weightLb += i.weightLb;
        const existing = entry.items.find((x) => x.name === i.productName);
        if (existing) existing.qty += 1;
        else
          entry.items.push({
            name: i.productName,
            qty: 1,
            sub: substitutions[`${c.orderId}::${i.productName}`],
          });
      }
      households.set(hh, entry);
    }
  }
  const rows = [...households.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  if (kind === "driver")
    return (
      <div className="hidden bg-white p-8 text-black print:block">
        <h1 className="text-xl font-bold">
          Door-to-door drop-off — {flight.destination ?? "Webequie"} ·{" "}
          {flight.departureDate}
        </h1>
        <p className="text-sm">
          {flight.destination ?? "Webequie"} · {rows.length} households ·{" "}
          {loaded.length} totes (all totes come back)
        </p>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-black text-left">
              <th className="py-1">Household</th>
              <th className="py-1">Orders</th>
              <th className="py-1">Totes</th>
              <th className="py-1 text-right">Weight</th>
              <th className="py-1 pl-6">Received (sign)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([hh, e]) => (
              <tr key={hh} className="border-b border-gray-300">
                <td className="py-2 font-semibold">{hh}</td>
                <td className="py-2">{[...e.orders].join(", ")}</td>
                <td className="py-2">{[...e.toteIds].join(", ")}</td>
                <td className="py-2 text-right">{e.weightLb.toFixed(1)} lb</td>
                <td className="py-2 pl-6 text-gray-400">____________________</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  return (
    <div className="hidden bg-white p-8 text-black print:block">
      {rows.map(([hh, e]) => (
        <section key={hh} className="break-after-page">
          <h1 className="text-lg font-bold">Your Zamiigo delivery — Household {hh}</h1>
          <p className="text-sm">
            Flight #{flight.departureId} · {flight.departureDate} · totes{" "}
            {[...e.toteIds].join(", ")} · {e.weightLb.toFixed(1)} lb
          </p>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {e.items.map((i) => (
                <tr key={i.name} className="border-b border-gray-300">
                  <td className="w-8 py-0.5">{i.qty}×</td>
                  <td className="py-0.5">
                    {i.name}
                    {i.sub && (
                      <span className="block text-[10px]">↺ substituted: {i.sub}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs">
            Totes are returnable — please hand them back to the driver. Orders:{" "}
            {[...e.orders].join(", ")}.
          </p>
        </section>
      ))}
    </div>
  );
}

function fullCaravan(): Flight {
  return {
    departureId: "1",
    departureDate: new Date().toISOString().slice(0, 10),
    availableTotes: AIRCRAFT.maxTotes,
    availablePayloadLb: AIRCRAFT.payloadLb,
    availableVolumeCuFt: AIRCRAFT.cargoVolumeCuFt,
    loadedToteIds: [],
  };
}

function FlightCard({
  flight,
  totes,
  onPrint,
  onMark,
  lifecycle,
  hourlyCost,
}: {
  flight: Flight;
  totes: Tote[];
  onPrint: (kind: "driver" | "slips") => void;
  onMark: (status: "flown" | "delivered") => void;
  lifecycle: Record<string, { status: string; at: number }>;
  hourlyCost: number;
}) {
  const [showMap, setShowMap] = useState(false);
  const loaded = flight.loadedToteIds
    .map((id) => totes.find((t) => t.toteId === id))
    .filter((t): t is Tote => !!t);
  const w = loaded.reduce((s, t) => s + t.weightLb, 0);
  const vol = loaded.length * TOTE.nominalVolumeCuFt;

  // Same rounding slack the planner uses: a load it accepted must never
  // render as an overflow (no "-0.0 cu ft left", no red bar).
  const weightLeft = Math.max(0, flight.availablePayloadLb - w);
  const volLeft = Math.max(0, flight.availableVolumeCuFt - vol);
  const totesLeft = Math.max(0, flight.availableTotes - loaded.length);
  const frac = (used: number, avail: number) =>
    avail ? Math.min(1, used / avail) : 0;
  const margins = [
    ["weight", frac(w, flight.availablePayloadLb)],
    ["space", frac(vol, flight.availableVolumeCuFt)],
    ["totes", frac(loaded.length, flight.availableTotes)],
  ] as const;
  const binding = margins.reduce((a, b) => (b[1] >= a[1] ? b : a));

  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between">
        <p className="font-semibold text-emerald-400">
          {flight.destination
            ? `${flight.departureDate} · ${flight.destination}`
            : `Departure #${flight.departureId} · ${flight.departureDate}`}
        </p>
        <span className="rounded-md border border-edge bg-raised px-2 py-0.5 text-xs">
          {binding[0]}-limited
        </span>
      </div>
      <div className="mt-3 space-y-2 text-sm">
        <Row
          label={`Weight ${lb(w)} / ${lb(flight.availablePayloadLb)}`}
          left={`${lb(weightLeft)} left`}
          value={margins[0][1] * 100}
        />
        <Row
          label={`Space ${cuft(vol)} / ${cuft(flight.availableVolumeCuFt)}`}
          left={`${cuft(volLeft)} left`}
          value={margins[1][1] * 100}
        />
        <Row
          label={`Totes ${loaded.length} / ${flight.availableTotes}`}
          left={`${totesLeft} left`}
          value={margins[2][1] * 100}
        />
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        {loaded
          .map((t) => t.toteId)
          .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
          .join(", ") || "empty"}
      </p>
      {loaded.length > 0 && <StackingLine count={loaded.length} />}
      {loaded.length > 0 && hourlyCost > 0 && (
        <p className="mt-2 text-xs text-zinc-400">
          Est. flight cost $
          {((flight.flightHours ?? AIRCRAFT.roundTripHours) * hourlyCost).toFixed(0)}{" "}
          ({(flight.flightHours ?? AIRCRAFT.roundTripHours).toFixed(2)} h × $
          {hourlyCost}/h) ÷{" "}
          {new Set(loaded.flatMap((t) => t.contents.map((c) => c.orderId))).size}{" "}
          orders ={" "}
          <span className="text-zinc-200">
            $
            {(
              ((flight.flightHours ?? AIRCRAFT.roundTripHours) * hourlyCost) /
              Math.max(
                1,
                new Set(loaded.flatMap((t) => t.contents.map((c) => c.orderId)))
                  .size,
              )
            ).toFixed(0)}
            /order
          </span>
        </p>
      )}
      {loaded.length > 0 && (
        <button
          onClick={() => setShowMap(!showMap)}
          className="btn btn-secondary btn-sm mt-2"
        >
          {showMap ? "Hide cabin map" : "Cabin map (seat-map view)"}
        </button>
      )}
      {showMap && loaded.length > 0 && <CabinMap totes={loaded} />}
      {loaded.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-edge pt-3">
          <button onClick={() => onPrint("driver")} className="btn btn-secondary btn-sm">
            Driver drop-off sheet
          </button>
          <button onClick={() => onPrint("slips")} className="btn btn-secondary btn-sm">
            Household slips
          </button>
          <span className="mx-1 hidden border-l border-edge sm:block" />
          <button onClick={() => onMark("flown")} className="btn btn-secondary btn-sm">
            Mark totes flown
          </button>
          <button onClick={() => onMark("delivered")} className="btn btn-secondary btn-sm">
            Mark delivered
          </button>
          <span className="self-center text-[10px] text-zinc-500">
            {loaded.filter((t) => lifecycle[t.toteId]?.status === "returned").length}
            /{loaded.length} totes back
          </span>
        </div>
      )}
    </div>
  );
}

function StackingLine({ count }: { count: number }) {
  const st = computeStacking(count);
  return (
    <p className="mt-2 border-t border-zinc-800 pt-2 text-xs text-zinc-400">
      Stacked {STACKING.totesAcross} across × {STACKING.layersHigh} high in{" "}
      {st.rowsUsed} row{st.rowsUsed === 1 ? "" : "s"} →{" "}
      <span className="text-zinc-200">
        {st.lengthLeftIn.toFixed(1)}″ of cabin length free
      </span>
    </p>
  );
}

function Row({
  label,
  left,
  value,
}: {
  label: string;
  left: string;
  value: number;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs text-zinc-400">
        <span>{label}</span>
        <span>{left}</span>
      </div>
      <div className="mt-1">
        <FillBar value={value} />
      </div>
    </div>
  );
}

function CapInput({
  value,
  onChange,
  step = 1,
}: {
  value: number;
  onChange: (n: number) => void;
  step?: number;
}) {
  return (
    <input
      type="number"
      min={0}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className="input w-20 px-2 py-1 text-right text-xs tabular-nums"
    />
  );
}
