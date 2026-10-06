"use client";
import EntityForm from "@/components/EntityForm";
import { importBags } from "./import-actions";
export default function ImportBags() {
  return <EntityForm action={importBags} submitLabel="Import grain bags">
    <p>One row per grain bag. Columns: lot_code,strain,inoculated_on,notes. Dates use YYYY-MM-DD. Existing lots and their harvest history are preserved. Keep the Master Sheet updated with these same bag IDs.</p>
    <label>Grain bag CSV<input type="file" name="csv" accept=".csv,text/csv" required /></label>
  </EntityForm>;
}
