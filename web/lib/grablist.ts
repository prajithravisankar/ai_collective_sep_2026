// Batch-pick "grab list": the picker grabs all units of a product for
// the whole cart in one reach, then distributes them into totes —
// the brief's "never makes two trips for the same item when one would do".

import type { Cart, Tote } from "./types";

export interface GrabRow {
  name: string;
  qty: number;
  perTote: { toteId: string; qty: number }[];
}

export function grabList(cart: Cart, totes: Tote[]): GrabRow[] {
  const rows = new Map<string, GrabRow>();
  for (const toteId of cart.toteIds) {
    const tote = totes.find((t) => t.toteId === toteId);
    if (!tote) continue;
    for (const c of tote.contents)
      for (const i of c.items) {
        const row = rows.get(i.productName) ?? {
          name: i.productName,
          qty: 0,
          perTote: [],
        };
        row.qty += 1;
        const pt = row.perTote.find((p) => p.toteId === toteId);
        if (pt) pt.qty += 1;
        else row.perTote.push({ toteId, qty: 1 });
        rows.set(i.productName, row);
      }
  }
  // Multi-unit products first — that's where the trips are saved.
  return [...rows.values()].sort(
    (a, b) => b.qty - a.qty || a.name.localeCompare(b.name),
  );
}
