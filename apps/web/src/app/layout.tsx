import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Footer, Header } from "@/components/chrome";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Errand: errands paid for by an agent that explains every dollar", template: "%s · Errand" },
  description:
    "Errand researches, tops up phones and buys eSIMs for you. It pays sellers through Kite Passport within the limit you approve, checks every payment with SERV Reasoning, and gives you a receipt.",
  openGraph: {
    title: "Errand",
    description: "Give an agent the errand. Keep control of the money.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f3ed" },
    { media: "(prefers-color-scheme: dark)", color: "#13120f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-paper">
          Skip to content
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
