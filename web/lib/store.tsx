"use client";

// One shared store for all three tabs: same batch of orders, same totes.
// Persists to localStorage so a refresh loses nothing (per the brief the
// whole chain must be traceable from entry to delivery).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { groupIntoOrders } from "./csv";
import type { LoadPlan } from "./flights";
import {
  assignTotesToCarts,
  packOrdersByBatch,
  packOrdersIntoTotes,
} from "./packing";
import type {
  Cart,
  Flight,
  Order,
  OrderItem,
  OrderStatus,
  Tote,
} from "./types";
import { TOTE } from "./types";

const STORAGE_KEY = "zamiigo-state-v1";

export const STATUS_FLOW: OrderStatus[] = [
  "entered",
  "submitted",
  "picking",
  "picked",
];

// Returnable-tote lifecycle: the brief says a local partner "brings the
// totes back", so totes are tracked assets, not packaging.
export type ToteLife = "packed" | "flown" | "delivered" | "returned";
export const TOTE_LIFE_FLOW: ToteLife[] = [
  "packed",
  "flown",
  "delivered",
  "returned",
];

interface Persisted {
  items: OrderItem[];
  statuses: Record<string, OrderStatus>;
  totes: Tote[];
  baselineToteCount: number | null;
  totesPerCart: number;
  maxToteWeightLb: number;
  capacities: Flight[];
  plan: LoadPlan | null; // shared so slips/tracker/dashboard can use it
  // orderId::productName -> what the store gave instead
  substitutions: Record<string, string>;
  toteLifecycle: Record<string, { status: ToteLife; at: number }>;
  hourlyCostCad: number; // Caravan charter estimate, operator-adjustable
}

const EMPTY: Persisted = {
  items: [],
  statuses: {},
  totes: [],
  baselineToteCount: null,
  totesPerCart: 5,
  maxToteWeightLb: TOTE.maxWeightLb,
  capacities: [],
  plan: null,
  substitutions: {},
  toteLifecycle: {},
  hourlyCostCad: 1500,
};

export const subKey = (orderId: string, productName: string) =>
  `${orderId}::${productName}`;

interface StoreValue extends Persisted {
  orders: Order[]; // derived from items + statuses
  carts: Cart[]; // derived from totes + totesPerCart
  loadItems: (items: OrderItem[]) => void;
  setStatus: (orderId: string, status: OrderStatus) => void;
  advanceAll: () => number;
  packNow: () => {
    orderCount: number;
    toteCount: number;
    saved: number;
    avgFill: number;
  };
  moveOrder: (orderId: string, fromToteId: string, toToteId: string) => string | null;
  setTotesPerCart: (n: number) => void;
  setMaxToteWeightLb: (n: number) => void;
  setCapacities: (flights: Flight[]) => void;
  updateCapacity: (departureId: string, patch: Partial<Flight>) => void;
  setPlan: (plan: LoadPlan | null) => void;
  setSubstitution: (orderId: string, productName: string, note: string) => void;
  setToteStatus: (toteId: string, status: ToteLife) => void;
  markFlightTotes: (toteIds: string[], status: ToteLife) => void;
  setHourlyCost: (n: number) => void;
  resetAll: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  // Fresh snapshot for actions that return a summary of what they did.
  const stateRef = useRef(state);
  stateRef.current = state;

  // Load once on mount; never on the server.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...EMPTY, ...JSON.parse(raw) });
    } catch {
      // corrupted/blocked storage: start fresh
    }
    setHydrated(true);
  }, []);

  // Save on every change after hydration.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage full/blocked: app still works, just won't survive refresh
    }
  }, [state, hydrated]);

  const orders = useMemo<Order[]>(
    () =>
      groupIntoOrders(state.items).map((o) => ({
        ...o,
        status: state.statuses[o.orderId] ?? "entered",
      })),
    [state.items, state.statuses],
  );

  const carts = useMemo<Cart[]>(
    () =>
      state.totes.length
        ? assignTotesToCarts(
            state.totes.map((t) => ({ ...t })),
            state.totesPerCart,
          )
        : [],
    [state.totes, state.totesPerCart],
  );

  const loadItems = useCallback((items: OrderItem[]) => {
    setState((s) => ({
      ...s,
      items,
      statuses: {},
      totes: [], // new batch invalidates old packing
      baselineToteCount: null,
      plan: null,
      substitutions: {},
      toteLifecycle: {},
    }));
  }, []);

  const setStatus = useCallback((orderId: string, status: OrderStatus) => {
    setState((s) => ({ ...s, statuses: { ...s.statuses, [orderId]: status } }));
  }, []);

  const advanceAll = useCallback((): number => {
    let advanced = 0;
    setState((s) => {
      const statuses = { ...s.statuses };
      advanced = 0;
      for (const o of groupIntoOrders(s.items)) {
        const cur = statuses[o.orderId] ?? "entered";
        const i = STATUS_FLOW.indexOf(cur);
        if (i < STATUS_FLOW.length - 1) {
          statuses[o.orderId] = STATUS_FLOW[i + 1];
          advanced++;
        }
      }
      return { ...s, statuses };
    });
    return advanced;
  }, []);

  const packNow = useCallback((): {
    orderCount: number;
    toteCount: number;
    saved: number;
    avgFill: number;
  } => {
    const s = stateRef.current;
    const grouped = groupIntoOrders(s.items).map((o) => ({
      ...o,
      status: s.statuses[o.orderId] ?? ("entered" as OrderStatus),
    }));
    const baselineToteCount = grouped.reduce(
      (count, order) =>
        count + packOrdersIntoTotes([order], s.maxToteWeightLb).length,
      0,
    );
    const totes = packOrdersByBatch(grouped, s.maxToteWeightLb);
    setState((prev) => ({
      ...prev,
      baselineToteCount,
      totes,
      plan: null, // repacking changes tote ids
      toteLifecycle: {},
    }));
    return {
      orderCount: grouped.length,
      toteCount: totes.length,
      saved: baselineToteCount - totes.length,
      avgFill: totes.length
        ? totes.reduce((a, t) => a + t.fillPercent, 0) / totes.length
        : 0,
    };
  }, []);

  // Manual adjustment: move one order's items from one tote to another
  // (or "new"). Returns an error message when the move would overflow.
  const moveOrder = useCallback(
    (orderId: string, fromToteId: string, toToteId: string): string | null => {
      let error: string | null = null;
      setState((s) => {
        const totes = s.totes.map((t) => ({
          ...t,
          contents: t.contents.map((c) => ({ ...c, items: [...c.items] })),
        }));
        const from = totes.find((t) => t.toteId === fromToteId);
        const entry = from?.contents.find((c) => c.orderId === orderId);
        if (!from || !entry) {
          error = "That order is not in that tote anymore.";
          return s;
        }
        const w = entry.items.reduce((a, i) => a + i.weightLb, 0);
        const v = entry.items.reduce(
          (a, i) => a + i.lengthIn * i.widthIn * i.heightIn,
          0,
        );

        let to: Tote;
        if (toToteId === "new") {
          const maxId = Math.max(
            0,
            ...totes.map((t) => Number(t.toteId.slice(1)) || 0),
          );
          to = {
            toteId: `T${maxId + 1}`,
            contents: [],
            weightLb: 0,
            volumeCuIn: 0,
            fillPercent: 0,
          };
          totes.push(to);
        } else {
          const found = totes.find((t) => t.toteId === toToteId);
          if (!found) {
            error = "Target tote not found.";
            return s;
          }
          to = found;
        }

        if (to.weightLb + w > s.maxToteWeightLb) {
          error = `Won't fit: ${to.toteId} would be over ${s.maxToteWeightLb} lb.`;
          return s;
        }
        if (to.volumeCuIn + v > TOTE.volumeCuIn) {
          error = `Won't fit: ${to.toteId} would be over-full.`;
          return s;
        }

        from.contents = from.contents.filter((c) => c.orderId !== orderId);
        const existing = to.contents.find((c) => c.orderId === orderId);
        if (existing) existing.items.push(...entry.items);
        else to.contents.push(entry);

        for (const t of [from, to]) {
          t.weightLb = t.contents.reduce(
            (a, c) => a + c.items.reduce((a2, i) => a2 + i.weightLb, 0),
            0,
          );
          t.volumeCuIn = t.contents.reduce(
            (a, c) =>
              a +
              c.items.reduce(
                (a2, i) => a2 + i.lengthIn * i.widthIn * i.heightIn,
                0,
              ),
            0,
          );
          t.fillPercent = (t.volumeCuIn / TOTE.volumeCuIn) * 100;
        }
        return { ...s, totes: totes.filter((t) => t.contents.length > 0) };
      });
      return error;
    },
    [],
  );

  const setTotesPerCart = useCallback((n: number) => {
    setState((s) => ({ ...s, totesPerCart: Math.max(1, Math.round(n) || 1) }));
  }, []);

  const setMaxToteWeightLb = useCallback((n: number) => {
    setState((s) => ({ ...s, maxToteWeightLb: Math.max(1, n || 1) }));
  }, []);

  const setCapacities = useCallback((flights: Flight[]) => {
    setState((s) => ({ ...s, capacities: flights, plan: null }));
  }, []);

  // What-if: the brief says departures sometimes leave with "only part of
  // the hold available" — edit a departure and re-plan instantly.
  const updateCapacity = useCallback(
    (departureId: string, patch: Partial<Flight>) => {
      setState((s) => ({
        ...s,
        plan: null, // numbers changed; plan is stale
        capacities: s.capacities.map((f) =>
          f.departureId === departureId ? { ...f, ...patch } : f,
        ),
      }));
    },
    [],
  );

  const setPlan = useCallback((plan: LoadPlan | null) => {
    setState((s) => ({ ...s, plan }));
  }, []);

  const setSubstitution = useCallback(
    (orderId: string, productName: string, note: string) => {
      setState((s) => {
        const substitutions = { ...s.substitutions };
        const key = subKey(orderId, productName);
        if (note.trim()) substitutions[key] = note.trim();
        else delete substitutions[key];
        return { ...s, substitutions };
      });
    },
    [],
  );

  const setToteStatus = useCallback((toteId: string, status: ToteLife) => {
    setState((s) => ({
      ...s,
      toteLifecycle: {
        ...s.toteLifecycle,
        [toteId]: { status, at: Date.now() },
      },
    }));
  }, []);

  const markFlightTotes = useCallback(
    (toteIds: string[], status: ToteLife) => {
      setState((s) => {
        const toteLifecycle = { ...s.toteLifecycle };
        const at = Date.now();
        for (const id of toteIds) toteLifecycle[id] = { status, at };
        return { ...s, toteLifecycle };
      });
    },
    [],
  );

  const setHourlyCost = useCallback((n: number) => {
    setState((s) => ({ ...s, hourlyCostCad: Math.max(0, n || 0) }));
  }, []);

  const resetAll = useCallback(() => {
    setState(EMPTY);
  }, []);

  const value: StoreValue = {
    ...state,
    orders,
    carts,
    loadItems,
    setStatus,
    advanceAll,
    packNow,
    moveOrder,
    setTotesPerCart,
    setMaxToteWeightLb,
    setCapacities,
    updateCapacity,
    setPlan,
    setSubstitution,
    setToteStatus,
    markFlightTotes,
    setHourlyCost,
    resetAll,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useAppStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useAppStore must be used inside AppStoreProvider");
  return ctx;
}
