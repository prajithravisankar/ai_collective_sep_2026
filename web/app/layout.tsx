import type { Metadata } from "next";
import Nav from "@/components/Nav";
import { AppStoreProvider } from "@/lib/store";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zamiigo Fulfillment",
  description:
    "Orders → totes → aircraft. Wilderness North hackathon challenge.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans text-zinc-100 antialiased">
        <AppStoreProvider>
          <Nav />
          <main className="mx-auto max-w-6xl px-4 py-8 print:max-w-none print:p-0">
            {children}
          </main>
          <footer className="mt-8 border-t border-edge py-5 text-center text-xs leading-relaxed text-zinc-500 print:hidden">
            Built on cited data — aircraft:{" "}
            <a
              href="https://www.tsb.gc.ca/eng/rapports-reports/aviation/2023/a23o0028/a23o0028.html"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 underline decoration-emerald-400/40 underline-offset-2 hover:text-emerald-300"
            >
              TSB A23O0028 (Wilderness North Air, Cessna 208B)
            </a>{" "}
            · cabin:{" "}
            <a
              href="https://aviationcargo.dhl.com/sites/default/files/aircraft_dimension_sheets/cessna-caravan-c208B.pdf"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 underline decoration-emerald-400/40 underline-offset-2 hover:text-emerald-300"
            >
              DHL C208B dimension sheet (178″×62″×51″)
            </a>{" "}
            · payload &amp; tote: challenge brief. Full assumptions on the{" "}
            <a
              href="/flights"
              className="text-emerald-400 underline decoration-emerald-400/40 underline-offset-2 hover:text-emerald-300"
            >
              Flight Management tab
            </a>
            .
          </footer>
        </AppStoreProvider>
      </body>
    </html>
  );
}
