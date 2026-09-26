"use client";

// Browser-native voice I/O for the copilot. Speech-to-text via the Web
// Speech API (Chrome/Edge/Safari; the mic button hides itself where
// unsupported) and replies via SpeechSynthesis. No servers, no quota.

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface SpeechSession {
  stop: () => void;
}

export function speechSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  return !!(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

export function startListening(handlers: {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onEnd: () => void;
  onError: (message: string) => void;
}): SpeechSession | null {
  const w = window as any;
  const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.lang = "en-CA";
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;

  let finalText = "";
  rec.onresult = (event: any) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const alt = event.results[i][0]?.transcript ?? "";
      if (event.results[i].isFinal) finalText += alt;
      else interim += alt;
    }
    handlers.onInterim((finalText + interim).trim());
  };
  rec.onerror = (event: any) => {
    const code = String(event?.error ?? "unknown");
    handlers.onError(
      code === "not-allowed"
        ? "Microphone permission was denied."
        : code === "no-speech"
          ? "Didn't catch anything — try again closer to the mic."
          : `Voice input failed (${code}).`,
    );
  };
  rec.onend = () => {
    const text = finalText.trim();
    if (text) handlers.onFinal(text);
    handlers.onEnd();
  };
  try {
    rec.start();
  } catch {
    handlers.onError("Voice input could not start.");
    return null;
  }
  return { stop: () => rec.stop() };
}

let currentUtterance: SpeechSynthesisUtterance | null = null;

export function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.05;
    utter.pitch = 1;
    const voice = window.speechSynthesis
      .getVoices()
      .find((v) => v.lang.startsWith("en") && v.localService);
    if (voice) utter.voice = voice;
    currentUtterance = utter;
    window.speechSynthesis.speak(utter);
  } catch {
    // TTS is a nicety; never let it break the chat
  }
}

export function stopSpeaking() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  } catch {
    /* ignore */
  }
}
