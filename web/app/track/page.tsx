"use client";

// "Where are my groceries?" — orders roll over between departures, so
// someone in Webequie is calling to ask. One search answers it:
// order/household -> status -> totes -> flight -> delivered/returned.

import { useMemo, useState } from "react";
import Link from "next/link";
import { EmptyState, STATUS_DOT } from "@/components/ui";
import { lb } from "@/lib/format";
import { STATUS_FLOW, useAppStore } from "@/lib/store";
import type { Order } from "@/lib/types";

export default function TrackPage() {
  const store = useAppStore();
  const [q, setQ] = useState("");

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return store.orders
      .filter(
        (o) =>
          o.orderId.toLowerCase().includes(needle) ||
          o.householdId.toLowerCase().includes(needle),
      )
      .slice(0, 8);
  }, [q, store.orders]);

  return (
    <div className="mx-auto max-w-2xl">
      <p className="kicker">Customer service</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">
        Where are my groceries?
      </h1>
      <p className="mt-2 text-sm text-zinc-400">
        Search an order or household to answer the call in one glance.
      </p>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Order ID or household ID…"
        className="input mt-4 w-full px-4 py-3 text-base"
        autoFocus
      />

      {store.orders.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No batch loaded">
            Load orders on the{" "}
            <Link
              href="/entry"
              className="text-emerald-400 underline decoration-emerald-400/40 underline-offset-2"
            >
              Order Entry tab
            </Link>{" "}
            first.
          </EmptyState>
        </div>
      ) : q.trim() === "" ? (
        <p className="mt-6 text-sm text-zinc-500">
          Try a household id from the batch — e.g.{" "}
          <button
            onClick={() => setQ(store.orders[0]?.householdId ?? "")}
            className="text-emerald-400 underline decoration-emerald-400/40 underline-offset-2"
          >
            {store.orders[0]?.householdId}
          </button>
        </p>
      ) : matches.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">
          Nothing in this batch matches “{q}”.
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          {matches.map((o) => (
            <TrackCard key={o.orderId} order={o} />
          ))}
        </div>
      )}
    </div>
  );
}

function TrackCard({ order }: { order: Order }) {
  const store = useAppStore();
  const toteIds = store.totes
    .filter((t) => t.contents.some((c) => c.orderId === order.orderId))
    .map((t) => t.toteId);
  const flight = store.plan?.flights.find((f) =>
    f.loadedToteIds.some((id) => toteIds.includes(id)),
  );
  const rolledOver =
    !!store.plan && toteIds.length > 0 && !flight
      ? store.plan.rolledOverToteIds.some((id) => toteIds.includes(id))
      : false;
  const lifecycle = toteIds.map(
    (id) => store.toteLifecycle[id]?.status ?? "packed",
  );
  const delivered = lifecycle.length > 0 && lifecycle.every((s) => s === "delivered" || s === "returned");
  const subCount = Object.keys(store.substitutions).filter((k) =>
    k.startsWith(`${order.orderId}::`),
  ).length;

  const steps: { label: string; done: boolean; detail?: string }[] = [
    ...STATUS_FLOW.map((s, i) => ({
      label: s,
      done: STATUS_FLOW.indexOf(order.status) >= i,
    })),
    {
      label: "on flight",
      done: !!flight,
      detail: flight
        ? `#${flight.departureId} · ${flight.departureDate}`
        : rolledOver
          ? "rolled over — next departure"
          : undefined,
    },
    { label: "delivered", done: delivered },
  ];

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">
          Order <span className="font-mono">{order.orderId}</span> · Household{" "}
          {order.householdId}
        </p>
        <span className="text-xs text-zinc-500">
          {order.items.length} items · {lb(order.totalWeightLb)} · placed{" "}
          {order.orderDate}
        </span>
      </div>

      <ol className="mt-4 flex flex-wrap items-center gap-y-3">
        {steps.map((step, i) => (
          <li key={step.label} className="flex items-center">
            {i > 0 && (
              <span
                className={`mx-1 h-px w-5 sm:w-8 ${steps[i].done ? "bg-emerald-500" : "bg-zinc-700"}`}
              />
            )}
            <span
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                step.done
                  ? "border-emerald-800 bg-emerald-950/50 text-emerald-300"
                  : "border-edge text-zinc-500"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  step.done
                    ? (STATUS_DOT as Record<string, string>)[step.label] ??
                      "bg-emerald-400"
                    : "bg-zinc-600"
                }`}
              />
              {step.label}
              {step.detail && (
                <span className="text-[10px] text-zinc-400">{step.detail}</span>
              )}
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-3 text-xs text-zinc-500">
        {toteIds.length > 0
          ? `In tote${toteIds.length > 1 ? "s" : ""} ${toteIds.join(", ")}`
          : "Not packed into a tote yet"}
        {rolledOver && " · waiting for the next departure"}
        {subCount > 0 && ` · ${subCount} substitution${subCount > 1 ? "s" : ""}`}
      </p>
    </div>
  );
}
