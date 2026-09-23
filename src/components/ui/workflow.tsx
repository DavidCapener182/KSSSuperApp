"use client";

import { useEffect, useRef, type ButtonHTMLAttributes, type FormEvent, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export type WorkflowStatus = "REQUESTED" | "AWAITING_REVIEW" | "REJECTED_ACTION_REQUIRED" | "ACCEPTED_AS_EVIDENCE";
const STATUS: Record<WorkflowStatus, string> = {
  REQUESTED: "Requested",
  AWAITING_REVIEW: "Submitted — awaiting review",
  REJECTED_ACTION_REQUIRED: "Rejected — action required",
  ACCEPTED_AS_EVIDENCE: "Evidence accepted",
};

export function PageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header className="ui-page-header"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></header>;
}
export function StatusBadge({ state }: { state: WorkflowStatus }) {
  return <Badge variant="secondary" className={`ui-status ui-status--${state.toLowerCase()}`}>{STATUS[state]}</Badge>;
}
export function FeedbackBanner({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "error" | "success" }) {
  return <p className={`ui-feedback ui-feedback--${tone}`} role={tone === "error" ? "alert" : "status"}>{children}</p>;
}
export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="ui-empty"><strong>{title}</strong><p>{description}</p></div>;
}
export function LoadingBlock({ label = "Loading content…" }: { label?: string }) {
  return <div className="ui-loading" role="status" aria-label={label}><span>{label}</span>
    <Skeleton className="h-5 w-2/5" /><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-4/5" />
  </div>;
}
export function ActionButton({ children, variant = "primary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "caution" | "destructive";
}) {
  return <Button variant={variant === "destructive" ? "destructive" : variant === "secondary" ? "secondary" : "default"}
    className={`ui-action ui-action--${variant}`} {...props}>{children}</Button>;
}
export function ConfirmDialog({ open, title, description, confirmLabel, variant, busy, error, onClose, onConfirm, children }: {
  open: boolean; title: string; description: string; confirmLabel: string;
  variant: "primary" | "caution"; busy: boolean; error?: string;
  onClose: () => void; onConfirm: () => void; children?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const priorFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      priorFocus.current = document.activeElement as HTMLElement | null;
      element.showModal();
      element.querySelector<HTMLElement>("button")?.focus();
    } else if (!open && element.open) {
      element.close();
      priorFocus.current?.focus();
    }
  }, [open]);
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); onConfirm(); }
  return <dialog ref={dialog} className="ui-dialog" aria-labelledby="review-dialog-title"
    aria-describedby="review-dialog-description" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <form onSubmit={submit}>
      <h2 id="review-dialog-title">{title}</h2>
      <p id="review-dialog-description">{description}</p>
      {children}
      {error && <FeedbackBanner tone="error">{error}</FeedbackBanner>}
      <div className="ui-dialog-actions">
        <ActionButton type="button" variant="secondary" disabled={busy} onClick={onClose}>Cancel</ActionButton>
        <ActionButton type="submit" variant={variant} disabled={busy}>{busy ? "Saving…" : confirmLabel}</ActionButton>
      </div>
    </form>
  </dialog>;
}
