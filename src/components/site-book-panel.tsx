"use client";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import styles from "./site-book-operations.module.css";

/** Book-only presentation. The source owner retains authority, revisions and writes. */
export function SiteBookPanel({label,triggerLabel,title,context,busy,onOpen,children,error,notice}:{label:string;triggerLabel?:string;title:string;context:string;busy:boolean;onOpen?:()=>void;children:ReactNode;error?:string;notice?:string}) {
 const trigger=useRef<HTMLButtonElement>(null);
 const [open,setOpen]=useState(false);
 return <Sheet open={open} onOpenChange={value=>{if(!busy){if(value)onOpen?.();setOpen(value);}}}>
  <SheetTrigger asChild><Button ref={trigger} className={styles.trigger} variant="outline" disabled={busy} aria-label={triggerLabel}>{label}</Button></SheetTrigger>
  <SheetContent className={styles.panel} showCloseButton={!busy} onCloseAutoFocus={event=>{if(!trigger.current?.isConnected){event.preventDefault();document.querySelector<HTMLButtonElement>("[data-site-book-refresh]")?.focus();}}} onEscapeKeyDown={e=>{if(busy)e.preventDefault();}} onInteractOutside={e=>{if(busy)e.preventDefault();}}>
   <SheetHeader className={styles.panelHeader}><SheetTitle>{title}</SheetTitle><SheetDescription>{context}</SheetDescription></SheetHeader>
   <div className={styles.panelBody}>{busy&&<p role="status">Recording and checking the current source…</p>}{error&&<p role="alert" className="site-book-alert">{error}</p>}{notice&&<p role="status" className="site-book-status">{notice}</p>}{children}</div>
  </SheetContent>
 </Sheet>;
}
