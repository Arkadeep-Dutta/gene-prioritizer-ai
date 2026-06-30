import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppHeader } from "@/components/layout/AppHeader";
import { Footer } from "@/components/layout/Footer";

import "./globals.css";

export const metadata: Metadata = {
  title: "Gene Prioritizer AI",
  description: "Research-use foundation for phenotype-to-gene prioritization.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppHeader />
        {children}
        <Footer />
      </body>
    </html>
  );
}
