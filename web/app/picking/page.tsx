"use client";

// Order Picking: pack orders into shared totes, adjust by hand, assign
// totes to carts, print the pick list. Tote weights computed here are
// what Flight Management uses — same batch, same totes.

import Link from "next/link";
import { useState } from "react";
import { EmptyState, FillBar } from "@/components/ui";
import { lb, pct } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import { TOTE, type Tote } from "@/lib/types";

export default function OrderPickingPage() {
  const store = useAppStore();
  const [moveError, setMoveError] = useState<string | null>(null);

  if (store.orders.length === 0) {
    return (
      <div>
        <p className="kicker">Step 2 · Totes packed</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          Order Picking
        </h1>
        <div className="mt-8">
          <EmptyState title="No orders to pack">
            Load a batch on the{" "}
            <Link
              href="/entry"
              className="text-emerald-400 underline decoration-emerald-400/40 underline-offset-2 hover:text-emerald-300"
            >
              Order Entry tab
            </Link>{" "}
            first.
          </EmptyState>
        </div>
      </div>
    );
  }

  const totalWeight = store.totes.reduce((s, t) => s + t.weightLb, 0);
  const avgFill = store.totes.length
    ? store.totes.reduce((s, t) => s + t.fillPercent, 0) / store.totes.length
    : 0;

  return (
    <div>
      {/* ---------- screen ---------- */}
      <div className="print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="kicker">Step 2 · Totes packed</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              Order Picking
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              {store.orders.length} orders
              {store.totes.length > 0 &&
                ` → ${store.totes.length} totes → ${store.carts.length} carts · ${lb(totalWeight)} · avg fill ${pct(avgFill)}`}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-zinc-400">
              Totes per cart
              <input
                type="number"
                min={1}
                value={store.totesPerCart}
                onChange={(e) => store.setTotesPerCart(Number(e.target.value))}
                className="input mt-1 block w-20"
              />
            </label>
            <label className="text-xs text-zinc-400">
              Max tote weight (lb)
              <input
                type="number"
                min={1}
                value={store.maxToteWeightLb}
                onChange={(e) =>
                  store.setMaxToteWeightLb(Number(e.target.value))
                }
                className="input mt-1 block w-24"
              />
            </label>
            <button
              onClick={() => {
                store.packNow();
                setMoveError(null);
              }}
              className="btn btn-primary"
            >
              {store.totes.length ? "Re-pack all totes" : "Pack into totes"}
            </button>
            {store.totes.length > 0 && (
              <>
                <button
                  onClick={() => window.print()}
                  className="btn btn-secondary"
                >
                  Print pick lists
                </button>
                <Link href="/picking/handheld" className="btn btn-secondary">
                  Handheld view
                </Link>
              </>
            )}
          </div>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Assumption: the {store.maxToteWeightLb} lb per-tote cap is ours (safe
          one-person lift) — the challenge sets only the tote size (
          {TOTE.lengthIn}×{TOTE.widthIn}×{TOTE.heightIn} in). Adjust it above
          and re-pack.
        </p>

        {moveError && (
          <p className="mt-4 rounded-lg border border-red-900/70 bg-red-950/60 px-4 py-2.5 text-sm text-red-300">
            {moveError}
          </p>
        )}

        {store.totes.length === 0 ? (
          <div className="mt-8">
            <EmptyState title="Not packed yet">
              Hit “Pack into totes” — the algorithm shares totes between
              households and splits orders too big for one tote.
            </EmptyState>
          </div>
        ) : (
          <>
            {store.baselineToteCount !== null && (
              <PackingComparison
                baseline={store.baselineToteCount}
                optimized={store.totes.length}
              />
            )}
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {store.totes.map((tote) => (
                <ToteCard
                  key={tote.toteId}
                  tote={tote}
                  allTotes={store.totes}
                  cartId={
                    store.carts.find((c) => c.toteIds.includes(tote.toteId))
                      ?.cartId
                  }
                  onMove={(orderId, toId) =>
                    setMoveError(store.moveOrder(orderId, tote.toteId, toId))
                  }
                />
              ))}
            </div>

            <p className="kicker mt-10">Cart assignment</p>
            <h2 className="mt-1 text-lg font-semibold">
              Carts ({store.carts.length})
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              All totes of one order ride the same cart, so a split order is
              picked in a single trip.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {store.carts.map((cart) => (
                <div key={cart.cartId} className="card p-4">
                  <p className="font-semibold text-emerald-400">
                    Cart {cart.cartId}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-zinc-300">
                    {cart.toteIds.map((id) => {
                      const t = store.totes.find((x) => x.toteId === id);
                      return (
                        <li key={id} className="flex justify-between">
                          <span>Tote {id}</span>
                          <span className="tabular-nums text-zinc-500">
                            {t ? lb(t.weightLb) : ""}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ---------- print: pick list per cart ---------- */}
      <div className="hidden bg-white p-8 text-black print:block">
        {store.carts.map((cart) => (
          <section key={cart.cartId} className="break-after-page">
            <h1 className="text-xl font-bold">
              Pick list — Cart {cart.cartId}
            </h1>
            <p className="text-sm">
              {cart.toteIds.length} totes · batch of {store.orders.length}{" "}
              orders · Webequie
            </p>
            {cart.toteIds.map((toteId) => {
              const tote = store.totes.find((t) => t.toteId === toteId);
              if (!tote) return null;
              return (
                <div key={toteId} className="mt-4">
                  <h2 className="border-b border-black text-base font-bold">
                    Tote {toteId} — {lb(tote.weightLb)} · {pct(tote.fillPercent)}{" "}
                    full
                  </h2>
                  {tote.contents.map((c) => (
                    <div key={c.orderId} className="mt-2 pl-2">
                      <h3 className="text-sm font-semibold">
                        Order {c.orderId} · Household{" "}
                        {c.items[0]?.householdId ?? "?"}
                        {isSplit(c.orderId, store.totes) &&
                          "  (part of a split order)"}
                      </h3>
                      <table className="mt-1 w-full text-xs">
                        <tbody>
                          {c.items.map((i, idx) => (
                            <tr key={idx} className="border-b border-gray-300">
                              <td className="w-6 py-0.5">☐</td>
                              <td className="py-0.5">
                                {i.productName}
                                {store.substitutions[
                                  `${c.orderId}::${i.productName}`
                                ] && (
                                  <span className="block text-[10px]">
                                    ↺ substituted:{" "}
                                    {
                                      store.substitutions[
                                        `${c.orderId}::${i.productName}`
                                      ]
                                    }
                                  </span>
                                )}
                              </td>
                              <td className="py-0.5 text-right">
                                {lb(i.weightLb)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}

function PackingComparison({
  baseline,
  optimized,
}: {
  baseline: number;
  optimized: number;
}) {
  const saved = baseline - optimized;
  const reduction = baseline > 0 ? (saved / baseline) * 100 : 0;
  const maxCount = Math.max(baseline, optimized, 1);

  return (
    <section className="mt-6 rounded-lg border border-emerald-800/60 bg-zinc-950 p-5">
      <h2 className="text-lg font-semibold">What did shared packing save?</h2>
      <p className="mt-1 text-xs text-zinc-400">
        Baseline: pack each household order separately using the limits from the
        last pack. Current: the shared tote plan below, including manual moves.
      </p>

      <div className="mt-5 space-y-3 text-sm">
        <div className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3">
          <span className="text-zinc-400">Isolated baseline</span>
          <div className="h-4 overflow-hidden rounded bg-zinc-800">
            <div
              className="h-full rounded bg-zinc-500"
              style={{ width: `${(baseline / maxCount) * 100}%` }}
            />
          </div>
          <strong className="text-right tabular-nums">{baseline}</strong>
        </div>
        <div className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3">
          <span className="text-zinc-400">Shared packing</span>
          <div className="h-4 overflow-hidden rounded bg-zinc-800">
            <div
              className={`h-full rounded ${saved < 0 ? "bg-amber-400" : "bg-emerald-400"}`}
              style={{ width: `${(optimized / maxCount) * 100}%` }}
            />
          </div>
          <strong className="text-right tabular-nums">{optimized}</strong>
        </div>
      </div>

      <div className="mt-5 grid gap-3 border-t border-zinc-800 pt-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-zinc-400">Totes saved</p>
          <p className="text-2xl font-bold tabular-nums">{saved}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-400">Reduction</p>
          <p className="text-2xl font-bold tabular-nums">
            {reduction.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-400">Nominal tote capacity saved</p>
          <p className="text-2xl font-bold tabular-nums">
            {(saved * TOTE.nominalVolumeCuFt).toFixed(1)}{" "}
            <span className="text-sm font-normal">cu ft</span>
          </p>
        </div>
      </div>
    </section>
  );
}

function isSplit(orderId: string, totes: Tote[]): boolean {
  return (
    totes.filter((t) => t.contents.some((c) => c.orderId === orderId)).length >
    1
  );
}

function ToteCard({
  tote,
  allTotes,
  cartId,
  onMove,
}: {
  tote: Tote;
  allTotes: Tote[];
  cartId?: string;
  onMove: (orderId: string, toToteId: string) => void;
}) {
  return (
    <div className="card p-4 transition-colors hover:border-edge-strong">
      <div className="flex items-baseline justify-between">
        <p className="font-semibold text-emerald-400">Tote {tote.toteId}</p>
        <p className="text-xs text-zinc-500">
          {cartId ? `Cart ${cartId}` : ""}
        </p>
      </div>
      <div className="mt-2 flex items-center justify-between text-sm tabular-nums">
        <span>{lb(tote.weightLb)}</span>
        <span className="text-zinc-400">{pct(tote.fillPercent)} full</span>
      </div>
      <div className="mt-1">
        <FillBar value={tote.fillPercent} />
      </div>
      <ul className="mt-3 space-y-2">
        {tote.contents.map((c) => (
          <li
            key={c.orderId}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span>
              <span className="font-mono text-xs">{c.orderId}</span>
              <span className="ml-1 text-zinc-500">
                ({c.items.length} items
                {isSplit(c.orderId, allTotes) ? ", split" : ""})
              </span>
            </span>
            <select
              value=""
              onChange={(e) => e.target.value && onMove(c.orderId, e.target.value)}
              className="input px-2 py-1 text-xs text-zinc-300"
            >
              <option value="">move…</option>
              {allTotes
                .filter((t) => t.toteId !== tote.toteId)
                .map((t) => (
                  <option key={t.toteId} value={t.toteId}>
                    → {t.toteId} ({pct(t.fillPercent)})
                  </option>
                ))}
              <option value="new">→ new tote</option>
            </select>
          </li>
        ))}
      </ul>
    </div>
  );
}
