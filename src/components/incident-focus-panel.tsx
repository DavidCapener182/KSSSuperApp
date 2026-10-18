"use client";
import {useRef,useState,type ReactNode} from "react";
import {Sheet,SheetContent,SheetDescription,SheetHeader,SheetTitle,SheetTrigger} from "@/components/ui/sheet";
export function IncidentFocusPanel({label,title,context,busy,error,children}:{label:string;title:string;context:string;busy:boolean;error?:string;children:ReactNode}){
 const [open,setOpen]=useState(false),trigger=useRef<HTMLButtonElement>(null);
 return <Sheet open={open} onOpenChange={value=>{if(!busy)setOpen(value)}}><SheetTrigger asChild><button ref={trigger} type="button" className="incident-secondary" disabled={busy}>{label}</button></SheetTrigger><SheetContent className="incident-focus" showCloseButton={!busy} onEscapeKeyDown={e=>{if(busy)e.preventDefault()}} onInteractOutside={e=>{if(busy)e.preventDefault()}} onCloseAutoFocus={e=>{if(!trigger.current?.isConnected){e.preventDefault();document.querySelector<HTMLButtonElement>("[data-incident-refresh]")?.focus()}}}><SheetHeader><SheetTitle>{title}</SheetTitle><SheetDescription>{context}</SheetDescription></SheetHeader><div className="incident-focus-body">{busy&&<p role="status">Recording and refreshing the exact report…</p>}{error&&<p className="incident-error" role="alert">{error}</p>}{children}</div></SheetContent></Sheet>;
}
