import type { Metadata } from "next";
import "./globals.css";
import QuantumBackground from "@/components/QuantumBackground";

export const metadata: Metadata = {
  title: "Quantum Blue — Mycology OS",
  description: "Quantum Blue: grow operation + business backend",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QuantumBackground />
        {children}
      </body>
    </html>
  );
}
