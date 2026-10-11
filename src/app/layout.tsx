import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/config/app";

import "./globals.css";

// latin-ext carries the peso sign (₱) used by the default workspace currency.
const appFont = Hanken_Grotesk({
  variable: "--font-app",
  subsets: ["latin", "latin-ext"],
});

// Display face for page titles, headline figures and the receivables statement.
const displayFont = Bricolage_Grotesque({
  variable: "--font-display-face",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: { default: PRODUCT_NAME, template: `%s | ${PRODUCT_NAME}` },
  description: `${PRODUCT_TAGLINE}. UI prototype with demo data.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${appFont.variable} ${displayFont.variable} h-full antialiased`}>
      <body className="min-h-full">
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
