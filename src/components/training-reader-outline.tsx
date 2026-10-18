"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import styles from "./training-learners.module.css";

export function TrainingReaderOutline({ children, label }: { children: ReactNode; label: string }) {
  const [open, setOpen] = useState(false);
  return <aside className={styles.outline}>
    <nav className={styles.desktopOutline} aria-label={label}>{children}</nav>
    <div className={styles.mobileOutline}><Sheet open={open} onOpenChange={setOpen}><SheetTrigger asChild><Button variant="outline">Course outline</Button></SheetTrigger><SheetContent className={styles.outlineSheet}><SheetTitle>Course outline</SheetTitle><SheetDescription>Choose a page. Navigation does not mark it viewed or save your place.</SheetDescription><nav aria-label={label} onClick={(event) => { if ((event.target as HTMLElement).closest("a")) setOpen(false); }}>{children}</nav></SheetContent></Sheet></div>
  </aside>;
}
