"use client";

// The 3D hangar: Cessna 208B cabin (real DHL-sheet dimensions) with the
// packed totes at their true stacking slots — same stackingSlots() math
// as the 2D seat map — now with the 2D map's information density: tote
// IDs on the boxes, FRONT/AFT, row numbers, dimension callouts, and the
// free cabin length drawn and measured. The copilot's tool calls steer
// the camera; clicking a tote opens it.

import { Line, Text } from "@react-three/drei";
import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { computeStacking, STACKING, stackingSlots } from "@/lib/stacking";
import type { OrderItem, Tote } from "@/lib/types";

const S = 0.1; // inches -> scene units
const TOTE_L = 25 * S;
const TOTE_W = 15.5 * S;
const TOTE_H = 11 * S;
const CABIN_L = STACKING.cabinLengthIn * S;
const CABIN_W = STACKING.cabinWidthIn * S;
const CABIN_H = STACKING.cabinHeightIn * S;

const INK = "#e4e4e7";
const MUTED = "#9f9fa8";
const FAINT = "#52525b";
const ACCENT = "#34d399";
const AMBER = "#d97706";
const HULL = "#5b6b68";

export interface FocusState {
  toteId: string | null;
  highlight: Set<string>;
}

function slotCenter(index: number): [number, number, number] {
  const slot = stackingSlots(index + 1)[index];
  const row = Math.min(slot.row, STACKING.maxRows - 1);
  return [
    -CABIN_L / 2 + row * 15.5 * S + TOTE_W / 2,
    slot.layer * TOTE_H + TOTE_H / 2,
    slot.side === 0 ? -CABIN_W / 2 + TOTE_L / 2 + 0.06 : CABIN_W / 2 - TOTE_L / 2 - 0.06,
  ];
}

// naive display layout of items inside an opened tote (real dims, shelf fill)
function layoutItems(items: OrderItem[]): {
  item: OrderItem;
  pos: [number, number, number];
  size: [number, number, number];
}[] {
  const sorted = [...items]
    .sort((a, b) => b.lengthIn * b.widthIn - a.lengthIn * a.widthIn)
    .slice(0, 36);
  const out: { item: OrderItem; pos: [number, number, number]; size: [number, number, number] }[] = [];
  let x = -25 / 2, z = -15.5 / 2, y = 0, rowDepth = 0, layerH = 0;
  for (const it of sorted) {
    const l = Math.min(it.lengthIn, 24), w = Math.min(it.widthIn, 15), h = Math.min(it.heightIn, 11);
    if (x + l > 25 / 2) { x = -25 / 2; z += rowDepth + 0.4; rowDepth = 0; }
    if (z + w > 15.5 / 2) { z = -15.5 / 2; y += layerH + 0.3; layerH = 0; x = -25 / 2; }
    if (y + h > 22) break;
    out.push({ item: it, pos: [(x + l / 2) * S, (y + h / 2) * S, (z + w / 2) * S], size: [l * S, h * S, w * S] });
    x += l + 0.4;
    rowDepth = Math.max(rowDepth, w);
    layerH = Math.max(layerH, h);
  }
  return out;
}

const ITEM_COLORS = ["#34d399", "#38bdf8", "#fbbf24", "#f472b6", "#a78bfa", "#fb923c"];

function CameraRig({ focusPos }: { focusPos: [number, number, number] | null }) {
  const target = useRef(new THREE.Vector3(0, CABIN_H / 2, 0));
  const wanted = useRef(new THREE.Vector3(15, 11, 13));
  useEffect(() => {
    if (focusPos) {
      const p = new THREE.Vector3(...focusPos);
      target.current.copy(p);
      wanted.current.set(p.x + 4.5, p.y + 3.2, p.z + (p.z >= 0 ? 5 : -5));
    } else {
      target.current.set(0, CABIN_H / 2, 0);
      wanted.current.set(15, 11, 13);
    }
  }, [focusPos]);
  useFrame(({ camera }) => {
    camera.position.lerp(wanted.current, 0.05);
    camera.lookAt(target.current);
  });
  return null;
}

function ToteMesh({
  tote,
  pos,
  mode,
  onPick,
}: {
  tote: Tote;
  pos: [number, number, number];
  mode: "normal" | "ghost" | "highlight" | "open";
  onPick: (id: string) => void;
}) {
  const items = useMemo(
    () => (mode === "open" ? layoutItems(tote.contents.flatMap((c) => c.items)) : []),
    [mode, tote],
  );
  const color = mode === "highlight" ? AMBER : "#0a7a58";
  const outward = pos[2] < 0 ? -1 : 1;
  return (
    <group position={pos}>
      {mode === "open" ? (
        <>
          <mesh>
            <boxGeometry args={[TOTE_W, TOTE_H, TOTE_L]} />
            <meshStandardMaterial color={ACCENT} transparent opacity={0.14} side={THREE.DoubleSide} />
          </mesh>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(TOTE_W, TOTE_H, TOTE_L)]} />
            <lineBasicMaterial color="#6ee7b7" />
          </lineSegments>
          <group position={[0, -TOTE_H / 2, 0]}>
            {items.map((entry, i) => (
              <mesh key={i} position={[entry.pos[2], entry.pos[1], entry.pos[0]]}>
                <boxGeometry args={[entry.size[2], entry.size[1], entry.size[0]]} />
                <meshStandardMaterial color={ITEM_COLORS[i % ITEM_COLORS.length]} roughness={0.7} />
              </mesh>
            ))}
          </group>
          <Text
            position={[0, TOTE_H / 2 + 0.35, 0]}
            fontSize={0.42}
            color={ACCENT}
            anchorX="center"
            anchorY="bottom"
          >
            {tote.toteId} · open
          </Text>
        </>
      ) : (
        <>
          <mesh onClick={(e) => { e.stopPropagation(); onPick(tote.toteId); }}>
            <boxGeometry args={[TOTE_W, TOTE_H, TOTE_L]} />
            <meshStandardMaterial
              color={color}
              transparent={mode === "ghost"}
              opacity={mode === "ghost" ? 0.1 : 1}
              roughness={0.75}
            />
          </mesh>
          {mode !== "ghost" && (
            <Text
              position={[0, 0, outward * (TOTE_L / 2 + 0.015)]}
              rotation={[0, outward > 0 ? 0 : Math.PI, 0]}
              fontSize={0.34}
              color={mode === "highlight" ? "#1c1205" : "#04150f"}
              anchorX="center"
              anchorY="middle"
            >
              {tote.toteId}
            </Text>
          )}
        </>
      )}
      {mode !== "ghost" && mode !== "open" && (
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(TOTE_W, TOTE_H, TOTE_L)]} />
          <lineBasicMaterial color={mode === "highlight" ? "#fbbf24" : "#052e21"} />
        </lineSegments>
      )}
    </group>
  );
}

// tick-ended dimension line with a centered label, laid flat on the floor
function Dimension({
  from,
  to,
  label,
  color = MUTED,
  lift = 0.02,
}: {
  from: [number, number, number];
  to: [number, number, number];
  label: string;
  color?: string;
  lift?: number;
}) {
  const a = new THREE.Vector3(...from).setY(lift);
  const b = new THREE.Vector3(...to).setY(lift);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const dir = b.clone().sub(a).normalize();
  const tick = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(0.22);
  return (
    <group>
      <Line points={[a, b]} color={color} lineWidth={1} />
      <Line points={[a.clone().sub(tick), a.clone().add(tick)]} color={color} lineWidth={1} />
      <Line points={[b.clone().sub(tick), b.clone().add(tick)]} color={color} lineWidth={1} />
      <Text
        position={[mid.x + tick.x * 2.4, lift, mid.z + tick.z * 2.4]}
        rotation={[-Math.PI / 2, 0, Math.atan2(dir.x, dir.z) - Math.PI / 2]}
        fontSize={0.42}
        color={color}
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  );
}

// Wireframe aircraft hints — same engineering-sketch language as the
// cabin box, so the "plane" reads without a heavy model.
function Plane208B() {
  const hull = HULL;
  return (
    <group>
      {/* nose cone (front = -x) */}
      <lineSegments position={[-CABIN_L / 2 - 1.5, CABIN_H / 2 - 0.2, 0]} rotation={[0, 0, Math.PI / 2]}>
        <edgesGeometry args={[new THREE.ConeGeometry(CABIN_H / 2.5, 3, 10)]} />
        <lineBasicMaterial color={hull} />
      </lineSegments>
      {/* propeller ring */}
      <lineSegments position={[-CABIN_L / 2 - 3.1, CABIN_H / 2 - 0.2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <edgesGeometry args={[new THREE.CircleGeometry(1.5, 40)]} />
        <lineBasicMaterial color={hull} />
      </lineSegments>
      {/* high wing outline over the forward cabin */}
      <lineSegments position={[-CABIN_L / 6, CABIN_H + 0.25, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(2.4, 0.1, CABIN_W * 3.2)]} />
        <lineBasicMaterial color={hull} />
      </lineSegments>
      {/* wing struts */}
      {[-1, 1].map((side) => (
        <Line
          key={side}
          points={[
            new THREE.Vector3(-CABIN_L / 6, CABIN_H + 0.2, side * (CABIN_W / 2 + 2.6)),
            new THREE.Vector3(-CABIN_L / 6, CABIN_H / 2 - 1.2, side * (CABIN_W / 2 - 0.4)),
          ]}
          color={hull}
          lineWidth={1}
        />
      ))}
      {/* tail cone + fin + stabilizer (aft = +x) */}
      <lineSegments position={[CABIN_L / 2 + 1.7, CABIN_H / 2, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <edgesGeometry args={[new THREE.ConeGeometry(CABIN_H / 3, 3.4, 8)]} />
        <lineBasicMaterial color={hull} />
      </lineSegments>
      <lineSegments position={[CABIN_L / 2 + 2.6, CABIN_H + 0.9, 0]} rotation={[0, 0, -0.35]}>
        <edgesGeometry args={[new THREE.BoxGeometry(1.6, 2.6, 0.1)]} />
        <lineBasicMaterial color={hull} />
      </lineSegments>
      <lineSegments position={[CABIN_L / 2 + 2.7, CABIN_H + 0.2, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(1.5, 0.08, 4.6)]} />
        <lineBasicMaterial color={hull} />
      </lineSegments>
    </group>
  );
}

function Cabin({ toteCount }: { toteCount: number }) {
  const st = computeStacking(toteCount);
  const usedX = -CABIN_L / 2 + st.rowsUsed * 15.5 * S;
  const freeLen = CABIN_L / 2 - usedX;
  return (
    <group>
      {/* hangar floor grid */}
      <gridHelper args={[46, 46, "#1c2422", "#141a19"]} position={[0, -0.03, 0]} />
      {/* cabin floor */}
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[CABIN_L, CABIN_W]} />
        <meshStandardMaterial color="#101816" roughness={1} />
      </mesh>
      {/* cabin wireframe */}
      <lineSegments position={[0, CABIN_H / 2, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(CABIN_L, CABIN_H, CABIN_W)]} />
        <lineBasicMaterial color={FAINT} />
      </lineSegments>

      {/* free-space slab + label (mirrors the 2D map's shaded region) */}
      {st.lengthLeftIn > 8 && (
        <>
          <mesh position={[usedX + freeLen / 2, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[freeLen, CABIN_W]} />
            <meshStandardMaterial color={ACCENT} transparent opacity={0.05} />
          </mesh>
          <Text
            position={[usedX + freeLen / 2, 1.1, 0]}
            fontSize={0.6}
            color={ACCENT}
            anchorX="center"
            anchorY="middle"
            rotation={[0, Math.PI / 4, 0]}
          >
            {`${st.lengthLeftIn.toFixed(1)}″ free`}
          </Text>
        </>
      )}

      {/* FRONT / AFT */}
      <Text position={[-CABIN_L / 2, 0.02, CABIN_W / 2 + 1.9]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.55} color={MUTED} anchorX="left">
        FRONT
      </Text>
      <Text position={[CABIN_L / 2, 0.02, CABIN_W / 2 + 1.9]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.55} color={MUTED} anchorX="right">
        AFT
      </Text>

      {/* row numbers along the near edge, like the 2D map */}
      {Array.from({ length: STACKING.maxRows }).map((_, r) => (
        <Text
          key={r}
          position={[-CABIN_L / 2 + r * 15.5 * S + TOTE_W / 2, 0.02, CABIN_W / 2 + 0.35]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.34}
          color={r < st.rowsUsed ? MUTED : FAINT}
          anchorX="center"
        >
          {String(r + 1)}
        </Text>
      ))}

      {/* dimension callouts */}
      <Dimension
        from={[-CABIN_L / 2, 0, CABIN_W / 2 + 1.1]}
        to={[CABIN_L / 2, 0, CABIN_W / 2 + 1.1]}
        label={`cabin length 178″`}
      />
      <Dimension
        from={[CABIN_L / 2 + 0.7, 0, CABIN_W / 2]}
        to={[CABIN_L / 2 + 0.7, 0, -CABIN_W / 2]}
        label={`62″ wide`}
      />
      {/* height callout: vertical line at the front-right corner */}
      <group>
        <Line
          points={[
            new THREE.Vector3(-CABIN_L / 2, 0, CABIN_W / 2 + 1.1),
            new THREE.Vector3(-CABIN_L / 2, CABIN_H, CABIN_W / 2 + 1.1),
          ]}
          color={MUTED}
          lineWidth={1}
        />
        <Text
          position={[-CABIN_L / 2, CABIN_H + 0.3, CABIN_W / 2 + 1.1]}
          fontSize={0.4}
          color={MUTED}
          anchorX="center"
          anchorY="bottom"
        >
          51″ high
        </Text>
      </group>

      {/* cargo door outline + label, aft left */}
      <lineSegments position={[CABIN_L / 2 - 2.6, 2.45, -CABIN_W / 2 - 0.01]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(5, 4.9)]} />
        <lineBasicMaterial color={AMBER} />
      </lineSegments>
      <Text
        position={[CABIN_L / 2 - 2.6, 5.35, -CABIN_W / 2 - 0.02]}
        fontSize={0.38}
        color={AMBER}
        anchorX="center"
        anchorY="bottom"
      >
        cargo door 50″ × 49″
      </Text>
    </group>
  );
}

export default function Hangar3D({
  totes,
  focus,
  onPick,
}: {
  totes: Tote[];
  focus: FocusState;
  onPick: (id: string) => void;
}) {
  const shown = totes.slice(0, STACKING.maxTotesByDimensions);
  const focusIndex = shown.findIndex((t) => t.toteId === focus.toteId);
  const focusPos = focusIndex >= 0 ? slotCenter(focusIndex) : null;

  return (
    <Canvas camera={{ position: [15, 11, 13], fov: 42 }} dpr={[1, 2]}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 18, 8]} intensity={1.15} />
      <directionalLight position={[-12, 10, -10]} intensity={0.4} />
      <Cabin toteCount={shown.length} />
      <Plane208B />
      {shown.map((tote, i) => {
        const mode =
          focus.toteId === tote.toteId
            ? "open"
            : focus.highlight.has(tote.toteId)
              ? "highlight"
              : focus.toteId || focus.highlight.size
                ? "ghost"
                : "normal";
        return <ToteMesh key={tote.toteId} tote={tote} pos={slotCenter(i)} mode={mode} onPick={onPick} />;
      })}
      <CameraRig focusPos={focusPos} />
      <OrbitControls enablePan={false} maxDistance={40} minDistance={4} makeDefault />
    </Canvas>
  );
}
