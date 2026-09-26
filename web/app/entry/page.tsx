"use client";

// Order Entry: upload the orders CSV, see each household order as an
// order entry ready for the retailer's platform (copyable + printable),
// track status entered -> submitted -> picking -> picked, batch by batch.

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { EmptyState, STATUS_DOT, StatusBadge } from "@/components/ui";
import { parseOrdersCsv } from "@/lib/csv";
import { lb } from "@/lib/format";
import { sampleOrderItems } from "@/lib/sample-data";
import { STATUS_FLOW, useAppStore } from "@/lib/store";
import type { Order, OrderItem, OrderStatus } from "@/lib/types";

// Staff re-type orders into the retailer's consumer site one household at
// a time, so the "order entry" is a per-household list with quantities.
function aggregateItems(items: OrderItem[]): { name: string; qty: number; weightLb: number }[] {
  const byName = new Map<string, { name: string; qty: number; weightLb: number }>();
  for (const i of items) {
    const row = byName.get(i.productName) ?? { name: i.productName, qty: 0, weightLb: 0 };
    row.qty += 1;
    row.weightLb += i.weightLb;
    byName.set(i.productName, row);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function retailerListText(order: Order): string {
  const lines = aggregateItems(order.items).map((r) => `${r.qty} x ${r.name}`);
  return [
    `Order ${order.orderId} — Household ${order.householdId} — ${order.destinationCommunity} — ${order.orderDate}`,
    ...lines,
    `Total: ${order.items.length} items, ${order.totalWeightLb.toFixed(1)} lb`,
  ].join("\n");
}

export default function OrderEntryPage() {
  const store = useAppStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [openOrder, setOpenOrder] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [batchFilter, setBatchFilter] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const items = await parseOrdersCsv(file);
      const good = items.filter((i) => i.orderId && !Number.isNaN(i.weightLb));
      if (good.length === 0) {
        setUploadError(
          "That file doesn't look like an orders CSV (expected columns like order_id, weight_lb…).",
        );
        return;
      }
      setUploadError(null);
      setBatchFilter(null);
      store.loadItems(good);
    } catch {
      setUploadError("Could not read that file.");
    }
  }

  const batches = useMemo(() => {
    const map = new Map<string, { date: string; count: number; weightLb: number }>();
    for (const o of store.orders) {
      const b = map.get(o.batchId) ?? { date: o.orderDate, count: 0, weightLb: 0 };
      b.count += 1;
      b.weightLb += o.totalWeightLb;
      if (o.orderDate < b.date) b.date = o.orderDate;
      map.set(o.batchId, b);
    }
    return [...map.entries()].sort((a, b) => a[1].date.localeCompare(b[1].date));
  }, [store.orders]);

  const visibleOrders = batchFilter
    ? store.orders.filter((o) => o.batchId === batchFilter)
    : store.orders;

  const counts = STATUS_FLOW.map(
    (s) => [s, visibleOrders.filter((o) => o.status === s).length] as const,
  );

  async function copyOrder(order: Order) {
    try {
      await navigator.clipboard.writeText(retailerListText(order));
      setCopied(order.orderId);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard blocked: the printable sheet still covers this
    }
  }

  return (
    <div>
      {/* ---------- screen ---------- */}
      <div className="print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="kicker">Step 1 · Orders in</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              Order Entry
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              {store.orders.length} household orders in {batches.length}{" "}
              batch{batches.length === 1 ? "" : "es"} — each order stays
              separate so the Nutrition North subsidy applies per household.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="btn btn-primary"
            >
              Upload orders CSV
            </button>
            <button
              onClick={() => {
                store.loadItems(sampleOrderItems());
                setBatchFilter(null);
              }}
              className="btn btn-secondary"
            >
              Load sample data
            </button>
            {store.orders.length > 0 && (
              <button onClick={() => window.print()} className="btn btn-secondary">
                Print retailer order sheets
              </button>
            )}
            {store.items.length > 0 && (
              <button
                onClick={() => {
                  if (confirm("Clear all orders, totes and statuses?"))
                    store.resetAll();
                }}
                className="btn btn-danger"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {uploadError && (
          <p className="mt-4 rounded-lg border border-red-900/70 bg-red-950/60 px-4 py-2.5 text-sm text-red-300">
            {uploadError}
          </p>
        )}

        {store.orders.length === 0 ? (
          <div className="mt-8">
            <EmptyState title="No orders yet">
              Upload the orders CSV from Zamiigo (one row per item), or load
              the sample data to see the app working.
            </EmptyState>
          </div>
        ) : (
          <>
            {batches.length > 1 && (
              <div className="mt-6 flex flex-wrap gap-2">
                <BatchChip
                  label={`All batches (${store.orders.length})`}
                  active={batchFilter === null}
                  onClick={() => setBatchFilter(null)}
                />
                {batches.map(([id, b]) => (
                  <BatchChip
                    key={id}
                    label={`Batch ${id} · ${b.date} · ${b.count} orders · ${lb(b.weightLb)}`}
                    active={batchFilter === id}
                    onClick={() => setBatchFilter(id)}
                  />
                ))}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {counts.map(([s, n]) => (
                <span key={s} className="chip cursor-default">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[s]}`}
                  />
                  {s}
                  <span className="font-semibold text-zinc-100">{n}</span>
                </span>
              ))}
              <button
                onClick={store.advanceAll}
                className="btn btn-secondary btn-sm ml-auto"
              >
                Advance all one step
              </button>
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-edge">
              <table className="w-full text-sm">
                <thead className="bg-surface text-left text-[11px] uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Order</th>
                    <th className="px-4 py-3 font-medium">Household</th>
                    <th className="px-4 py-3 font-medium">Batch</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 text-right font-medium">Items</th>
                    <th className="px-4 py-3 text-right font-medium">Weight</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {visibleOrders.map((o) => {
                    const next = STATUS_FLOW[STATUS_FLOW.indexOf(o.status) + 1];
                    return (
                      <OrderRow
                        key={o.orderId}
                        order={o}
                        open={openOrder === o.orderId}
                        onToggle={() =>
                          setOpenOrder(openOrder === o.orderId ? null : o.orderId)
                        }
                        next={next}
                        onAdvance={() => next && store.setStatus(o.orderId, next)}
                        onCopy={() => copyOrder(o)}
                        copied={copied === o.orderId}
                        subs={store.substitutions}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              Next step: the{" "}
              <Link
                href="/picking"
                className="text-emerald-400 underline decoration-emerald-400/40 underline-offset-2 hover:text-emerald-300"
              >
                Order Picking tab
              </Link>{" "}
              groups these orders into shared totes.
            </p>
          </>
        )}
      </div>

      {/* ---------- print: one retailer order sheet per household ---------- */}
      <div className="hidden bg-white p-8 text-black print:block">
        {visibleOrders.map((o) => (
          <section key={o.orderId} className="break-after-page">
            <h1 className="text-lg font-bold">
              Retailer order entry — Order {o.orderId}
            </h1>
            <p className="text-sm">
              Household {o.householdId} · {o.destinationCommunity} · placed{" "}
              {o.orderDate} · batch {o.batchId} · status {o.status}
            </p>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-black text-left">
                  <th className="py-1">Qty</th>
                  <th className="py-1">Product</th>
                  <th className="py-1 text-right">Weight</th>
                </tr>
              </thead>
              <tbody>
                {aggregateItems(o.items).map((r) => (
                  <tr key={r.name} className="border-b border-gray-300">
                    <td className="py-0.5">{r.qty}</td>
                    <td className="py-0.5">
                      {r.name}
                      {store.substitutions[`${o.orderId}::${r.name}`] && (
                        <span className="block text-[10px]">
                          ↺ substituted:{" "}
                          {store.substitutions[`${o.orderId}::${r.name}`]}
                        </span>
                      )}
                    </td>
                    <td className="py-0.5 text-right">{lb(r.weightLb)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-sm font-semibold">
              Total: {o.items.length} items · {lb(o.totalWeightLb)}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}

function BatchChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`chip ${active ? "chip-active" : ""}`}
    >
      {label}
    </button>
  );
}

function OrderRow({
  order,
  open,
  onToggle,
  next,
  onAdvance,
  onCopy,
  copied,
  subs,
}: {
  order: Order;
  open: boolean;
  onToggle: () => void;
  next: OrderStatus | undefined;
  onAdvance: () => void;
  onCopy: () => void;
  copied: boolean;
  subs: Record<string, string>;
}) {
  return (
    <>
      <tr
        className="cursor-pointer border-t border-edge transition-colors hover:bg-zinc-800/40"
        onClick={onToggle}
      >
        <td className="px-4 py-3 font-mono text-xs text-zinc-300">
          {order.orderId}
        </td>
        <td className="px-4 py-3">{order.householdId}</td>
        <td className="px-4 py-3 text-zinc-400">{order.batchId}</td>
        <td className="px-4 py-3 text-zinc-400">{order.orderDate}</td>
        <td className="px-4 py-3 text-right tabular-nums">
          {order.items.length}
        </td>
        <td className="px-4 py-3 text-right tabular-nums">
          {lb(order.totalWeightLb)}
        </td>
        <td className="px-4 py-3">
          <StatusBadge status={order.status} />
        </td>
        <td className="px-4 py-3 text-right">
          {next && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAdvance();
              }}
              className="btn btn-secondary btn-sm"
            >
              → {next}
            </button>
          )}
        </td>
      </tr>
      {open && (
        <tr className="border-t border-edge bg-surface">
          <td colSpan={8} className="px-6 py-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="kicker">
                Retailer order entry — household {order.householdId}
              </p>
              <button onClick={onCopy} className="btn btn-secondary btn-sm">
                {copied ? "Copied ✓" : "Copy retailer list"}
              </button>
            </div>
            <ul className="grid gap-1 text-xs text-zinc-300 sm:grid-cols-2">
              {aggregateItems(order.items).map((r) => {
                const sub = subs[`${order.orderId}::${r.name}`];
                return (
                  <li key={r.name} className="flex justify-between gap-2">
                    <span>
                      {r.qty} × {r.name}
                      {sub && (
                        <span className="block text-amber-400">
                          ↺ sub: {sub}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-zinc-500">
                      {lb(r.weightLb)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}
