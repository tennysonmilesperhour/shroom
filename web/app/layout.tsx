import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shroom OS — Quantum Blue Mycology",
  description: "Mushroom grow operation + business backend",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
