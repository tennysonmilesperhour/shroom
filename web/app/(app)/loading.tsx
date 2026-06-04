// Renders inside the (app) shell while server-component pages fetch.
// Skeleton matches the editorial layout so there's no jarring shift on hydration.
export default function AppLoading() {
  return (
    <div className="loading-skeleton" aria-busy="true" aria-live="polite">
      <div className="skl-eyebrow" />
      <div className="skl-h1" />
      <div className="skl-lead" />
      <div className="skl-kpi-row">
        <div className="skl-kpi skl-kpi-feature" />
        <div className="skl-kpi" />
        <div className="skl-kpi" />
        <div className="skl-kpi" />
      </div>
      <div className="skl-card" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
