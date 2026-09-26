"use client";

// Zamiigo Operations Copilot — agentic. The model may request one of a
// few whitelisted tools; the BROWSER executes them (pure planners and
// store reads — never mutations), feeds the result back, and the model
// answers. Max 2 tool hops per question (each hop costs one request of
// the team's AI quota). Any state change comes back as a PROPOSAL card
// that only runs when the human clicks confirm — through the same store
// actions the UI buttons use. While the agent works, the whole screen
// gets the emerald "agent mode" aura.

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buildAIContext, copilotPage, copilotSuggestions } from "@/lib/ai-context";
import { executeTool, validateProposal, type Proposal } from "@/lib/ai-tools";
import { planFlights } from "@/lib/flights";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/lib/toast";
import {
  speak,
  speechSupported,
  startListening,
  stopSpeaking,
  type SpeechSession,
} from "@/lib/voice";

type Message =
  | { role: "user" | "assistant"; text: string; page: string }
  | { role: "tool"; text: string; page: string }
  | { role: "proposal"; text: string; page: string; proposal: Proposal; done?: string };

const MAX_HOPS = 3; // model calls per question (2 tool hops + final answer)

export default function OperationsCopilot() {
  const pathname = usePathname();
  const store = useAppStore();
  const toast = useToast();
  const page = copilotPage(pathname);
  const suggestions = copilotSuggestions(pathname);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState("");
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [voiceIn, setVoiceIn] = useState(false); // mic supported?
  const [listening, setListening] = useState(false);
  const [voiceReply, setVoiceReply] = useState(false);
  const speechRef = useRef<SpeechSession | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVoiceIn(speechSupported());
  }, []);

  // Nothing should keep talking after the panel closes.
  useEffect(() => {
    if (!open) {
      stopSpeaking();
      speechRef.current?.stop();
    }
  }, [open]);

  function toggleMic() {
    if (listening) {
      speechRef.current?.stop();
      return;
    }
    stopSpeaking();
    setError("");
    const session = startListening({
      onInterim: (text) => setDraft(text),
      onFinal: (text) => {
        if (text.length > 1) void ask(text);
      },
      onEnd: () => setListening(false),
      onError: (message) => setError(message),
    });
    if (session) {
      speechRef.current = session;
      setListening(true);
    }
  }

  // The landing page is a static pitch — no operational data to ground on.
  const onLanding = pathname === "/";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, open]);

  async function ask(value: string) {
    const question = value.trim();
    if (!question || loading) return;
    const history = messages
      .filter((m): m is Extract<Message, { role: "user" | "assistant" }> =>
        (m.role === "user" || m.role === "assistant") && m.page === page,
      )
      .slice(-6)
      .map(({ role, text }) => ({ role, text }));
    const context = buildAIContext(pathname, store, question);
    setMessages((cur) => [...cur, { role: "user", text: question, page }]);
    setDraft("");
    setError("");
    setLoading(true);
    setAgentStatus("Thinking…");

    const steps: { tool: string; args: Record<string, unknown>; result: string }[] = [];
    try {
      for (let hop = 0; hop < MAX_HOPS; hop++) {
        const response = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, context, history, steps }),
        });
        const data: {
          kind?: string;
          answer?: string;
          tool?: string;
          args?: Record<string, unknown>;
          statusLine?: string;
          error?: string;
          remaining?: number;
        } = await response.json();
        if (!response.ok) throw new Error(data.error || "The assistant is unavailable right now.");
        if (typeof data.remaining === "number") setRemaining(data.remaining);

        if (data.kind === "tool" && data.tool) {
          const status = data.statusLine || `Running ${data.tool}…`;
          setAgentStatus(status);
          const result = executeTool({ tool: data.tool, args: data.args ?? {} }, store);
          steps.push({ tool: data.tool, args: data.args ?? {}, result });
          const failed = result.startsWith('{"error"');
          setMessages((cur) => [
            ...cur,
            { role: "tool", text: `${failed ? "⚠" : "⚙"} ${status}`, page },
          ]);
          continue;
        }

        if (data.kind === "propose" && data.args) {
          const proposal = validateProposal(data.args);
          if (typeof proposal === "string") {
            steps.push({ tool: "proposeAction", args: data.args, result: `{"error":"${proposal}"}` });
            continue; // let the model recover and answer
          }
          setMessages((cur) => [
            ...cur,
            ...(data.answer ? [{ role: "assistant", text: data.answer, page } as Message] : []),
            { role: "proposal", text: proposal.label, page, proposal },
          ]);
          return;
        }

        if (data.answer) {
          setMessages((cur) => [...cur, { role: "assistant", text: data.answer!, page }]);
          if (voiceReply) speak(data.answer);
          return;
        }
        throw new Error("The assistant returned an empty response.");
      }
      throw new Error("The assistant ran out of steps — try a more specific question.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The assistant is unavailable right now.");
    } finally {
      setLoading(false);
      setAgentStatus("");
    }
  }

  function applyProposal(index: number, proposal: Proposal) {
    let outcome = "";
    if (proposal.actionKind === "advanceAll") {
      const n = store.advanceAll();
      outcome = `${n} orders advanced one step`;
      toast.success(outcome, "confirmed via copilot");
    } else if (proposal.actionKind === "markFlightTotes") {
      const flight = store.plan?.flights.find((f) => f.departureId === proposal.departureId);
      if (!flight) {
        toast.error("That departure no longer exists in the plan.");
        return;
      }
      store.markFlightTotes(flight.loadedToteIds, proposal.status!);
      outcome = `${flight.loadedToteIds.length} totes → ${proposal.status}`;
      toast.success(outcome, "confirmed via copilot");
    } else if (proposal.actionKind === "applyCapacity") {
      const target = store.capacities.find((f) => f.departureId === proposal.departureId);
      if (!target) {
        toast.error("That departure no longer exists.");
        return;
      }
      const patch = {
        ...(proposal.payloadLb !== undefined && { availablePayloadLb: proposal.payloadLb }),
        ...(proposal.availableTotes !== undefined && { availableTotes: proposal.availableTotes }),
        ...(proposal.volumeCuFt !== undefined && { availableVolumeCuFt: proposal.volumeCuFt }),
      };
      store.updateCapacity(proposal.departureId!, patch);
      const updated = store.capacities.map((f) =>
        f.departureId === proposal.departureId ? { ...f, ...patch } : f,
      );
      store.setPlan(planFlights(store.totes, updated));
      outcome = `capacity applied to departure ${proposal.departureId}, plan re-run`;
      toast.success("Capacity applied + re-planned", outcome);
    }
    setMessages((cur) =>
      cur.map((m, i) => (i === index && m.role === "proposal" ? { ...m, done: outcome } : m)),
    );
  }

  if (onLanding) return null;
  const agentActive = loading;

  return (
    <>
      {agentActive && (
        <>
          <div className="agent-aura" aria-hidden />
          <div className="agent-pill" role="status">
            <span aria-hidden className="text-emerald-300">✦</span>
            <span className="agent-pill-label">
              {agentStatus && agentStatus !== "Thinking…"
                ? `Agent working — ${agentStatus}`
                : "Agent mode — reading the live plan"}
            </span>
            <span className="agent-pill-dots" aria-hidden>
              <span /><span /><span />
            </span>
          </div>
        </>
      )}
      <div className="fixed bottom-4 right-4 z-50 print:hidden sm:bottom-6 sm:right-6">
        {open && (
          <section
            aria-label="Zamiigo Operations Copilot"
            className={`mb-3 flex h-[min(34rem,calc(100dvh-7rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border bg-surface shadow-2xl shadow-black/60 transition-all ${
              agentActive ? "agent-glow border-emerald-400/70" : "border-emerald-500/30"
            }`}
          >
            <div className="flex items-center justify-between border-b border-edge bg-emerald-500/10 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">✦ Zamiigo Copilot</h2>
                <p className="text-[11px] text-emerald-300">
                  {agentActive && agentStatus ? agentStatus : `Viewing ${page}`}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const next = !voiceReply;
                    setVoiceReply(next);
                    if (!next) stopSpeaking();
                  }}
                  aria-pressed={voiceReply}
                  aria-label={voiceReply ? "Turn off spoken replies" : "Read replies aloud"}
                  title={voiceReply ? "Spoken replies on" : "Read replies aloud"}
                  className={`rounded-md px-2 py-1 text-sm leading-none hover:bg-white/10 ${
                    voiceReply ? "text-emerald-300" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {voiceReply ? "🔊" : "🔇"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMessages([]);
                    setError("");
                  }}
                  disabled={messages.length === 0}
                  aria-label="Clear conversation"
                  className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-white/10 hover:text-white disabled:opacity-40"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Minimize copilot"
                  className="rounded-md px-2 py-1 text-lg leading-none text-zinc-400 hover:bg-white/10 hover:text-white"
                >
                  −
                </button>
              </div>
            </div>
            <div role="log" aria-live="polite" className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.length === 0 && (
                <p className="text-sm leading-relaxed text-zinc-400">
                  Ask about the current screen — or ask a what-if (&ldquo;what if
                  departure 1 loses 200 lb?&rdquo;) and I&rsquo;ll re-run the real
                  planner to find out.
                </p>
              )}
              {messages.map((message, index) => {
                if (message.role === "tool")
                  return (
                    <p key={index} className="flex items-center gap-1.5 text-[11px] text-emerald-300/90">
                      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                      {message.text}
                    </p>
                  );
                if (message.role === "proposal")
                  return (
                    <div key={index} className="rounded-xl border border-amber-700/60 bg-amber-950/30 px-3 py-2.5 text-sm">
                      <p className="text-[10px] uppercase tracking-wider text-amber-400">
                        Proposed change — needs your confirmation
                      </p>
                      <p className="mt-1 text-zinc-100">{message.text}</p>
                      {message.done ? (
                        <p className="mt-2 text-xs text-emerald-300">✓ Applied — {message.done}</p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => applyProposal(index, message.proposal)}
                          className="btn btn-primary btn-sm mt-2"
                        >
                          Confirm &amp; apply
                        </button>
                      )}
                    </div>
                  );
                return (
                  <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[90%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm leading-relaxed ${
                        message.role === "user"
                          ? "bg-emerald-600 text-white"
                          : "border border-edge bg-zinc-800/80 text-zinc-100"
                      }`}
                    >
                      {message.page !== page && (
                        <span className="mb-1 block text-[10px] opacity-70">From {message.page}</span>
                      )}
                      {message.text}
                    </div>
                  </div>
                );
              })}
              {loading && (
                <p className="text-xs text-emerald-300" role="status">
                  {agentStatus || `Thinking about ${page}…`}
                </p>
              )}
              {error && (
                <p role="alert" className="rounded-lg border border-red-800/70 bg-red-950/70 px-3 py-2 text-xs text-red-200">
                  {error}
                </p>
              )}
              <div ref={endRef} />
            </div>
            <div className="border-t border-edge px-3 py-3">
              <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => ask(suggestion)}
                    disabled={loading}
                    className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void ask(draft);
                }}
                className="flex gap-2"
              >
                <input
                  aria-label="Ask the Zamiigo copilot"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={1000}
                  placeholder={listening ? "Listening… speak now" : `Ask about ${page.toLowerCase()}…`}
                  className={`input min-w-0 flex-1 text-sm ${listening ? "border-emerald-400/70" : ""}`}
                />
                {voiceIn && (
                  <button
                    type="button"
                    onClick={toggleMic}
                    disabled={loading}
                    aria-pressed={listening}
                    aria-label={listening ? "Stop listening" : "Ask by voice"}
                    title={listening ? "Stop listening" : "Ask by voice"}
                    className={`btn px-3 text-sm disabled:opacity-50 ${
                      listening ? "btn-primary agent-glow" : "btn-secondary"
                    }`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className={`h-4 w-4 ${listening ? "animate-pulse" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <rect x="9" y="3" width="6" height="11" rx="3" />
                      <path d="M5 11a7 7 0 0014 0M12 18v3" />
                    </svg>
                  </button>
                )}
                <button type="submit" disabled={loading || !draft.trim()} className="btn btn-primary px-3 text-sm disabled:opacity-50">
                  Send
                </button>
              </form>
              <p className="mt-2 text-[10px] text-zinc-500">
                Reads live data · changes need your confirm
                {voiceIn ? " · 🎤 voice" : ""}
                {remaining !== null ? ` · ${remaining} AI requests left` : ""}
              </p>
            </div>
          </section>
        )}
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Close Zamiigo Copilot" : "Open Zamiigo Copilot"}
          aria-expanded={open}
          className={`ml-auto flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold text-[#06110c] shadow-xl shadow-black/40 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 ${
            agentActive
              ? "agent-glow border-emerald-300 bg-emerald-400"
              : "border-emerald-400/40 bg-emerald-500 hover:bg-emerald-400"
          }`}
        >
          <span aria-hidden>✦</span>
          {open ? "Close" : "Ask Zamiigo"}
        </button>
      </div>
    </>
  );
}
