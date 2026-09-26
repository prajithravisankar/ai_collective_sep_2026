"use client";

// Flight Management: put the picking tab's totes on departures, respect
// payload/space/tote limits, show rollover, print manifests.
// The planning algorithm itself is Person A2's planFlights().

import Link from "next/link";
import { useRef, useState } from "react";
import { EmptyState, FillBar } from "@/components/ui";
import { parseFlightCapacityCsv } from "@/lib/csv";
import { planFlights, type LoadPlan } from "@/lib/flights";
import { cuft, lb, pct } from "@/lib/format";
import { sampleFlightCapacities } from "@/lib/sample-data";
import CabinMap from "@/components/CabinMap";
import { computeStacking, STACKING } from "@/lib/stacking";
import { useAppStore } from "@/lib/store";
import { AIRCRAFT, TOTE, type Flight, type Tote } from "@/lib/types";

export default function FlightManagementPage() {
  const store = useAppStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [plan, setPlan] = useState<LoadPlan | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  function runPlan(capacities: Flight[]) {
    try {
      setPlan(planFlights(store.totes, capacities));
      setPlanError(null);
    } catch (e) {
      setPlan(null);
      setPlanError(e instanceof Error ? e.message : String(e));
    }
  }

  async function onCapacityFile(file: File | undefined) {
    if (!file) return;
    const flights = await parseFlightCapacityCsv(file);
    store.setCapacities(flights);
    setPlan(null);
  }

  if (store.totes.length === 0) {
    return (
      <div>
        <h1 className="text-xl font-bold">Flight Management</h1>
        <div className="mt-8">
          <EmptyState title="No totes to load">
            Pack the batch on the{" "}
            <Link href="/picking" className="text-emerald-400 underline">
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

  return (
    <div>
      {/* ---------- screen ---------- */}
      <div className="print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">Flight Management</h1>
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
              className="rounded border border-zinc-600 px-4 py-2 text-sm hover:border-zinc-400"
            >
              Upload capacity CSV (Stage 2)
            </button>
            <button
              onClick={() => {
                store.setCapacities([fullCaravan()]);
                setPlan(null);
              }}
              className="rounded border border-zinc-600 px-4 py-2 text-sm hover:border-zinc-400"
            >
              One full Caravan (Stage 1)
            </button>
            <button
              onClick={() => {
                store.setCapacities(sampleFlightCapacities());
                setPlan(null);
              }}
              className="rounded border border-zinc-600 px-4 py-2 text-sm hover:border-zinc-400"
            >
              Sample departures
            </button>
          </div>
        </div>

        {store.capacities.length > 0 && (
          <>
            <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-950 text-left text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">Departure</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2 text-right">Totes</th>
                    <th className="px-3 py-2 text-right">Payload</th>
                    <th className="px-3 py-2 text-right">Space</th>
                  </tr>
                </thead>
                <tbody>
                  {store.capacities.map((f) => (
                    <tr key={f.departureId} className="border-t border-zinc-800">
                      <td className="px-3 py-2">#{f.departureId}</td>
                      <td className="px-3 py-2">{f.departureDate}</td>
                      <td className="px-3 py-2 text-right">
                        {f.availableTotes}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {lb(f.availablePayloadLb)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {cuft(f.availableVolumeCuFt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={() => runPlan(store.capacities)}
              className="mt-4 rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500"
            >
              Plan flights
            </button>
          </>
        )}

        {store.capacities.length === 0 && (
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
            <p className="mt-6 rounded border border-red-800 bg-red-950 px-4 py-2 text-sm text-red-300">
              Planning failed: {planError}
            </p>
          ))}

        {plan && (
          <>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {plan.flights.map((f) => (
                <FlightCard key={f.departureId} flight={f} totes={store.totes} />
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
              className="mt-6 rounded border border-zinc-600 px-4 py-2 text-sm hover:border-zinc-400"
            >
              Print manifests
            </button>
          </>
        )}

        <div className="mt-10 rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs text-zinc-400">
          <p className="font-semibold text-zinc-300">
            Aircraft, stacking model and sources (stated per the brief)
          </p>
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
                    className="text-emerald-400 underline"
                  >
                    {src.label}
                  </a>
                ) : (
                  src.label
                )}
              </span>
            ))}
          </p>
        </div>
      </div>

      {/* ---------- print: manifest per flight ---------- */}
      {plan && (
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
                  Nakina (CYQN) → Webequie (CYWP) · {loaded.length} totes ·{" "}
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

function FlightCard({ flight, totes }: { flight: Flight; totes: Tote[] }) {
  const [showMap, setShowMap] = useState(false);
  const loaded = flight.loadedToteIds
    .map((id) => totes.find((t) => t.toteId === id))
    .filter((t): t is Tote => !!t);
  const w = loaded.reduce((s, t) => s + t.weightLb, 0);
  const vol = loaded.length * TOTE.nominalVolumeCuFt;

  const margins = [
    ["weight", flight.availablePayloadLb ? w / flight.availablePayloadLb : 0],
    ["space", flight.availableVolumeCuFt ? vol / flight.availableVolumeCuFt : 0],
    ["totes", flight.availableTotes ? loaded.length / flight.availableTotes : 0],
  ] as const;
  const binding = margins.reduce((a, b) => (b[1] > a[1] ? b : a));

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-baseline justify-between">
        <p className="font-semibold text-emerald-400">
          Departure #{flight.departureId} · {flight.departureDate}
        </p>
        <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs">
          {binding[0]}-limited
        </span>
      </div>
      <div className="mt-3 space-y-2 text-sm">
        <Row
          label={`Weight ${lb(w)} / ${lb(flight.availablePayloadLb)}`}
          left={`${lb(flight.availablePayloadLb - w)} left`}
          value={margins[0][1] * 100}
        />
        <Row
          label={`Space ${cuft(vol)} / ${cuft(flight.availableVolumeCuFt)}`}
          left={`${cuft(flight.availableVolumeCuFt - vol)} left`}
          value={margins[1][1] * 100}
        />
        <Row
          label={`Totes ${loaded.length} / ${flight.availableTotes}`}
          left={`${flight.availableTotes - loaded.length} left`}
          value={margins[2][1] * 100}
        />
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        {loaded.map((t) => t.toteId).join(", ") || "empty"}
      </p>
      {loaded.length > 0 && <StackingLine count={loaded.length} />}
      {loaded.length > 0 && (
        <button
          onClick={() => setShowMap(!showMap)}
          className="mt-2 rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-emerald-400"
        >
          {showMap ? "Hide cabin map" : "Cabin map (seat-map view)"}
        </button>
      )}
      {showMap && loaded.length > 0 && <CabinMap totes={loaded} />}
    </div>
  );
}

function StackingLine({ count }: { count: number }) {
  const st = computeStacking(count);
  return (
    <p className="mt-2 border-t border-zinc-800 pt-2 text-xs text-zinc-400">
      Stacked {STACKING.totesAcross} across × {STACKING.layersHigh} high:{" "}
      {st.rowsUsed} of {STACKING.maxRows} rows →{" "}
      <span className="text-zinc-200">
        {st.lengthLeftIn.toFixed(1)}″ of cabin length free
      </span>{" "}
      ({st.moreTotesFit} more totes fit by dimensions)
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
