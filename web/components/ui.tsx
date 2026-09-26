"use client";

// Tiny shared UI pieces used across the tabs.

import type { OrderStatus } from "@/lib/types";

export function FillBar({
  value,
  danger = 100,
}: {
  value: number; // percent
  danger?: number;
}) {
  const clamped = Math.min(value, 100);
  const color =
    value > danger
      ? "bg-red-500"
      : value > 85
        ? "bg-amber-400"
        : "bg-emerald-500";
  return (
    <div className="h-2 w-full overflow-hidden rounded bg-zinc-800">
      <div className={`h-full ${color}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

const STATUS_STYLE: Record<OrderStatus, string> = {
  entered: "bg-zinc-700 text-zinc-200",
  submitted: "bg-sky-900 text-sky-200",
  picking: "bg-amber-900 text-amber-200",
  picked: "bg-emerald-900 text-emerald-200",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}
    >
      {status}
    </span>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-700 p-10 text-center">
      <p className="font-medium text-zinc-300">{title}</p>
      <p className="mt-2 text-sm text-zinc-500">{children}</p>
    </div>
  );
}
