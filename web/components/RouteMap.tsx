"use client";

// Route map for the bonus objective: the Nakina hub and the three
// communities drawn at their REAL coordinates (the same ones that
// reproduce the brief's route distances within 1 nm), faint direct
// routes with one-way distances, and the chosen plan's legs as
// numbered, animated flight paths — the combined two-stop trip reads
// as one arc. Leg colors are the validated categorical pair.

import { useMemo } from "react";
import { lb } from "@/lib/format";
import { COORDS, greatCircleNm, routeFor, toteCommunity } from "@/lib/routes";
import type { Flight, Tote } from "@/lib/types";

const LEG_COLORS = ["#10b981", "#38bdf8", "#fbbf24"]; // bright steps for thin lines on near-black
// text halo so labels stay readable over route lines
const HALO = { paintOrder: "stroke" as const, stroke: "#0e1412", strokeWidth: 4 };
// hand-placed label sides for the known places (above/below the node)
const LABEL_BELOW: Record<string, boolean> = {
  Webequie: false,
  "Summer Beaver": true,
  Neskantaga: true,
};
const clampX = (x: number) => Math.min(Math.max(x, 125), W - 125);
const W = 520;
const H = 470;
const PAD = 60;

function projector() {
  const places = Object.values(COORDS);
  const lats = places.map((p) => p[0]);
  const lons = places.map((p) => p[1]);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const xs = lons.map((l) => l * kx);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const scale = Math.min((W - 2 * PAD) / (maxX - minX), (H - 2 * PAD) / (maxLat - minLat));
  return (name: string): [number, number] => {
    const [lat, lon] = COORDS[name] ?? COORDS.Webequie;
    return [
      PAD + (lon * kx - minX) * scale,
      PAD + (maxLat - lat) * scale,
    ];
  };
}

// gently curved path between two points (flight-like)
function arc(a: [number, number], b: [number, number], bend = 0.14): string {
  const mx = (a[0] + b[0]) / 2 - (b[1] - a[1]) * bend;
  const my = (a[1] + b[1]) / 2 + (b[0] - a[0]) * bend;
  return `M ${a[0]} ${a[1]} Q ${mx} ${my} ${b[0]} ${b[1]}`;
}

function midOf(a: [number, number], b: [number, number], bend = 0.14): [number, number] {
  // point at t=0.5 of the quadratic
  const mx = (a[0] + b[0]) / 2 - (b[1] - a[1]) * bend;
  const my = (a[1] + b[1]) / 2 + (b[0] - a[0]) * bend;
  return [(a[0] + 2 * mx + b[0]) / 4, (a[1] + 2 * my + b[1]) / 4];
}

export default function RouteMap({
  flights,
  totes,
  savedHours,
}: {
  flights: Flight[];
  totes: Tote[];
  savedHours: number;
}) {
  const project = useMemo(projector, []);
  const communities = useMemo(
    () => [...new Set(totes.map(toteCommunity))].filter((c) => COORDS[c]),
    [totes],
  );
  const waiting = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of totes)
      m.set(toteCommunity(t), (m.get(toteCommunity(t)) ?? 0) + t.weightLb);
    return m;
  }, [totes]);

  const nakina = project("Nakina");

  // chosen plan legs: each flight = Nakina -> stops... -> Nakina
  const legs = flights
    .filter((f) => f.destination && f.loadedToteIds.length > 0)
    .map((f, i) => {
      const stops = (f.destination as string).split(" + ").filter((sName) => COORDS[sName]);
      const points = [nakina, ...stops.map(project), nakina];
      const weightLb = f.loadedToteIds.reduce(
        (s2, id) => s2 + (totes.find((t) => t.toteId === id)?.weightLb ?? 0),
        0,
      );
      return { flight: f, stops, points, color: LEG_COLORS[i % LEG_COLORS.length], weightLb };
    });

  return (
    <div className="mt-4">
      <p className="text-xs font-medium text-zinc-300">
        The plan on the map{" "}
        <span className="font-normal text-zinc-500">
          — real airport positions; the two-stop arc is the {savedHours.toFixed(2)} h saving
        </span>
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 w-full max-w-xl rounded-xl border border-edge bg-[#0e1412]"
        role="img"
        aria-label="Route map of the planned flights"
      >
        {/* faint direct routes with one-way distances */}
        {communities.map((c, ci) => {
          const p = project(c);
          const nm = Math.round(greatCircleNm(COORDS.Nakina, COORDS[c]));
          const t = 0.24 + ci * 0.1; // stagger labels where routes converge
          const mid: [number, number] = [
            nakina[0] + (p[0] - nakina[0]) * t,
            nakina[1] + (p[1] - nakina[1]) * t,
          ];
          return (
            <g key={`direct-${c}`}>
              <line
                x1={nakina[0]}
                y1={nakina[1]}
                x2={p[0]}
                y2={p[1]}
                stroke="#3f3f46"
                strokeWidth="1"
                strokeDasharray="3 4"
              />
              <text x={mid[0] + 8} y={mid[1] - 5} fontSize="9" fill="#8b8b93" style={HALO}>
                {nm} nm
              </text>
            </g>
          );
        })}

        {/* chosen legs */}
        {legs.map((leg, li) =>
          leg.points.slice(0, -1).map((from, si) => {
            const to = leg.points[si + 1];
            const d = arc(from, to);
            return (
              <g key={`leg-${li}-${si}`}>
                <path d={d} fill="none" stroke={leg.color} strokeWidth="2.5" strokeLinecap="round" opacity="0.9" className="route-flow" />
              </g>
            );
          }),
        )}

        {/* leg sequence badges at the midpoint of the outbound segment */}
        {legs.map((leg, li) => {
          const [bx, by] = midOf(leg.points[0], leg.points[1]);
          return (
            <g key={`badge-${li}`}>
              <circle cx={bx} cy={by} r="11" fill="#0e1412" stroke={leg.color} strokeWidth="2" />
              <text x={bx} y={by + 3.5} fontSize="11" fontWeight="700" textAnchor="middle" fill="#f4f4f5">
                {li + 1}
              </text>
            </g>
          );
        })}

        {/* community nodes */}
        {communities.map((c) => {
          const [x, y] = project(c);
          const route = routeFor(c);
          const below = LABEL_BELOW[c] ?? y >= H / 2;
          const lx = clampX(x);
          return (
            <g key={c}>
              <circle cx={x} cy={y} r="6" fill="#059669" stroke="#0e1412" strokeWidth="2" />
              <text x={lx} y={below ? y + 20 : y - 24} fontSize="12" fontWeight="600" textAnchor="middle" fill="#f4f4f5" style={HALO}>
                {c}
              </text>
              <text x={lx} y={below ? y + 32 : y - 12} fontSize="9" textAnchor="middle" fill="#a1a1aa" style={HALO}>
                {route.airport.split(" ·")[0]} · {lb(route.payloadLb)} payload · {lb(waiting.get(c) ?? 0)} waiting
              </text>
            </g>
          );
        })}

        {/* Nakina hub */}
        <g>
          <circle cx={nakina[0]} cy={nakina[1]} r="8" fill="#f4f4f5" stroke="#059669" strokeWidth="3" />
          <text x={nakina[0]} y={nakina[1] + 26} fontSize="12" fontWeight="700" textAnchor="middle" fill="#f4f4f5" style={HALO}>
            Nakina
          </text>
          <text x={nakina[0]} y={nakina[1] + 38} fontSize="9" textAnchor="middle" fill="#a1a1aa" style={HALO}>
            CYQN · home base
          </text>
        </g>
      </svg>

      {/* leg legend with the numbers that matter */}
      <div className="mt-2 space-y-1">
        {legs.map((leg, li) => (
          <p key={li} className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold text-zinc-950" style={{ background: leg.color }}>
              {li + 1}
            </span>
            <span className="text-zinc-200">{leg.flight.destination}</span>
            · {leg.flight.loadedToteIds.length} totes · {lb(leg.weightLb)} of{" "}
            {lb(leg.flight.availablePayloadLb)} ·{" "}
            {(leg.flight.flightHours ?? 0).toFixed(2)} h
            {leg.stops.length > 1 && (
              <span className="text-emerald-400">← one trip, two stops</span>
            )}
          </p>
        ))}
      </div>
    </div>
  );
}
