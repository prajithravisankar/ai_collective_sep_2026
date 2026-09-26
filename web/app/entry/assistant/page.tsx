"use client";

// Retailer typing assistant — attacks the brief's biggest stated pain:
// "Staff re-create each Zamiigo order by hand in the retailer's system,
// which is the largest source of manual work today."
// One order at a time, click-to-copy each product into the retailer's
// search box, check off as you type, mark submitted, next order.

import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui";
import { lb } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/lib/toast";
import type { Order } from "@/lib/types";

function aggregate(order: Order) {
  const byName = new Map<string, { qty: number; weightLb: number }>();
  for (const i of order.items) {
    const r = byName.get(i.productName) ?? { qty: 0, weightLb: 0 };
    r.qty += 1;
    r.weightLb += i.weightLb;
    byName.set(i.productName, r);
  }
  return [...byName.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export default function EntryAssistantPage() {
  const store = useAppStore();
  const toast = useToast();
  const [cursor, setCursor] = useState(0);
  const [typed, setTyped] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Queue = orders not yet submitted, oldest batch first.
  const queue = useMemo(
    () =>
      store.orders
        .filter((o) => o.status === "entered")
        .sort(
          (a, b) =>
            a.orderDate.localeCompare(b.orderDate) ||
            a.orderId.localeCompare(b.orderId),
        ),
    [store.orders],
  );
  const doneCount = store.orders.length - queue.length;
  const order = queue[Math.min(cursor, Math.max(0, queue.length - 1))];

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1200);
    } catch {
      // clipboard blocked — staff can still read & type
    }
  }

  if (store.orders.length === 0) {
    return (
      <div>
        <p className="kicker">Order Entry · Assistant</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          Retailer typing assistant
        </h1>
        <div className="mt-6">
          <EmptyState title="No orders loaded">
            Load a batch on the{" "}
            <Link
              href="/entry"
              className="text-emerald-400 underline decoration-emerald-400/40 underline-offset-2"
            >
              Order Entry tab
            </Link>{" "}
            first.
          </EmptyState>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="kicker">Order Entry · Assistant</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Retailer typing assistant
          </h1>
        </div>
        <Link href="/entry" className="btn btn-secondary btn-sm">
          Back to orders
        </Link>
      </div>
      <p className="mt-2 text-sm text-zinc-400">
        Work the batch one household at a time: copy each product into the
        retailer&apos;s search, tick it, submit, next.
      </p>

      <div className="card mt-4 p-3">
        <div className="flex justify-between text-sm">
          <span>
            {doneCount} of {store.orders.length} orders submitted
          </span>
          <span className="text-zinc-500">{queue.length} to go</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-raised">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{
              width: `${store.orders.length ? (doneCount / store.orders.length) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {!order ? (
        <div className="mt-6">
          <EmptyState title="Batch fully entered 🎉">
            Every order is submitted to the retailer. Head to Order Picking to
            pack the totes.
          </EmptyState>
        </div>
      ) : (
        <div className="card mt-4 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">
              Order <span className="font-mono">{order.orderId}</span> ·
              Household {order.householdId}
            </h2>
            <span className="text-xs text-zinc-500">
              {order.orderDate} · {order.items.length} items ·{" "}
              {lb(order.totalWeightLb)}
            </span>
          </div>

          <ul className="mt-4 space-y-1.5">
            {aggregate(order).map(([name, r]) => {
              const key = `${order.orderId}:${name}`;
              const done = !!typed[key];
              return (
                <li key={key} className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setTyped((t) => ({ ...t, [key]: !t[key] }))
                    }
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded border text-xs ${
                      done
                        ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                        : "border-edge-strong text-transparent hover:border-emerald-500/60"
                    }`}
                    aria-label={done ? "typed" : "not typed"}
                  >
                    ✓
                  </button>
                  <span
                    className={`flex-1 text-sm ${done ? "text-zinc-500 line-through" : ""}`}
                  >
                    <span className="mr-1.5 font-mono text-xs text-zinc-500">
                      {r.qty}×
                    </span>
                    {name}
                  </span>
                  <button
                    onClick={() => {
                      copy(name, key);
                      setTyped((t) => ({ ...t, [key]: true }));
                    }}
                    className="btn btn-secondary btn-sm shrink-0"
                  >
                    {copiedKey === key ? "Copied ✓" : "Copy"}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-edge pt-4">
            <button
              onClick={() =>
                copy(
                  aggregate(order)
                    .map(([name, r]) => `${r.qty} x ${name}`)
                    .join("\n"),
                  "all",
                )
              }
              className="btn btn-secondary btn-sm"
            >
              {copiedKey === "all" ? "Copied ✓" : "Copy whole list"}
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setCursor((c) => Math.min(c + 1, queue.length - 1))}
                className="btn btn-secondary"
                disabled={queue.length < 2}
              >
                Skip
              </button>
              <button
                onClick={() => {
                  store.setStatus(order.orderId, "submitted");
                  setCursor(0);
                  const left = queue.length - 1;
                  toast.success(
                    `Order ${order.orderId} submitted`,
                    left > 0
                      ? `${left} order${left === 1 ? "" : "s"} to go in this batch`
                      : "That was the last one — batch fully entered 🎉",
                  );
                }}
                className="btn btn-primary"
              >
                Mark submitted → next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
