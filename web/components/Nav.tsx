"use client";

// Sentry-style navigation: fixed left sidebar on desktop, compact top
// bar on small screens. Both hidden when printing.

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  {
    href: "/",
    label: "Overview",
    exact: true,
    icon: (
      <path d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
    ),
  },
  {
    href: "/entry",
    label: "Order Entry",
    icon: (
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    ),
  },
  {
    href: "/picking",
    label: "Order Picking",
    icon: <path d="M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8" />,
  },
  {
    href: "/flights",
    label: "Flight Management",
    icon: (
      <path d="M10.5 4.5a1.5 1.5 0 013 0V10l7 4v2l-7-2v4.5l2 1.5v1.5l-3.5-1-3.5 1V20l2-1.5V14l-7 2v-2l7-4V4.5z" />
    ),
  },
  {
    href: "/track",
    label: "Track an Order",
    icon: (
      <path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35" />
    ),
  },
];

function NavIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function isActive(pathname: string, item: (typeof items)[number]) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

export default function Nav() {
  const pathname = usePathname();

  return (
    <>
      {/* desktop: fixed left sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-52 flex-col border-r border-edge bg-surface md:flex print:hidden">
        <Link href="/" className="flex items-center gap-2.5 px-4 py-4">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-accent text-sm font-bold text-[#06110c]">
            Z
          </span>
          <span className="text-sm font-semibold leading-tight text-zinc-100">
            Zamiigo
            <span className="block text-[10px] font-normal text-zinc-500">
              Fulfillment
            </span>
          </span>
        </Link>
        <nav className="mt-1 flex flex-col gap-0.5 px-2">
          {items.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-emerald-500/10 font-medium text-emerald-300"
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100"
                }`}
              >
                <NavIcon>{item.icon}</NavIcon>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-edge px-4 py-3 text-[10px] leading-relaxed text-zinc-600">
          Nakina (CYQN) → Webequie (CYWP)
          <br />
          Cessna 208B · freight config
        </div>
      </aside>

      {/* mobile: compact sticky top bar */}
      <header className="sticky top-0 z-40 border-b border-edge bg-surface/95 backdrop-blur md:hidden print:hidden">
        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto px-3">
          <Link href="/" className="mr-1 shrink-0 py-2.5">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-accent text-xs font-bold text-[#06110c]">
              Z
            </span>
          </Link>
          {items
            .filter((i) => !i.exact)
            .map((item) => {
              const active = isActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-3 text-xs transition-colors ${
                    active
                      ? "border-emerald-400 font-medium text-white"
                      : "border-transparent text-zinc-400 hover:text-white"
                  }`}
                >
                  {item.label.replace(" Management", " Mgmt")}
                </Link>
              );
            })}
        </div>
      </header>
    </>
  );
}
