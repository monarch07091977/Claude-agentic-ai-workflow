import "./globals.css";
import type { ReactNode } from "react";
import { Fraunces } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

export const metadata = {
  title: "Agentic Workflow Framework",
  description:
    "Deconstruct a process, score it for AI agent fit, design the agent architecture, and prove the value — one repeatable workflow.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fraunces.variable}>
      <body className="bg-slate-50 text-slate-900">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
