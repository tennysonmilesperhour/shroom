// Download links for the /api/export CSV datasets, shown under a list page's
// header. Exports cover every record, not just the current collection filter.

interface ExportLinksProps {
  items: readonly (readonly [dataset: string, label: string])[];
}

export default function ExportLinks({ items }: ExportLinksProps) {
  return (
    <p className="export-links">
      <span className="muted">Export CSV:</span>
      {items.map(([dataset, label]) => (
        <a key={dataset} href={`/api/export/${dataset}`} download className="row-anchor">
          {label}
        </a>
      ))}
    </p>
  );
}
