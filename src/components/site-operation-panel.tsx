"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import styles from "./site-operations.module.css";

/** Site-family presentation only; callers retain their source-owned forms. */
export function SiteOperationPanel({ label, title, context, busy, children }: {
  label: string; title: string; context: string; busy: boolean; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return <Sheet open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}>
    <SheetTrigger asChild><Button variant="outline" disabled={busy}>{label}</Button></SheetTrigger>
    <SheetContent className={styles.operationPanel} onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onInteractOutside={(event) => { if (busy) event.preventDefault(); }}>
      <SheetHeader className={styles.panelHeader}><SheetTitle>{title}</SheetTitle><SheetDescription>{context}</SheetDescription></SheetHeader>
      <div className={styles.panelBody}>{busy && <p role="status">Saving and checking the source…</p>}{children}</div>
    </SheetContent>
  </Sheet>;
}
