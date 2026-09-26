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
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-raised">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

const STATUS_STYLE: Record<OrderStatus, string> = {
  entered: "border-zinc-700 bg-zinc-800/60 text-zinc-300",
  submitted: "border-sky-900 bg-sky-950/60 text-sky-300",
  picking: "border-amber-900 bg-amber-950/60 text-amber-300",
  picked: "border-emerald-900 bg-emerald-950/60 text-emerald-300",
};

// Dot colors for the status chips — exported so pages can build their own
// counters/pills that stay in sync with the badges.
export const STATUS_DOT: Record<OrderStatus, string> = {
  entered: "bg-zinc-400",
  submitted: "bg-sky-400",
  picking: "bg-amber-400",
  picked: "bg-emerald-400",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[status]}`}
      />
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
    <div className="card px-6 py-12 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-edge bg-raised">
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5 text-zinc-500"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" />
          <path d="M3 8l9 5 9-5" />
          <path d="M12 13v8" />
        </svg>
      </div>
      <p className="mt-4 font-semibold text-zinc-200">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
        {children}
      </p>
    </div>
  );
}
