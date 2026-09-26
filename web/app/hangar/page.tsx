"use client";

// 3D Hangar: the plane, the totes, and the copilot — nothing else.
// Ask the copilot "what's inside tote T8?" and the camera flies there
// while the tote opens; ask about a household and their totes light up.

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FocusState } from "@/components/Hangar3D";
import { EmptyState } from "@/components/ui";
import { lb, pct } from "@/lib/format";
import { onSceneEvent } from "@/lib/scene-bus";
import { useAppStore } from "@/lib/store";
import { toteCommunity } from "@/lib/routes";

const Hangar3D = dynamic(() => import("@/components/Hangar3D"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-sm text-zinc-500">
      Rolling the Caravan out of the hangar…
    </div>
  ),
});

export default function HangarPage() {
  const store = useAppStore();
  const [flightId, setFlightId] = useState<string | null>(null);
  const [focus, setFocus] = useState<FocusState>({ toteId: null, highlight: new Set() });
  const [focusLabel, setFocusLabel] = useState("");

  const flights = store.plan?.flights.filter((f) => f.loadedToteIds.length > 0) ?? [];
  const viewTotes = useMemo(() => {
    if (flightId) {
      const f = flights.find((x) => x.departureId === flightId);
      if (f)
        return f.loadedToteIds
          .map((id) => store.totes.find((t) => t.toteId === id))
          .filter((t): t is NonNullable<typeof t> => !!t);
    }
    return store.totes;
  }, [flightId, flights, store.totes]);

  // copilot tool calls steer the scene
  useEffect(
    () =>
      onSceneEvent((e) => {
        if (e.type === "clear") {
          setFocus({ toteId: null, highlight: new Set() });
          setFocusLabel("");
          return;
        }
        if (e.type === "focusTote") {
          // make sure the tote is in view — switch to the flight that carries it
          if (flightId) {
            const f = flights.find((x) => x.departureId === flightId);
            if (f && !f.loadedToteIds.includes(e.toteId)) setFlightId(null);
          }
          setFocus({ toteId: e.toteId, highlight: new Set() });
          setFocusLabel("");
        }
        if (e.type === "focusTotes") {
          if (flightId) setFlightId(null);
          setFocus({ toteId: null, highlight: new Set(e.toteIds) });
          setFocusLabel(e.label);
        }
      }),
    [flightId, flights],
  );

  const focused = store.totes.find((t) => t.toteId === focus.toteId);

  if (store.totes.length === 0) {
    return (
      <div>
        <p className="kicker">3D Hangar · agent-driven</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">The Hangar</h1>
        <div className="mt-6">
          <EmptyState title="No totes to load yet">
            Load a batch on{" "}
            <Link href="/entry" className="text-emerald-400 underline decoration-emerald-400/40 underline-offset-2">
              Order Entry
            </Link>{" "}
            and pack it on Order Picking — then come back and ask the copilot
            what&rsquo;s inside any tote.
          </EmptyState>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="kicker">3D Hangar · agent-driven</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">The Hangar</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Ask the copilot — &ldquo;what&rsquo;s inside tote T8?&rdquo;,
            &ldquo;where are household 617&rsquo;s groceries?&rdquo; — and watch
            the plane answer. Click any tote to open it by hand.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFlightId(null)}
            className={`chip ${flightId === null ? "chip-active" : ""}`}
          >
            All totes ({store.totes.length})
          </button>
          {flights.map((f) => (
            <button
              key={f.departureId}
              onClick={() => setFlightId(f.departureId)}
              className={`chip ${flightId === f.departureId ? "chip-active" : ""}`}
            >
              {f.destination ? `${f.departureDate} · ${f.destination}` : `#${f.departureId} · ${f.departureDate}`}
            </button>
          ))}
          {(focus.toteId || focus.highlight.size > 0) && (
            <button
              onClick={() => {
                setFocus({ toteId: null, highlight: new Set() });
                setFocusLabel("");
              }}
              className="btn btn-secondary btn-sm"
            >
              Reset view
            </button>
          )}
        </div>
      </div>

      <div className="relative mt-4 h-[calc(100dvh-16rem)] min-h-[24rem] overflow-hidden rounded-2xl border border-edge bg-gradient-to-b from-[#0d1211] to-[#080a0a]">
        <Hangar3D
          totes={viewTotes}
          focus={focus}
          onPick={(id) => {
            setFocus({ toteId: id, highlight: new Set() });
            setFocusLabel("");
          }}
        />

        {/* focus detail overlay */}
        {focused && (
          <aside className="absolute right-3 top-3 max-h-[calc(100%-1.5rem)] w-72 overflow-y-auto rounded-xl border border-emerald-500/40 bg-[#0b0f0e]/95 p-4 shadow-xl shadow-black/50 backdrop-blur">
            <div className="flex items-baseline justify-between">
              <p className="font-semibold text-emerald-300">Tote {focused.toteId}</p>
              <span className="text-xs text-zinc-500">{toteCommunity(focused)}</span>
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              {lb(focused.weightLb)} · {pct(focused.fillPercent)} full ·{" "}
              {store.toteLifecycle[focused.toteId]?.status ?? "packed"}
            </p>
            {focused.contents.map((c) => (
              <div key={c.orderId} className="mt-3 border-t border-edge pt-2">
                <p className="text-xs font-medium text-zinc-200">
                  Household {c.items[0]?.householdId ?? "?"}{" "}
                  <span className="font-mono text-[10px] text-zinc-500">{c.orderId}</span>
                </p>
                <ul className="mt-1 space-y-0.5">
                  {c.items.map((i, idx) => (
                    <li key={idx} className="flex justify-between gap-2 text-[11px] text-zinc-400">
                      <span className="truncate">{i.productName}</span>
                      <span className="shrink-0 tabular-nums">{lb(i.weightLb)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </aside>
        )}

        {focus.highlight.size > 0 && (
          <aside className="absolute right-3 top-3 w-72 rounded-xl border border-amber-500/50 bg-[#0f0d08]/95 p-4 shadow-xl shadow-black/50 backdrop-blur">
            <p className="text-xs font-semibold text-amber-300">{focusLabel || "Highlighted totes"}</p>
            <p className="mt-1 text-xs text-zinc-400">
              {[...focus.highlight].join(", ")} — click one to open it.
            </p>
          </aside>
        )}
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">
        Cabin and stacking use the same cited Cessna 208B model as everywhere
        else (178″ × 62″ × 51″, 2 across × 4 high). Drag to orbit, scroll to zoom.
      </p>
    </div>
  );
}
