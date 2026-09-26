"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buildAIContext, copilotPage, copilotSuggestions } from "@/lib/ai-context";
import { useAppStore } from "@/lib/store";

type Message = { role: "user" | "assistant"; text: string; page: string };

export default function OperationsCopilot() {
  const pathname = usePathname();
  const store = useAppStore();
  const page = copilotPage(pathname);
  const suggestions = copilotSuggestions(pathname);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, loading, open]);

  async function ask(value: string) {
    const question = value.trim();
    if (!question || loading) return;
    const history = messages.filter((message) => message.page === page).slice(-6).map(({ role, text }) => ({ role, text }));
    const context = buildAIContext(pathname, store, question);
    setMessages((current) => [...current, { role: "user", text: question, page }]);
    setDraft("");
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, context, history }),
      });
      const data: { answer?: string; error?: string } = await response.json();
      if (!response.ok || !data.answer) throw new Error(data.error || "The assistant is unavailable right now.");
      setMessages((current) => [...current, { role: "assistant", text: data.answer!, page }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The assistant is unavailable right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 print:hidden sm:bottom-6 sm:right-6">
      {open && (
        <section aria-label="Zamiigo Operations Copilot" className="mb-3 flex h-[min(34rem,calc(100dvh-7rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-emerald-500/30 bg-surface shadow-2xl shadow-black/60">
          <div className="flex items-center justify-between border-b border-edge bg-emerald-500/10 px-4 py-3">
            <div><h2 className="text-sm font-semibold text-zinc-100">✦ Zamiigo Copilot</h2><p className="text-[11px] text-emerald-300">Viewing {page}</p></div>
            <div className="flex gap-1">
              <button type="button" onClick={() => { setMessages([]); setError(""); }} disabled={messages.length === 0} aria-label="Clear conversation" title="Clear conversation" className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-white/10 hover:text-white disabled:opacity-40">Clear</button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Minimize copilot" title="Minimize" className="rounded-md px-2 py-1 text-lg leading-none text-zinc-400 hover:bg-white/10 hover:text-white">−</button>
            </div>
          </div>
          <div role="log" aria-live="polite" className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && <p className="text-sm leading-relaxed text-zinc-400">Ask about the current screen. I explain the data and plans already calculated by Zamiigo.</p>}
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[90%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm leading-relaxed ${message.role === "user" ? "bg-emerald-600 text-white" : "border border-edge bg-zinc-800/80 text-zinc-100"}`}>
                  {message.page !== page && <span className="mb-1 block text-[10px] opacity-70">From {message.page}</span>}{message.text}
                </div>
              </div>
            ))}
            {loading && <p className="text-xs text-emerald-300" role="status">Thinking about {page}…</p>}
            {error && <p role="alert" className="rounded-lg border border-red-800/70 bg-red-950/70 px-3 py-2 text-xs text-red-200">{error}</p>}
            <div ref={endRef} />
          </div>
          <div className="border-t border-edge px-3 py-3">
            <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
              {suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => ask(suggestion)} disabled={loading} className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50">{suggestion}</button>)}
            </div>
            <form onSubmit={(event) => { event.preventDefault(); void ask(draft); }} className="flex gap-2">
              <input aria-label="Ask the Zamiigo copilot" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1000} placeholder={`Ask about ${page.toLowerCase()}…`} className="input min-w-0 flex-1 text-sm" />
              <button type="submit" disabled={loading || !draft.trim()} className="btn btn-primary px-3 text-sm disabled:opacity-50">Send</button>
            </form>
            <p className="mt-2 text-[10px] text-zinc-500">Read-only explanations · Verify plans in the app</p>
          </div>
        </section>
      )}
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? "Close Zamiigo Copilot" : "Open Zamiigo Copilot"} aria-expanded={open} className="ml-auto flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500 px-4 py-3 text-sm font-semibold text-[#06110c] shadow-xl shadow-black/40 transition hover:bg-emerald-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300">
        <span aria-hidden>✦</span>{open ? "Close" : "Ask Zamiigo"}
      </button>
    </div>
  );
}
