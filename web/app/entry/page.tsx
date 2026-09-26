"use client";

// Order Entry: upload the orders CSV, see each household order the way
// it would be re-created in the retailer's system, track its status.

import Link from "next/link";
import { useRef, useState } from "react";
import { EmptyState, StatusBadge } from "@/components/ui";
import { parseOrdersCsv } from "@/lib/csv";
import { lb } from "@/lib/format";
import { sampleOrderItems } from "@/lib/sample-data";
import { STATUS_FLOW, useAppStore } from "@/lib/store";
import type { Order, OrderStatus } from "@/lib/types";

export default function OrderEntryPage() {
  const store = useAppStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [openOrder, setOpenOrder] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const items = await parseOrdersCsv(file);
      const bad = items.filter((i) => !i.orderId || Number.isNaN(i.weightLb));
      if (bad.length === items.length) {
        setUploadError(
          "That file doesn't look like an orders CSV (expected columns like order_id, weight_lb…).",
        );
        return;
      }
      setUploadError(null);
      store.loadItems(items.filter((i) => i.orderId));
    } catch {
      setUploadError("Could not read that file.");
    }
  }

  const counts = STATUS_FLOW.map(
    (s) => [s, store.orders.filter((o) => o.status === s).length] as const,
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Order Entry</h1>
          <p className="mt-1 text-sm text-zinc-400">
            One batch, {store.orders.length} household orders — each stays
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
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500"
          >
            Upload orders CSV
          </button>
          <button
            onClick={() => store.loadItems(sampleOrderItems())}
            className="rounded border border-zinc-600 px-4 py-2 text-sm hover:border-zinc-400"
          >
            Load sample data
          </button>
          {store.items.length > 0 && (
            <button
              onClick={() => {
                if (confirm("Clear all orders, totes and statuses?"))
                  store.resetAll();
              }}
              className="rounded border border-red-900 px-4 py-2 text-sm text-red-400 hover:border-red-600"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {uploadError && (
        <p className="mt-4 rounded border border-red-800 bg-red-950 px-4 py-2 text-sm text-red-300">
          {uploadError}
        </p>
      )}

      {store.orders.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No orders yet">
            Upload the orders CSV from Zamiigo (one row per item), or load the
            sample data to see the app working.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
            {counts.map(([s, n]) => (
              <span key={s} className="flex items-center gap-1.5">
                <StatusBadge status={s} />
                <span className="text-zinc-400">{n}</span>
              </span>
            ))}
            <button
              onClick={store.advanceAll}
              className="ml-auto rounded border border-zinc-600 px-3 py-1.5 text-xs hover:border-zinc-400"
            >
              Advance all one step
            </button>
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-950 text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Household</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2 text-right">Items</th>
                  <th className="px-3 py-2 text-right">Weight</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {store.orders.map((o) => {
                  const stepIndex = STATUS_FLOW.indexOf(o.status);
                  const next = STATUS_FLOW[stepIndex + 1];
                  return (
                    <FragmentRow
                      key={o.orderId}
                      open={openOrder === o.orderId}
                      onToggle={() =>
                        setOpenOrder(openOrder === o.orderId ? null : o.orderId)
                      }
                      order={o}
                      next={next}
                      onAdvance={() => next && store.setStatus(o.orderId, next)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Next step: the{" "}
            <Link href="/picking" className="text-emerald-400 underline">
              Order Picking tab
            </Link>{" "}
            groups these orders into shared totes.
          </p>
        </>
      )}
    </div>
  );
}

function FragmentRow({
  order,
  open,
  onToggle,
  next,
  onAdvance,
}: {
  order: Order;
  open: boolean;
  onToggle: () => void;
  next: OrderStatus | undefined;
  onAdvance: () => void;
}) {
  return (
    <>
      <tr
        className="cursor-pointer border-t border-zinc-800 hover:bg-zinc-800/50"
        onClick={onToggle}
      >
        <td className="px-3 py-2 font-mono text-xs">{order.orderId}</td>
        <td className="px-3 py-2">{order.householdId}</td>
        <td className="px-3 py-2 text-zinc-400">{order.orderDate}</td>
        <td className="px-3 py-2 text-right">{order.items.length}</td>
        <td className="px-3 py-2 text-right">{lb(order.totalWeightLb)}</td>
        <td className="px-3 py-2">
          <StatusBadge status={order.status} />
        </td>
        <td className="px-3 py-2 text-right">
          {next && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAdvance();
              }}
              className="rounded border border-zinc-600 px-2 py-1 text-xs hover:border-emerald-400"
            >
              → {next}
            </button>
          )}
        </td>
      </tr>
      {open && (
        <tr className="border-t border-zinc-800 bg-zinc-950/60">
          <td colSpan={7} className="px-6 py-3">
            <p className="mb-2 text-xs uppercase text-zinc-500">
              Retailer order entry — items for household {order.householdId}
            </p>
            <ul className="grid gap-1 text-xs text-zinc-300 sm:grid-cols-2">
              {order.items.map((i, idx) => (
                <li key={idx} className="flex justify-between gap-2">
                  <span>{i.productName}</span>
                  <span className="shrink-0 text-zinc-500">
                    {lb(i.weightLb)}
                  </span>
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}
