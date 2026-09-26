import type { Metadata } from "next";
import OperationsCopilot from "@/components/OperationsCopilot";
import AppShell from "@/components/AppShell";
import { AppStoreProvider } from "@/lib/store";
import { ToastProvider } from "@/lib/toast";
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
          <ToastProvider>
            <AppShell>{children}</AppShell>
            <OperationsCopilot />
          </ToastProvider>
        </AppStoreProvider>
      </body>
    </html>
  );
}
