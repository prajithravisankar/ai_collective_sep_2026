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
      <body className="min-h-screen bg-zinc-900 text-zinc-100 antialiased">
        <AppStoreProvider>
          <Nav />
          <main className="mx-auto max-w-6xl px-4 py-8 print:max-w-none print:p-0">
            {children}
          </main>
        </AppStoreProvider>
      </body>
    </html>
  );
}
