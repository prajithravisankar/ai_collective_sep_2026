"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/entry", label: "Order Entry" },
  { href: "/picking", label: "Order Picking" },
  { href: "/flights", label: "Flight Management" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-edge bg-background/90 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 py-2.5 font-semibold"
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-accent text-sm font-bold text-[#06110c]">
            Z
          </span>
          <span className="hidden text-sm text-zinc-100 sm:block">
            Zamiigo <span className="text-zinc-500">Fulfillment</span>
          </span>
        </Link>
        <nav className="no-scrollbar flex overflow-x-auto">
          {tabs.map((tab) => {
            const active = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex shrink-0 items-center border-b-2 px-1 pt-1 pb-0.5 transition-colors ${
                  active ? "border-accent" : "border-transparent"
                }`}
              >
                <span
                  className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? "font-medium text-white"
                      : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100"
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
