"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LearningActions({ assignmentId, module, page, marked }: { assignmentId: string; module: number; page: number; marked: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function act(action: "SAVE_PLACE" | "MARK_PAGE") {
    setBusy(true); setMessage("");
    const response = await fetch("/api/training-learning", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, assignmentId, module, page }) });
    setBusy(false);
    setMessage(response.ok ? action === "SAVE_PLACE" ? "Place saved for this page." : "Page marked viewed." : "Learning action unavailable. Please refresh and try again.");
    if (response.ok) router.refresh();
  }
  return <div className="training-learning-actions"><button type="button" disabled={busy} onClick={() => act("SAVE_PLACE")}>Save my place</button><button type="button" disabled={busy || marked} onClick={() => act("MARK_PAGE")}>{marked ? "Page marked viewed" : "Mark page viewed"}</button><p role="status">{message}</p></div>;
}
