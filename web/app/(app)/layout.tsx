import Nav from "@/components/Nav";
import MobileNav from "@/components/MobileNav";
import SporeMark from "@/components/SporeMark";

// Open access — no auth gate.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <MobileNav />

      <aside className="sidebar" aria-label="Sidebar navigation">
        <div className="brand">
          <SporeMark size={26} />
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
            <span className="logo">Quantum Blue</span>
            <span className="eyebrow" style={{ marginTop: 2 }}>Mycology OS</span>
          </div>
        </div>
        <Nav />
        <div className="foot">
          <span className="who">
            <span className="live-dot" aria-hidden="true" />
            Live · in-house
          </span>
        </div>
      </aside>

      <div className="content">
        <main>{children}</main>
      </div>
    </div>
  );
}
