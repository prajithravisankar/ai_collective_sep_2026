"use client";

// Airline-seat-map style 2D view of the loaded cabin. One tab per stack
// layer (like an upper/lower deck switcher); click a filled slot to see
// the tote's orders. Drawn from the SAME stackingSlots() math the
// planner reports, so the picture always matches the numbers.

import { useMemo, useState } from "react";
import { lb, pct } from "@/lib/format";
import { computeStacking, STACKING, stackingSlots } from "@/lib/stacking";
import type { Tote } from "@/lib/types";

const CELL = 44;
const GAP = 6;
const NOSE = 64; // cockpit taper, left side
const TAIL = 46; // tail taper, right side
const PAD_Y = 34;

export default function CabinMap({ totes }: { totes: Tote[] }) {
  const [layer, setLayer] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // slot -> tote, in loading order
  const bySlot = useMemo(() => {
    const map = new Map<string, Tote>();
    stackingSlots(totes.length).forEach((s, i) => {
      map.set(`${s.row}:${s.side}:${s.layer}`, totes[i]);
    });
    return map;
  }, [totes]);

  const st = computeStacking(totes.length);
  const rowsW = STACKING.maxRows * (CELL + GAP);
  const width = NOSE + rowsW + TAIL;
  const height = PAD_Y * 2 + 2 * CELL + GAP;
  const usedW = st.rowsUsed * (CELL + GAP);
  const selected = totes.find((t) => t.toteId === selectedId) ?? null;
  const layerCount = totes.length
    ? stackingSlots(totes.length).filter((s) => s.layer === layer).length
    : 0;

  return (
    <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((l) => (
            <button
              key={l}
              onClick={() => setLayer(l)}
              className={`rounded px-2.5 py-1 text-xs ${
                layer === l
                  ? "bg-emerald-600 font-medium text-white"
                  : "bg-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              Layer {l + 1}
              {l === 0 ? " (floor)" : l === 3 ? " (top)" : ""}
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500">
          {layerCount} totes on this layer · {st.lengthLeftIn.toFixed(1)}″ of
          cabin length free
        </p>
      </div>

      <div className="mt-2 overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="min-w-[560px]"
          role="img"
          aria-label="Cabin load map"
        >
          {/* fuselage outline: nose taper (front/left), body, tail taper */}
          <path
            d={`M ${NOSE} ${PAD_Y - 16}
                C ${NOSE * 0.35} ${PAD_Y - 12}, 6 ${height / 2 - 16}, 6 ${height / 2}
                C 6 ${height / 2 + 16}, ${NOSE * 0.35} ${height - PAD_Y + 12}, ${NOSE} ${height - PAD_Y + 16}
                L ${NOSE + rowsW} ${height - PAD_Y + 16}
                L ${width - 4} ${height / 2 + 10}
                L ${width - 4} ${height / 2 - 10}
                L ${NOSE + rowsW} ${PAD_Y - 16} Z`}
            fill="none"
            stroke="rgb(82 82 91)"
            strokeWidth="1.5"
          />
          <text x={16} y={height / 2 + 4} fontSize="10" fill="rgb(113 113 122)">
            ✈
          </text>

          {/* free space region */}
          {st.lengthLeftIn > 0 && (
            <>
              <rect
                x={NOSE + usedW}
                y={PAD_Y - 8}
                width={Math.max(0, rowsW - usedW)}
                height={2 * CELL + GAP + 16}
                fill="rgb(39 39 42 / 0.45)"
              />
              <text
                x={NOSE + usedW + (rowsW - usedW) / 2}
                y={height / 2 + 4}
                fontSize="11"
                textAnchor="middle"
                fill="rgb(161 161 170)"
              >
                {st.lengthLeftIn.toFixed(0)}″ free
              </text>
            </>
          )}

          {/* slots: 11 rows x 2 sides for the active layer */}
          {Array.from({ length: STACKING.maxRows }).map((_, row) =>
            [0, 1].map((side) => {
              const tote = bySlot.get(`${row}:${side}:${layer}`);
              const x = NOSE + row * (CELL + GAP);
              const y = PAD_Y + side * (CELL + GAP);
              if (!tote) {
                return (
                  <rect
                    key={`${row}-${side}`}
                    x={x}
                    y={y}
                    width={CELL}
                    height={CELL}
                    rx={6}
                    fill="none"
                    stroke="rgb(63 63 70)"
                    strokeDasharray="3 3"
                  />
                );
              }
              const isSel = tote.toteId === selectedId;
              return (
                <g
                  key={`${row}-${side}`}
                  onClick={() =>
                    setSelectedId(isSel ? null : tote.toteId)
                  }
                  className="cursor-pointer"
                >
                  <rect
                    x={x}
                    y={y}
                    width={CELL}
                    height={CELL}
                    rx={6}
                    fill={isSel ? "rgb(16 185 129)" : "rgb(6 95 70)"}
                    stroke={isSel ? "white" : "rgb(16 185 129)"}
                    strokeWidth={isSel ? 2 : 1}
                  />
                  <text
                    x={x + CELL / 2}
                    y={y + CELL / 2 + 4}
                    fontSize="11"
                    textAnchor="middle"
                    fill="white"
                  >
                    {tote.toteId}
                  </text>
                  <title>
                    {`Tote ${tote.toteId} — ${lb(tote.weightLb)}, ${pct(tote.fillPercent)} full`}
                  </title>
                </g>
              );
            }),
          )}

          {/* cargo door, aft left (50 x 49 in per the DHL C208B sheet) */}
          <line
            x1={NOSE + rowsW - 2.2 * CELL}
            y1={height - PAD_Y + 16}
            x2={NOSE + rowsW - 0.6 * CELL}
            y2={height - PAD_Y + 16}
            stroke="rgb(245 158 11)"
            strokeWidth="3"
          />
          <text
            x={NOSE + rowsW - 1.4 * CELL}
            y={height - 8}
            fontSize="9"
            textAnchor="middle"
            fill="rgb(245 158 11)"
          >
            cargo door 50″×49″
          </text>

          <text x={NOSE} y={14} fontSize="9" fill="rgb(113 113 122)">
            FRONT
          </text>
          <text x={NOSE + rowsW - 24} y={14} fontSize="9" fill="rgb(113 113 122)">
            AFT
          </text>
        </svg>
      </div>

      {selected && (
        <div className="mt-2 rounded border border-emerald-900 bg-emerald-950/40 p-2 text-xs">
          <p className="font-semibold text-emerald-300">
            Tote {selected.toteId} — {lb(selected.weightLb)} ·{" "}
            {pct(selected.fillPercent)} full
          </p>
          <ul className="mt-1 space-y-0.5 text-zinc-300">
            {selected.contents.map((c) => (
              <li key={c.orderId}>
                Order {c.orderId} · Household {c.items[0]?.householdId ?? "?"} ·{" "}
                {c.items.length} items
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-2 text-[10px] text-zinc-600">
        Top-down view, {STACKING.totesAcross} totes across ×{" "}
        {STACKING.layersHigh} layers high × {STACKING.maxRows} rows. Same model
        as the numbers above — Cessna 208B cabin 178″×62″×51″ (DHL sheet).
      </p>
    </div>
  );
}
