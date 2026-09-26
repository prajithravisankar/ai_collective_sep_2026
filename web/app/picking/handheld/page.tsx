"use client";

// Handheld pick list — the brief: "in a form that can be printed or
// shown on a handheld scanner". Big tap targets, one cart at a time,
// tote by tote; picked items persist on the device.

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui";
import { lb, pct } from "@/lib/format";
import { grabList } from "@/lib/grablist";
import { toteCommunity } from "@/lib/routes";
import { subKey, useAppStore } from "@/lib/store";
import { useToast } from "@/lib/toast";

const PICKED_KEY = "zamiigo-picked-v1";

export default function HandheldPickPage() {
  const store = useAppStore();
  const toast = useToast();
  const [cartId, setCartId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [subEdit, setSubEdit] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PICKED_KEY);
      if (raw) setPicked(JSON.parse(raw));
    } catch {
      // blocked storage: checks just won't survive refresh
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(PICKED_KEY, JSON.stringify(picked));
    } catch {
      // ignore
    }
  }, [picked, loaded]);

  if (store.carts.length === 0) {
    return (
      <div className="mx-auto max-w-md">
        <p className="kicker">Order Picking</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          Handheld pick list
        </h1>
        <div className="mt-6">
          <EmptyState title="No carts yet">
            Pack the batch on the{" "}
            <Link
              href="/picking"
              className="text-emerald-400 underline decoration-emerald-400/40 underline-offset-2 hover:text-emerald-300"
            >
              Order Picking tab
            </Link>{" "}
            first, then open this page on the handheld.
          </EmptyState>
        </div>
      </div>
    );
  }

  const cart =
    store.carts.find((c) => c.cartId === cartId) ?? store.carts[0];
  const keys: string[] = [];
  for (const toteId of cart.toteIds) {
    const tote = store.totes.find((t) => t.toteId === toteId);
    tote?.contents.forEach((c) =>
      c.items.forEach((_, idx) => keys.push(`${toteId}:${c.orderId}:${idx}`)),
    );
  }
  const done = keys.filter((k) => picked[k]).length;

  return (
    <div className="mx-auto max-w-md pb-16">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          Pick — Cart {cart.cartId}
        </h1>
        <select
          value={cart.cartId}
          onChange={(e) => setCartId(e.target.value)}
          className="input px-3 py-2"
        >
          {store.carts.map((c) => (
            <option key={c.cartId} value={c.cartId}>
              Cart {c.cartId} ({c.toteIds.length} totes)
            </option>
          ))}
        </select>
      </div>

      <div className="card sticky top-12 md:top-2 z-10 mt-3 bg-surface/95 p-3 backdrop-blur">
        <div className="flex justify-between text-sm">
          <span className="tabular-nums">
            {done} / {keys.length} picked
          </span>
          <button
            onClick={() => {
              const cleared = { ...picked };
              for (const k of keys) delete cleared[k];
              setPicked(cleared);
              toast.warn(`Cart ${cart.cartId} progress reset`, `${done} picked items unchecked`);
            }}
            className="text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-200"
          >
            reset cart
          </button>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-raised">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${keys.length ? (done / keys.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      <details className="card mt-4 p-3">
        <summary className="cursor-pointer text-sm font-semibold">
          Grab list — whole cart in one pass
        </summary>
        <ul className="mt-2 space-y-1 text-sm">
          {grabList(cart, store.totes).map((row) => (
            <li key={row.name} className="flex justify-between gap-3">
              <span>
                <span className="mr-1.5 font-mono text-xs text-emerald-400">
                  {row.qty}×
                </span>
                {row.name}
              </span>
              <span className="shrink-0 text-right text-[10px] text-zinc-500">
                {row.perTote.map((p) => `${p.toteId}×${p.qty}`).join(" ")}
              </span>
            </li>
          ))}
        </ul>
      </details>

      {cart.toteIds.map((toteId) => {
        const tote = store.totes.find((t) => t.toteId === toteId);
        if (!tote) return null;
        return (
          <section key={toteId} className="mt-5">
            <h2 className="rounded-lg border border-edge bg-raised px-3 py-2 text-sm font-bold">
              Tote {toteId} · {lb(tote.weightLb)} · {pct(tote.fillPercent)} full
            </h2>
            {tote.contents.map((c) => (
              <div key={c.orderId} className="mt-2">
                <p className="px-1 text-xs text-zinc-400">
                  Order {c.orderId} · Household{" "}
                  {c.items[0]?.householdId ?? "?"}
                </p>
                <ul className="mt-1 space-y-1">
                  {c.items.map((item, idx) => {
                    const k = `${toteId}:${c.orderId}:${idx}`;
                    const isPicked = !!picked[k];
                    const sKey = subKey(c.orderId, item.productName);
                    const sub = store.substitutions[sKey];
                    return (
                      <li key={k}>
                        <div className="flex items-stretch gap-1.5">
                          <button
                            onClick={() =>
                              setPicked((p) => ({ ...p, [k]: !p[k] }))
                            }
                            className={`flex flex-1 items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left text-sm transition-colors active:translate-y-px ${
                              isPicked
                                ? "border-emerald-900/70 bg-emerald-950/40 text-zinc-500 line-through"
                                : "border-edge bg-surface hover:border-edge-strong"
                            }`}
                          >
                            <span>
                              {item.productName}
                              {sub && (
                                <span className="block text-xs text-amber-400 no-underline">
                                  ↺ sub: {sub}
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 text-xs text-zinc-500">
                              {lb(item.weightLb)} {isPicked ? "✓" : ""}
                            </span>
                          </button>
                          <button
                            onClick={() =>
                              setSubEdit(subEdit === sKey ? null : sKey)
                            }
                            className={`shrink-0 rounded-lg border px-2 text-xs ${
                              sub
                                ? "border-amber-700 text-amber-400"
                                : "border-edge text-zinc-500"
                            }`}
                            aria-label="record substitution"
                          >
                            ↺
                          </button>
                        </div>
                        {subEdit === sKey && (
                          <input
                            autoFocus
                            defaultValue={sub ?? ""}
                            placeholder="Store gave instead… (blank = no sub)"
                            className="input mt-1 w-full px-3 py-2 text-sm"
                            onBlur={(e) => {
                              store.setSubstitution(
                                c.orderId,
                                item.productName,
                                e.target.value,
                              );
                              setSubEdit(null);
                              if (e.target.value.trim())
                                toast.info(
                                  `Substitution recorded`,
                                  `${item.productName} → ${e.target.value.trim()} (order ${c.orderId})`,
                                );
                              else if (sub)
                                toast.info(
                                  "Substitution cleared",
                                  `${item.productName} (order ${c.orderId})`,
                                );
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter")
                                (e.target as HTMLInputElement).blur();
                            }}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
