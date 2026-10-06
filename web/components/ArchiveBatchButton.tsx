"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveBatches } from "@/app/(app)/batches/archive-actions";
export default function ArchiveBatchButton({ id, archived }: { id: number; archived: boolean }) {
  const [busy, start] = useTransition(); const [message, setMessage] = useState(""); const router = useRouter();
  return <div><button type="button" className="ghost" disabled={busy} onClick={() => start(async () => {
    try { const result = await archiveBatches([id], !archived); setMessage(result.message); if (result.ok) router.refresh(); }
    catch { setMessage("Archive connection interrupted. Reload to check the result."); }
  })}>{archived ? "Restore to active board" : "Archive batch"}</button><span role="status">{message}</span></div>;
}
