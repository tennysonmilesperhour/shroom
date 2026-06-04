import Nav from "@/components/Nav";
import MobileNav from "@/components/MobileNav";
import SporeMark from "@/components/SporeMark";

// Open access — no auth gate. SSR pages read with the service-role client
// (see utils/supabase/service.ts); the browser never holds a Supabase session.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      <MobileNav />

      <aside className="sidebar" aria-label="Sidebar">
        <div className="brand">
          <SporeMark size={26} />
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
            <span className="logo">Quantum Blue</span>
            <span
              style={{
                fontSize: 9.5,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--muted)",
                fontWeight: 600,
                marginTop: 2,
              }}
            >
              Mycology OS
            </span>
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
        <main id="main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
