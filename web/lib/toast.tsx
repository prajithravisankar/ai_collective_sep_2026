"use client";

// Tiny toast system, no dependencies. Every toast carries the real
// numbers of what just happened ("38 totes packed · avg 98% full"),
// never a generic "Success!".

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Kind = "success" | "info" | "warn" | "error";

interface Toast {
  id: number;
  kind: Kind;
  title: string;
  detail?: string;
}

interface ToastApi {
  success: (title: string, detail?: string) => void;
  info: (title: string, detail?: string) => void;
  warn: (title: string, detail?: string) => void;
  error: (title: string, detail?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const KIND_STYLE: Record<Kind, { dot: string; border: string }> = {
  success: { dot: "bg-emerald-400", border: "border-l-emerald-500" },
  info: { dot: "bg-sky-400", border: "border-l-sky-500" },
  warn: { dot: "bg-amber-400", border: "border-l-amber-500" },
  error: { dot: "bg-red-400", border: "border-l-red-500" },
};

const TTL_MS = 4500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: Kind) => (title: string, detail?: string) => {
      const id = nextId.current++;
      setToasts((ts) => [...ts.slice(-3), { id, kind, title, detail }]);
      setTimeout(() => dismiss(id), TTL_MS);
    },
    [dismiss],
  );

  // Stable API object (push is stable).
  const api = useRef<ToastApi>({
    success: push("success"),
    info: push("info"),
    warn: push("warn"),
    error: push("error"),
  }).current;

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 left-4 z-[70] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 print:hidden"
      >
        {toasts.map((t) => (
          <button
            key={t.id}
            onClick={() => dismiss(t.id)}
            className={`toast-in pointer-events-auto rounded-lg border border-edge ${KIND_STYLE[t.kind].border} border-l-2 bg-surface px-3.5 py-2.5 text-left shadow-lg shadow-black/40`}
          >
            <span className="flex items-center gap-2 text-sm font-medium text-zinc-100">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${KIND_STYLE[t.kind].dot}`}
              />
              {t.title}
            </span>
            {t.detail && (
              <span className="mt-0.5 block pl-3.5 text-xs leading-snug text-zinc-400">
                {t.detail}
              </span>
            )}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
