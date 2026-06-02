import Nav from "@/components/Nav";
import SporeMark from "@/components/SporeMark";

// Auth is benched for now — in-house only until the build is finished.
// Re-enable by restoring the getUser()/redirect guard + the auth middleware.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <SporeMark size={26} />
          <span className="logo">Quantum Blue</span>
        </div>
        <Nav />
        <div className="foot">
          <span className="who">In-house build</span>
        </div>
      </aside>
      <div className="content">
        <main>{children}</main>
      </div>
    </div>
  );
}
