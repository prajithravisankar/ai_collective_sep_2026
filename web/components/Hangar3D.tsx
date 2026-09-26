"use client";

// The 3D hangar, showpiece edition. Real Cessna 208B cabin dimensions,
// totes at their true stackingSlots positions, and the copilot steering
// the camera. Round-two polish: staggered entrance, idle auto-rotate,
// hover tooltips, weight heatmap, the opened tote lifting out of the
// stack, contact shadows, fog and rim light. Everything computed from
// live store data — no network assets, reduced-motion respected.

import { ContactShadows, Html, Line, Text } from "@react-three/drei";
import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
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
const LIFT_Y = CABIN_H + 2.6; // where an opened tote hovers

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

// weight heatmap: light -> deep emerald (same ramp family as the charts)
const RAMP = ["#a7f3d0", "#6ee7b7", "#34d399", "#10b981", "#059669", "#065f46"];
function weightColor(w: number, max: number): string {
  const t = max > 0 ? Math.min(1, w / max) : 0;
  return RAMP[Math.min(RAMP.length - 1, Math.floor(t * RAMP.length))];
}

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
    if (y + h > 11.2) break; // never poke through the open shell
    out.push({ item: it, pos: [(x + l / 2) * S, (y + h / 2) * S, (z + w / 2) * S], size: [l * S, h * S, w * S] });
    x += l + 0.4;
    rowDepth = Math.max(rowDepth, w);
    layerH = Math.max(layerH, h);
  }
  return out;
}

const ITEM_COLORS = ["#34d399", "#38bdf8", "#fbbf24", "#f472b6", "#a78bfa", "#fb923c"];

// Flies the camera on focus changes, then hands control fully back to
// OrbitControls — grabbing the mouse mid-flight cancels the animation,
// so the user can always rotate freely.
function CameraRig({ focusTarget }: { focusTarget: [number, number, number] | null }) {
  const camera = useThree((st) => st.camera);
  const controls = useThree((st) => st.controls) as
    | { target: THREE.Vector3; update: () => void; addEventListener: (e: string, f: () => void) => void; removeEventListener: (e: string, f: () => void) => void }
    | null;
  const wantedPos = useRef(new THREE.Vector3(15, 11, 13));
  const wantedTarget = useRef(new THREE.Vector3(0, CABIN_H / 2, 0));
  const animating = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    if (focusTarget) {
      const p = new THREE.Vector3(...focusTarget);
      wantedTarget.current.copy(p);
      wantedPos.current.set(p.x + 4.2, p.y + 2.6, p.z + (p.z >= 0 ? 5.2 : -5.2));
      animating.current = true;
    } else if (mounted.current) {
      // fly home only when a focus is cleared, not on first mount
      wantedTarget.current.set(0, CABIN_H / 2, 0);
      wantedPos.current.set(15, 11, 13);
      animating.current = true;
    }
    mounted.current = true;
  }, [focusTarget]);

  // user grabs the scene -> the animation yields immediately
  useEffect(() => {
    if (!controls) return;
    const stop = () => { animating.current = false; };
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
  }, [controls]);

  useFrame(() => {
    if (!animating.current || !controls) return;
    camera.position.lerp(wantedPos.current, 0.07);
    controls.target.lerp(wantedTarget.current, 0.09);
    controls.update();
    if (camera.position.distanceTo(wantedPos.current) < 0.08) animating.current = false;
  });
  return null;
}

function ToteMesh({
  tote,
  pos,
  index,
  mode,
  color,
  reduced,
  onPick,
  onHover,
}: {
  tote: Tote;
  pos: [number, number, number];
  index: number;
  mode: "normal" | "ghost" | "highlight" | "open";
  color: string;
  reduced: boolean;
  onPick: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const start = useRef<number | null>(null);
  const [hovered, setHovered] = useState(false);
  const items = useMemo(
    () => (mode === "open" ? layoutItems(tote.contents.flatMap((c) => c.items)) : []),
    [mode, tote],
  );

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    // staggered entrance: totes assemble front-to-back
    if (start.current === null) start.current = clock.elapsedTime;
    const t = clock.elapsedTime - start.current - index * 0.035;
    const scale = reduced ? 1 : Math.min(1, Math.max(0.001, t * 3.2));
    g.scale.setScalar(scale);
    // opened tote lifts out of the stack
    const targetY = mode === "open" ? LIFT_Y : pos[1];
    g.position.y += (targetY - g.position.y) * (reduced ? 1 : 0.08);
    // highlight pulse
    if (mode === "highlight" && !reduced) {
      const pulse = 1 + Math.sin(clock.elapsedTime * 5) * 0.03;
      g.scale.setScalar(scale * pulse);
    }
  });

  const outward = pos[2] < 0 ? -1 : 1;
  const baseColor = mode === "highlight" ? AMBER : color;

  return (
    <group ref={group} position={pos}>
      {mode === "open" ? (
        <>
          <mesh>
            <boxGeometry args={[TOTE_W, TOTE_H, TOTE_L]} />
            <meshStandardMaterial color={ACCENT} transparent opacity={0.13} side={THREE.DoubleSide} />
          </mesh>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(TOTE_W, TOTE_H, TOTE_L)]} />
            <lineBasicMaterial color="#6ee7b7" />
          </lineSegments>
          <group position={[0, -TOTE_H / 2, 0]}>
            {items.map((entry, i) => (
              <mesh key={i} position={[entry.pos[2], entry.pos[1], entry.pos[0]]}>
                <boxGeometry args={[entry.size[2], entry.size[1], entry.size[0]]} />
                <meshStandardMaterial color={ITEM_COLORS[i % ITEM_COLORS.length]} roughness={0.65} />
              </mesh>
            ))}
          </group>
          <Text position={[0, TOTE_H / 2 + 0.95, 0]} fontSize={0.3} color={ACCENT} anchorX="center" anchorY="bottom" outlineWidth={0.012} outlineColor="#04150f">
            {`${tote.toteId} · ${tote.weightLb.toFixed(1)} lb · ${Math.round(tote.fillPercent)}% · ${tote.contents.reduce((n, c) => n + c.items.length, 0)} items`}
          </Text>
          {/* tether back to its slot */}
          <Line
            points={[new THREE.Vector3(0, -TOTE_H / 2, 0), new THREE.Vector3(0, pos[1] - LIFT_Y + TOTE_H / 2, 0)]}
            color="#065f46"
            dashed
            dashSize={0.25}
            gapSize={0.18}
            lineWidth={1}
          />
        </>
      ) : (
        <>
          <mesh
            onClick={(e) => { e.stopPropagation(); onPick(tote.toteId); }}
            onPointerOver={(e) => {
              e.stopPropagation();
              if (mode !== "ghost") { setHovered(true); onHover(tote.toteId); document.body.style.cursor = "pointer"; }
            }}
            onPointerOut={() => { setHovered(false); onHover(null); document.body.style.cursor = "auto"; }}
          >
            <boxGeometry args={[TOTE_W, TOTE_H, TOTE_L]} />
            <meshStandardMaterial
              color={baseColor}
              transparent={mode === "ghost"}
              opacity={mode === "ghost" ? 0.08 : 1}
              roughness={0.7}
              emissive={hovered && mode !== "ghost" ? new THREE.Color("#34d399") : mode === "highlight" ? new THREE.Color("#7c4a03") : undefined}
              emissiveIntensity={hovered ? 0.35 : mode === "highlight" ? 0.4 : 0}
            />
          </mesh>
          {mode !== "ghost" && (
            <Text
              position={[0, 0, outward * (TOTE_L / 2 + 0.015)]}
              rotation={[0, outward > 0 ? 0 : Math.PI, 0]}
              fontSize={0.34}
              color="#04150f"
              anchorX="center"
              anchorY="middle"
            >
              {tote.toteId}
            </Text>
          )}
          {hovered && mode !== "ghost" && (
            <Html position={[0, TOTE_H / 2 + 0.25, 0]} center distanceFactor={14} style={{ pointerEvents: "none" }}>
              <div
                style={{
                  background: "rgba(6,24,18,.94)", border: "1px solid rgba(52,211,153,.5)",
                  borderRadius: 8, padding: "6px 10px", whiteSpace: "nowrap",
                  fontSize: 12, color: "#e4e4e7", boxShadow: "0 4px 18px rgba(0,0,0,.5)",
                }}
              >
                <b style={{ color: "#6ee7b7" }}>{tote.toteId}</b>
                {` · ${tote.weightLb.toFixed(1)} lb · ${Math.round(tote.fillPercent)}% full`}
                <span style={{ color: "#9f9fa8" }}>{` · ${tote.contents.length} order${tote.contents.length === 1 ? "" : "s"} — click to open`}</span>
              </div>
            </Html>
          )}
          {mode !== "ghost" && (
            <lineSegments>
              <edgesGeometry args={[new THREE.BoxGeometry(TOTE_W, TOTE_H, TOTE_L)]} />
              <lineBasicMaterial color={mode === "highlight" ? "#fbbf24" : "#052e21"} />
            </lineSegments>
          )}
        </>
      )}
    </group>
  );
}

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

// Wireframe aircraft hints — same engineering-sketch language as the cabin.
function Plane208B() {
  return (
    <group>
      <lineSegments position={[-CABIN_L / 2 - 1.5, CABIN_H / 2 - 0.2, 0]} rotation={[0, 0, Math.PI / 2]}>
        <edgesGeometry args={[new THREE.ConeGeometry(CABIN_H / 2.5, 3, 10)]} />
        <lineBasicMaterial color={HULL} />
      </lineSegments>
      <lineSegments position={[-CABIN_L / 2 - 3.1, CABIN_H / 2 - 0.2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <edgesGeometry args={[new THREE.CircleGeometry(1.5, 40)]} />
        <lineBasicMaterial color={HULL} />
      </lineSegments>
      <lineSegments position={[-CABIN_L / 6, CABIN_H + 0.25, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(2.4, 0.1, CABIN_W * 3.2)]} />
        <lineBasicMaterial color={HULL} />
      </lineSegments>
      {[-1, 1].map((side) => (
        <Line
          key={side}
          points={[
            new THREE.Vector3(-CABIN_L / 6, CABIN_H + 0.2, side * (CABIN_W / 2 + 2.6)),
            new THREE.Vector3(-CABIN_L / 6, CABIN_H / 2 - 1.2, side * (CABIN_W / 2 - 0.4)),
          ]}
          color={HULL}
          lineWidth={1}
        />
      ))}
      <lineSegments position={[CABIN_L / 2 + 1.7, CABIN_H / 2, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <edgesGeometry args={[new THREE.ConeGeometry(CABIN_H / 3, 3.4, 8)]} />
        <lineBasicMaterial color={HULL} />
      </lineSegments>
      <lineSegments position={[CABIN_L / 2 + 2.6, CABIN_H + 0.9, 0]} rotation={[0, 0, -0.35]}>
        <edgesGeometry args={[new THREE.BoxGeometry(1.6, 2.6, 0.1)]} />
        <lineBasicMaterial color={HULL} />
      </lineSegments>
      <lineSegments position={[CABIN_L / 2 + 2.7, CABIN_H + 0.2, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(1.5, 0.08, 4.6)]} />
        <lineBasicMaterial color={HULL} />
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
      <gridHelper args={[46, 46, "#1c2422", "#141a19"]} position={[0, -0.03, 0]} />
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[CABIN_L, CABIN_W]} />
        <meshStandardMaterial color="#101816" roughness={1} />
      </mesh>
      <lineSegments position={[0, CABIN_H / 2, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(CABIN_L, CABIN_H, CABIN_W)]} />
        <lineBasicMaterial color={FAINT} />
      </lineSegments>

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

      <Text position={[-CABIN_L / 2, 0.02, CABIN_W / 2 + 1.9]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.55} color={MUTED} anchorX="left">
        FRONT
      </Text>
      <Text position={[CABIN_L / 2, 0.02, CABIN_W / 2 + 1.9]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.55} color={MUTED} anchorX="right">
        AFT
      </Text>

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

      <Dimension from={[-CABIN_L / 2, 0, CABIN_W / 2 + 1.1]} to={[CABIN_L / 2, 0, CABIN_W / 2 + 1.1]} label={`cabin length 178″`} />
      <Dimension from={[CABIN_L / 2 + 0.7, 0, CABIN_W / 2]} to={[CABIN_L / 2 + 0.7, 0, -CABIN_W / 2]} label={`62″ wide`} />
      <group>
        <Line
          points={[new THREE.Vector3(-CABIN_L / 2, 0, CABIN_W / 2 + 1.1), new THREE.Vector3(-CABIN_L / 2, CABIN_H, CABIN_W / 2 + 1.1)]}
          color={MUTED}
          lineWidth={1}
        />
        <Text position={[-CABIN_L / 2, CABIN_H + 0.3, CABIN_W / 2 + 1.1]} fontSize={0.4} color={MUTED} anchorX="center" anchorY="bottom">
          51″ high
        </Text>
      </group>

      <lineSegments position={[CABIN_L / 2 - 2.6, 2.45, -CABIN_W / 2 - 0.01]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(5, 4.9)]} />
        <lineBasicMaterial color={AMBER} />
      </lineSegments>
      <Text position={[CABIN_L / 2 - 2.6, 5.35, -CABIN_W / 2 - 0.02]} fontSize={0.38} color={AMBER} anchorX="center" anchorY="bottom">
        cargo door 50″ × 49″
      </Text>
    </group>
  );
}

export default function Hangar3D({
  totes,
  focus,
  colorByWeight,
  onPick,
  onHover,
}: {
  totes: Tote[];
  focus: FocusState;
  colorByWeight: boolean;
  onPick: (id: string) => void;
  onHover?: (id: string | null) => void;
}) {
  const reduced = useMemo(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const shown = totes.slice(0, STACKING.maxTotesByDimensions);
  const maxWeight = Math.max(...shown.map((t) => t.weightLb), 1);
  const focusIndex = shown.findIndex((t) => t.toteId === focus.toteId);

  // camera target: the lifted open tote, or the centroid of highlights
  let focusTarget: [number, number, number] | null = null;
  if (focusIndex >= 0) {
    const p = slotCenter(focusIndex);
    focusTarget = [p[0], LIFT_Y, p[2]];
  } else if (focus.highlight.size > 0) {
    const pts = shown
      .map((t, i) => (focus.highlight.has(t.toteId) ? slotCenter(i) : null))
      .filter((p): p is [number, number, number] => !!p);
    if (pts.length) {
      focusTarget = [
        pts.reduce((s, p) => s + p[0], 0) / pts.length,
        pts.reduce((s, p) => s + p[1], 0) / pts.length,
        pts.reduce((s, p) => s + p[2], 0) / pts.length,
      ];
    }
  }
  const idle = !focusTarget;

  return (
    <Canvas camera={{ position: [15, 11, 13], fov: 42 }} dpr={[1, 2]}>
      <fog attach="fog" args={["#0a100e", 26, 62]} />
      <hemisphereLight args={["#9fe8cd", "#0a0f0d", 0.5]} />
      <directionalLight position={[10, 18, 8]} intensity={1.15} />
      <directionalLight position={[-14, 8, -12]} intensity={0.5} color="#7dd3fc" />
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
        return (
          <ToteMesh
            key={tote.toteId}
            tote={tote}
            pos={slotCenter(i)}
            index={i}
            mode={mode}
            color={colorByWeight ? weightColor(tote.weightLb, maxWeight) : "#0a7a58"}
            reduced={reduced}
            onPick={onPick}
            onHover={onHover ?? (() => {})}
          />
        );
      })}
      <ContactShadows position={[0, -0.02, 0]} opacity={0.55} scale={44} blur={2.4} far={14} resolution={512} color="#000000" />
      <CameraRig focusTarget={focusTarget} />
      <OrbitControls
        enablePan={false}
        maxDistance={40}
        minDistance={4}
        autoRotate={idle && !reduced}
        autoRotateSpeed={0.5}
        makeDefault
      />
    </Canvas>
  );
}
