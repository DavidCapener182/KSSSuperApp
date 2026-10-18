"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LearningActions({ assignmentId, module, page, marked }: { assignmentId: string; module: number; page: number; marked: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function act(action: "SAVE_PLACE" | "MARK_PAGE") {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/training-learning", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, assignmentId, module, page }) });
      if (!response.ok) throw new Error("Learning action denied or stale. Refresh and try again.");
      const readback = await fetch(`/api/training-learning?view=content&id=${encodeURIComponent(assignmentId)}`, { cache: "no-store" });
      if (!readback.ok) throw new Error("The server accepted the action, but current learning progress could not be read back.");
      const current = (await readback.json()).data as { assignment?: { savedModule?: number; savedPage?: number }; marks?: { module: number; page: number }[] };
      const confirmed = action === "SAVE_PLACE"
        ? current.assignment?.savedModule === module && current.assignment?.savedPage === page
        : current.marks?.some(mark => mark.module === module && mark.page === page);
      if (!confirmed) throw new Error("The server accepted the action, but this page's current progress is not confirmed. Refresh before another action.");
      setMessage(action === "SAVE_PLACE" ? "Place saved and read back for this page." : "Page mark saved and read back.");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Learning action unavailable. Refresh and try again."); }
    finally { setBusy(false); }
  }
  return <div className="training-learning-actions"><button type="button" disabled={busy} onClick={() => act("SAVE_PLACE")}>Save my place</button><button type="button" disabled={busy || marked} onClick={() => act("MARK_PAGE")}>{marked ? "Page marked viewed" : "Mark page viewed"}</button><p role="status">{message}</p></div>;
}
