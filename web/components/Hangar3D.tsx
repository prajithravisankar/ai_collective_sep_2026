"use client";

// The 3D hangar: Cessna 208B cabin (real DHL-sheet dimensions) with the
// packed totes at their true stacking slots (same stackingSlots() math
// as the 2D seat map and the printed numbers). The copilot's tool calls
// steer it: focus a tote and the camera flies in while the tote opens,
// showing its items as boxes at their real dimensions.

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { STACKING, stackingSlots } from "@/lib/stacking";
import type { OrderItem, Tote } from "@/lib/types";

const S = 0.1; // inches -> scene units
const TOTE_L = 25 * S;
const TOTE_W = 15.5 * S;
const TOTE_H = 11 * S;
const CABIN_L = STACKING.cabinLengthIn * S;
const CABIN_W = STACKING.cabinWidthIn * S;
const CABIN_H = STACKING.cabinHeightIn * S;

export interface FocusState {
  toteId: string | null;
  highlight: Set<string>;
}

function slotCenter(index: number): [number, number, number] {
  const slot = stackingSlots(index + 1)[index];
  const row = Math.min(slot.row, STACKING.maxRows - 1);
  return [
    -CABIN_L / 2 + row * 15.5 * S + TOTE_W / 2, // rows advance along cabin length
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
    if (y + h > 22) break; // stacked display can overflow the shell a bit, then stop
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
  const wanted = useRef(new THREE.Vector3(16, 12, 14));
  useEffect(() => {
    if (focusPos) {
      const p = new THREE.Vector3(...focusPos);
      target.current.copy(p);
      wanted.current.set(p.x + 4.5, p.y + 3.2, p.z + (p.z >= 0 ? 5 : -5));
    } else {
      target.current.set(0, CABIN_H / 2, 0);
      wanted.current.set(16, 12, 14);
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
  const color = mode === "highlight" ? "#d97706" : "#059669";
  return (
    <group position={pos}>
      {mode === "open" ? (
        <>
          {/* transparent shell */}
          <mesh>
            <boxGeometry args={[TOTE_W, TOTE_H, TOTE_L]} />
            <meshStandardMaterial color="#34d399" transparent opacity={0.14} side={THREE.DoubleSide} />
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
        </>
      ) : (
        <mesh onClick={(e) => { e.stopPropagation(); onPick(tote.toteId); }}>
          <boxGeometry args={[TOTE_W, TOTE_H, TOTE_L]} />
          <meshStandardMaterial
            color={color}
            transparent={mode === "ghost"}
            opacity={mode === "ghost" ? 0.12 : 1}
            roughness={0.75}
          />
        </mesh>
      )}
      {mode !== "ghost" && (
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(TOTE_W, TOTE_H, TOTE_L)]} />
          <lineBasicMaterial color={mode === "highlight" ? "#fbbf24" : "#0b0b0d"} />
        </lineSegments>
      )}
    </group>
  );
}

function Cabin() {
  return (
    <group>
      {/* floor */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[CABIN_L + 3, CABIN_W + 2]} />
        <meshStandardMaterial color="#101414" roughness={1} />
      </mesh>
      {/* cabin wireframe */}
      <lineSegments position={[0, CABIN_H / 2, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(CABIN_L, CABIN_H, CABIN_W)]} />
        <lineBasicMaterial color="#3f3f46" />
      </lineSegments>
      {/* nose cone (front = -x) */}
      <mesh position={[-CABIN_L / 2 - 1.6, CABIN_H / 2 - 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[CABIN_H / 2.4, 3.2, 24]} />
        <meshStandardMaterial color="#1b1f1f" roughness={0.6} />
      </mesh>
      {/* tail fin (aft = +x) */}
      <mesh position={[CABIN_L / 2 + 1.2, CABIN_H / 2 + 0.8, 0]} rotation={[0, 0, -0.5]}>
        <boxGeometry args={[1.8, 2.6, 0.12]} />
        <meshStandardMaterial color="#1b1f1f" roughness={0.6} />
      </mesh>
      {/* cargo door outline, aft left */}
      <lineSegments position={[CABIN_L / 2 - 2.6, 2.45, -CABIN_W / 2 - 0.01]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(5, 4.9)]} />
        <lineBasicMaterial color="#d97706" />
      </lineSegments>
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
    <Canvas camera={{ position: [16, 12, 14], fov: 42 }} dpr={[1, 2]}>
      <ambientLight intensity={0.55} />
      <directionalLight position={[10, 18, 8]} intensity={1.1} />
      <directionalLight position={[-12, 10, -10]} intensity={0.35} />
      <Cabin />
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
