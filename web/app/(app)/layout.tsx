import Nav from "@/components/Nav";
import SporeMark from "@/components/SporeMark";

// Open access — no auth gate.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar">
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
            <span
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--moss)",
                boxShadow: "0 0 8px var(--moss)",
                marginRight: 8,
                verticalAlign: "middle",
              }}
            />
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
