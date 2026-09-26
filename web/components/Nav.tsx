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
    <header className="border-b border-zinc-800 bg-zinc-950">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="py-3 font-semibold text-emerald-400">
          Zamiigo Fulfillment
        </Link>
        <nav className="flex gap-1">
          {tabs.map((tab) => {
            const active = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`border-b-2 px-4 py-3 text-sm transition-colors ${
                  active
                    ? "border-emerald-400 text-white"
                    : "border-transparent text-zinc-400 hover:text-white"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
