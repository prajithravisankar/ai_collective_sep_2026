"use client";

// Tiny pub/sub between the copilot and the 3D hangar. When a tool call
// resolves (toteDetail, lookupOrder), the copilot emits an event; if
// the hangar page is mounted it reacts — camera flies to the tote, the
// household's totes light up. Deterministic: the LLM never "drives"
// the camera, the verified tool result does.

export type SceneEvent =
  | { type: "focusTote"; toteId: string }
  | { type: "focusTotes"; toteIds: string[]; label: string }
  | { type: "clear" };

const subscribers = new Set<(e: SceneEvent) => void>();

export function onSceneEvent(fn: (e: SceneEvent) => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function emitSceneEvent(e: SceneEvent) {
  for (const fn of subscribers) fn(e);
}
