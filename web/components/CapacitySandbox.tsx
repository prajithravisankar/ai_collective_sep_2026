"use client";

import { useMemo, useState } from "react";
import { planFlights, type LoadPlan } from "@/lib/flights";
import { flightMetrics } from "@/lib/flight-metrics";
import { calculateScenario, compareScenarios, type CapacityValues } from "@/lib/scenario-comparison";
import type { Flight, Tote } from "@/lib/types";

type Props = { totes: Tote[]; capacities: Flight[] };
const fields = [
  { key: "availablePayloadLb", label: "Payload", unit: "lb", step: "any" },
  { key: "availableTotes", label: "Tote slots", unit: "slots", step: "1" },
  { key: "availableVolumeCuFt", label: "Cargo volume", unit: "cu ft", step: "any" },
] as const;
const number = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 });
const departure = (flight: Flight | null) => flight ? `#${flight.departureId} · ${flight.departureDate}` : "Unscheduled";
const draftFor = (flight: Flight) => ({
  availablePayloadLb: String(flight.availablePayloadLb),
  availableTotes: String(flight.availableTotes),
  availableVolumeCuFt: String(flight.availableVolumeCuFt),
});

export default function CapacitySandbox({ totes, capacities }: Props) {
  // Reset the entire session whenever its source data changes. No writes to
  // the shared store or browser storage, including on navigation/unmount.
  const sourceKey = useMemo(() => JSON.stringify([totes, capacities]), [totes, capacities]);
  return (
    <section aria-labelledby="capacity-sandbox-title" className="card mt-8 p-4 sm:p-6 print:hidden">
      <h2 id="capacity-sandbox-title" className="kicker">Live Capacity Sandbox</h2>
      <p className="mt-2 text-sm text-zinc-400">Decision-support preview. Test one departure at a time; uploaded capacities and the operational plan stay unchanged.</p>
      {!totes.length || !capacities.length ? (
        <p className="mt-4 text-sm text-zinc-300">Pack orders into totes and load a capacity CSV or one full Caravan to try a scenario.</p>
      ) : <SandboxSession key={sourceKey} totes={totes} capacities={capacities} />}
    </section>
  );
}

function SandboxSession({ totes, capacities }: Props) {
  const baseline = useMemo(() => planFlights(totes, capacities.map((flight) => ({ ...flight, loadedToteIds: [...flight.loadedToteIds] }))), [totes, capacities]);
  const [selectedId, setSelectedId] = useState(baseline.flights[0].departureId);
  const selected = baseline.flights.find((flight) => flight.departureId === selectedId)!;
  const [draft, setDraft] = useState(() => draftFor(selected));
  const [scenario, setScenario] = useState<LoadPlan | null>(null);
  const [error, setError] = useState("");
  const result = scenario ?? baseline;
  const scenarioFlight = result.flights.find((flight) => flight.departureId === selectedId)!;
  const impact = useMemo(() => compareScenarios(totes, baseline, result), [totes, baseline, result]);
  const pending = fields.some(({ key }) => draft[key].trim() === "" || Number(draft[key]) !== scenarioFlight[key]);

  function reset(flight = selected) {
    setDraft(draftFor(flight));
    setScenario(null);
    setError("");
  }

  return (
    <div className="mt-5 space-y-5">
      <p className="text-xs text-zinc-500">Baseline: the existing departure planner run on the current capacity data and packed totes. Bonus multi-community route plans are separate. Changing departure or source data clears this preview.</p>
      <form onSubmit={(event) => {
        event.preventDefault();
        try {
          if (fields.some(({ key }) => draft[key].trim() === "")) throw new Error("Enter all three capacities.");
          const values: CapacityValues = {
            availablePayloadLb: Number(draft.availablePayloadLb),
            availableTotes: Number(draft.availableTotes),
            availableVolumeCuFt: Number(draft.availableVolumeCuFt),
          };
          setScenario(calculateScenario(totes, capacities, selectedId, values));
          setError("");
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Unable to calculate this scenario.");
        }
      }}>
        <label className="block text-sm text-zinc-300">
          Selected departure
          <select className="input mt-1 block w-full sm:max-w-md" value={selectedId} onChange={(event) => {
            const flight = baseline.flights.find((entry) => entry.departureId === event.target.value)!;
            setSelectedId(flight.departureId);
            reset(flight);
          }}>
            {baseline.flights.map((flight) => <option key={flight.departureId} value={flight.departureId}>{departure(flight)}</option>)}
          </select>
        </label>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {fields.map(({ key, label, unit, step }) => (
            <label key={key} className="block text-sm text-zinc-300">
              {label} ({unit})
              <input type="number" required min="0" step={step} value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} className="input mt-1 block w-full" />
              <span className="mt-1 block text-xs text-zinc-500">Original: {number(selected[key])} {unit}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" className="btn btn-primary">Recalculate Scenario</button>
          <button type="button" className="btn btn-secondary" onClick={() => reset()}>Reset</button>
          <button type="button" className="btn btn-secondary" onClick={() => setDraft({ ...draft, availablePayloadLb: String(Number((selected.availablePayloadLb * 0.85).toFixed(2))) })}>Reduce payload by 15%</button>
        </div>
      </form>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <p role="status" className="text-sm text-emerald-300">
        {scenario ? "Scenario calculated." : "Showing baseline; no scenario applied."}
        {pending && " Inputs changed — recalculate to update the results below."}
      </p>
      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <Comparison title={`Selected departure #${selectedId}`} before={[selected]} after={[scenarioFlight]} totes={totes} />
        <Comparison title="Overall plan" before={baseline.flights} after={result.flights} totes={totes} overall />
      </div>
      <p className="text-xs text-zinc-500">Complete orders means every packed tote belonging to an order is carried. Binding constraint follows the existing flight card: highest capped utilization (ties favor tote slots, then volume). Overall binding is listed per departure; zero capacity uses the existing 0% display convention.</p>
      <div aria-label="Scenario impact" className="border-t border-edge pt-4">
        <h3 className="font-semibold">Scenario impact</h3>
        <p className="mt-2 text-sm text-zinc-300">{impact.moved.length} totes changed departure · {impact.orders.length} orders affected · {impact.delayedOrders} orders delayed</p>
        <p className="mt-1 text-xs text-zinc-500">Unscheduled totes: {baseline.rolledOverToteIds.length} baseline → {result.rolledOverToteIds.length} scenario. Delayed means a tote moved to a later date; becoming unscheduled is reported separately. Same-date departures have no known time ordering.</p>
        {impact.moved.length === 0 ? <p className="mt-3 text-sm text-zinc-400">No tote assignments changed.</p> : (
          <>
            <div className="mt-4 max-h-96 overflow-auto rounded-lg border border-edge">
              <table className="w-full min-w-[640px] text-left text-sm">
                <caption className="p-3 text-left font-medium">Tote movements</caption>
                <thead className="bg-surface text-xs text-zinc-400"><tr>{["Tote ID", "Order IDs", "Original departure", "New departure", "Change"].map((label) => <th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead>
                <tbody>{impact.moved.map((move) => <tr key={move.toteId} className="border-t border-edge"><td className="p-3 font-mono">{move.toteId}</td><td className="p-3">{move.orderIds.join(", ")}</td><td className="p-3">{departure(move.from)}</td><td className="p-3">{departure(move.to)}</td><td className="p-3 text-amber-300">{move.movement}</td></tr>)}</tbody>
              </table>
            </div>
            <div className="mt-4 max-h-80 overflow-auto rounded-lg border border-edge">
              <table className="w-full min-w-[640px] text-left text-sm">
                <caption className="p-3 text-left font-medium">Affected orders</caption>
                <thead className="bg-surface text-xs text-zinc-400"><tr>{["Order ID", "Original departure", "New departure", "Change", "Became unscheduled", "Became scheduled"].map((label) => <th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead>
                <tbody>{impact.orders.map((order) => <tr key={order.orderId} className="border-t border-edge"><td className="p-3 font-mono">{order.orderId}</td><td className="p-3">{order.from.join(", ")}</td><td className="p-3">{order.to.join(", ")}</td><td className="p-3">{order.movements.join(", ")}</td><td className="p-3">{order.becameUnscheduled ? "Yes" : "No"}</td><td className="p-3">{order.becameScheduled ? "Yes" : "No"}</td></tr>)}</tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Comparison({ title, before, after, totes, overall = false }: { title: string; before: Flight[]; after: Flight[]; totes: Tote[]; overall?: boolean }) {
  const a = flightMetrics(before, totes);
  const b = flightMetrics(after, totes);
  const binding = (flights: Flight[], metrics: typeof a) => overall
    ? flights.map((flight) => `#${flight.departureId}: ${flightMetrics([flight], totes).binding[0]}`).join("; ")
    : metrics.binding[0];
  const rows = [
    ["Totes loaded", a.loaded.length, b.loaded.length],
    ["Complete orders carried", a.completeOrders, b.completeOrders],
    ["Payload used / available (lb)", `${number(a.weight)} / ${number(a.payload)}`, `${number(b.weight)} / ${number(b.payload)}`],
    ["Volume used / available (cu ft)", `${number(a.volume)} / ${number(a.space)}`, `${number(b.volume)} / ${number(b.space)}`],
    ["Tote slots used / available", `${a.loaded.length} / ${a.slots}`, `${b.loaded.length} / ${b.slots}`],
    ...["Payload utilization", "Volume utilization", "Tote-slot utilization"].map((label, index) => [label, `${number(a.margins[index][1] * 100)}%`, `${number(b.margins[index][1] * 100)}%`]),
    [overall ? "Binding constraint by departure" : "Binding constraint", binding(before, a), binding(after, b)],
  ];
  return (
    <div className="min-w-0 overflow-x-auto rounded-lg border border-edge">
      <table className="w-full min-w-[360px] text-left text-sm">
        <caption className="p-3 text-left font-semibold">{title}</caption>
        <thead className="bg-surface text-xs uppercase text-zinc-400"><tr><th scope="col" className="p-3">Metric</th><th scope="col" className="p-3">Baseline</th><th scope="col" className="p-3">Scenario</th></tr></thead>
        <tbody>{rows.map(([label, original, value]) => <tr key={label} className="border-t border-edge"><th scope="row" className="p-3 font-normal text-zinc-400">{label}</th><td className="p-3 tabular-nums">{original}</td><td className={`p-3 tabular-nums ${original !== value ? "text-amber-300" : ""}`}>{value}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
