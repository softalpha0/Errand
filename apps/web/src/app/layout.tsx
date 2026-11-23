import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Footer, Header } from "@/components/chrome";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Errand: your errands in Naira, paid from your own wallet", template: "%s · Errand" },
  description:
    "Errand converts USD₮ to cNGN on Celo and pays the person you name, from your own Altana wallet, under a session with a spend cap, a contract allowlist and an expiry that you can revoke in one transaction.",
  openGraph: {
    title: "Errand on Celo",
    description: "Your errands in Naira, paid from your own wallet. You set the cap.",
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
