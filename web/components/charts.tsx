"use client";

// Hand-rolled SVG charts following the dataviz method: form first,
// validated palette (run against surface #131316, dark mode), thin
// marks with 4px rounded data-ends, 2px surface gaps between touching
// fills, hairline grid, hover tooltips, legend for >=2 series, and a
// data-table fallback under every chart.
//
// Validated palettes (scripts/validate_palette.js, all checks pass):
//   categorical (max 3): #059669, #0284c7, #d97706
//     (emerald<->amber CVD dE 7.9 = warn band -> legal because segments
//      carry 2px surface gaps + direct labels)
//   ordinal ramp:        #a7f3d0 -> #34d399 -> #059669 -> #065f46
//   single-series hue:   #059669

import { useState, type ReactNode } from "react";

export const CAT = ["#059669", "#0284c7", "#d97706"];
export const ORDINAL = ["#a7f3d0", "#34d399", "#059669", "#065f46"];
export const SINGLE = "#059669";
const SURFACE = "#131316";
const GRID = "#26262b";
const TICK = "#71717a";

// ---------- shared bits ----------

interface Tip {
  x: number;
  y: number;
  lines: string[];
}

function useTip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const node = tip ? (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-edge bg-zinc-900 px-2.5 py-1.5 text-xs shadow-lg shadow-black/40"
      style={{ left: tip.x, top: tip.y - 6 }}
    >
      {tip.lines.map((l, i) => (
        <div key={i} className={i === 0 ? "font-medium text-zinc-100" : "text-zinc-400"}>
          {l}
        </div>
      ))}
    </div>
  ) : null;
  return { tip, setTip, node };
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-xs text-zinc-400">
          <span className="h-2 w-2 rounded-[2px]" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

export function DataTable({
  head,
  rows,
}: {
  head: string[];
  rows: (string | number)[][];
}) {
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-[11px] text-zinc-500 hover:text-zinc-300">
        Show data table
      </summary>
      <table className="mt-1 w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-zinc-500">
            {head.map((h) => (
              <th key={h} className="py-1 pr-3 font-medium last:text-right">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-edge text-zinc-300">
              {r.map((c, j) => (
                <td key={j} className="py-1 pr-3 tabular-nums last:text-right">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

// column: rounded top (4px), square baseline
function colPath(x: number, y: number, w: number, h: number, r = 4) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}
// horizontal bar: rounded right end, square left baseline
function barPath(x: number, y: number, w: number, h: number, r = 4) {
  const rr = Math.min(r, h / 2, w);
  return `M${x},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h - rr} Q${x + w},${y + h} ${x + w - rr},${y + h} L${x},${y + h} Z`;
}

function niceTicks(max: number): number[] {
  if (max <= 0) return [0];
  const step = 10 ** Math.floor(Math.log10(max));
  const unit = max / step <= 2 ? step / 2 : max / step <= 5 ? step : step * 2;
  const top = Math.ceil(max / unit) * unit;
  const ticks = [];
  for (let v = 0; v <= top; v += unit) ticks.push(v);
  return ticks;
}

// ---------- column chart (magnitude over categories/time) ----------

export function ColumnChart({
  data,
  unit,
  tooltip,
}: {
  data: { label: string; value: number }[];
  unit: string;
  tooltip?: (d: { label: string; value: number }) => string[];
}) {
  const { setTip, node } = useTip();
  const W = 460;
  const H = 180;
  const padL = 36;
  const padB = 22;
  const padT = 14;
  const ticks = niceTicks(Math.max(...data.map((d) => d.value), 1));
  const top = ticks[ticks.length - 1];
  const innerW = W - padL - 8;
  const innerH = H - padT - padB;
  const band = innerW / data.length;
  const barW = Math.min(24, band * 0.6);
  const maxIdx = data.reduce((mi, d, i) => (d.value > data[mi].value ? i : mi), 0);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {ticks.map((t) => {
          const y = padT + innerH - (t / top) * innerH;
          return (
            <g key={t}>
              <line x1={padL} x2={W - 8} y1={y} y2={y} stroke={GRID} strokeWidth="1" />
              <text x={padL - 6} y={y + 3} fontSize="9" textAnchor="end" fill={TICK}>
                {t.toLocaleString()}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = (d.value / top) * innerH;
          const x = padL + i * band + (band - barW) / 2;
          const y = padT + innerH - h;
          return (
            <g key={d.label}>
              <path
                d={colPath(x, y, barW, h)}
                fill={SINGLE}
                onMouseEnter={(e) => {
                  const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  setTip({
                    x: ((x + barW / 2) / W) * box.width,
                    y: (y / H) * box.height,
                    lines: tooltip ? tooltip(d) : [d.label, `${d.value.toLocaleString()} ${unit}`],
                  });
                }}
                onMouseLeave={() => setTip(null)}
              />
              {i === maxIdx && (
                <text
                  x={x + barW / 2}
                  y={y - 4}
                  fontSize="10"
                  textAnchor="middle"
                  fill="#d4d4d8"
                >
                  {Math.round(d.value).toLocaleString()}
                </text>
              )}
              <text
                x={x + barW / 2}
                y={H - 8}
                fontSize="9"
                textAnchor="middle"
                fill={TICK}
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      {node}
    </div>
  );
}

// ---------- single horizontal stacked bar (part-to-whole) ----------

function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}

export function ShareBar({
  segments,
  format,
}: {
  segments: { label: string; value: number; color: string }[];
  format: (v: number) => string;
}) {
  const { setTip, node } = useTip();
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className="relative">
      <div className="flex h-9 w-full overflow-hidden rounded-md" style={{ background: SURFACE }}>
        {segments.map((seg, i) => {
          const pct = (seg.value / total) * 100;
          return (
            <div
              key={seg.label}
              className="relative flex items-center justify-center"
              style={{
                width: `${pct}%`,
                background: seg.color,
                // 2px surface gap between touching segments
                borderLeft: i > 0 ? `2px solid ${SURFACE}` : undefined,
              }}
              onMouseEnter={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const p = e.currentTarget.parentElement!.getBoundingClientRect();
                setTip({
                  x: r.left - p.left + r.width / 2,
                  y: 0,
                  lines: [seg.label, `${format(seg.value)} · ${Math.round(pct)}%`],
                });
              }}
              onMouseLeave={() => setTip(null)}
            >
              {pct > 14 && (
                <span
                  className="truncate px-1 text-[10px] font-medium"
                  // label inside a colored fill: ink chosen by fill luminance
                  style={{ color: lum(seg.color) > 0.55 ? "#06110c" : "#ffffff" }}
                >
                  {Math.round(pct)}%
                </span>
              )}
            </div>
          );
        })}
      </div>
      {node}
      <Legend items={segments.map((s) => ({ label: s.label, color: s.color }))} />
    </div>
  );
}

// ---------- horizontal bars (top-N magnitude) ----------

export function HBarList({
  data,
  format,
}: {
  data: { label: string; value: number }[];
  format: (v: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label} className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-2">
          <span className="truncate text-xs text-zinc-400" title={d.label}>
            {d.label}
          </span>
          <svg viewBox="0 0 100 12" preserveAspectRatio="none" className="h-3 w-full">
            <path d={barPath(0, 0, Math.max(2, (d.value / max) * 100), 12, 4)} fill={SINGLE} />
          </svg>
          <span className="text-xs tabular-nums text-zinc-300">{format(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- meters (ratio against a limit) ----------

export function MeterList({
  data,
}: {
  data: { label: string; used: number; limit: number; detail: string }[];
}) {
  return (
    <div className="space-y-3">
      {data.map((d) => {
        const pct = d.limit ? Math.min(100, (d.used / d.limit) * 100) : 0;
        return (
          <div key={d.label}>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-300">{d.label}</span>
              <span className="tabular-nums text-zinc-400">
                {Math.round(pct)}% · {d.detail}
              </span>
            </div>
            {/* track = lighter step of the same ramp */}
            <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full" style={{ background: "#064e3b55" }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: SINGLE }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- chart card wrapper ----------

export function ChartCard({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <div className="card p-4">
      <p className="text-sm font-semibold text-zinc-100">{title}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}
