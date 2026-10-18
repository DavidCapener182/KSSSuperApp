"use client";
import Link from "next/link";
import { flushSync } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { STATUSES, type Issue, type OwnerChoice } from "@/lib/client-workspaces/types";
import { assignmentReceipt } from "@/lib/client-workspaces/assignment-receipt";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import styles from "./tfs-workspace.module.css";
const REGIONS = ["all", "north", "south", "unassigned"] as const;
const TYPES = ["Stock loss", "External theft", "Tester orders", "Stock discrepancy", "Other"] as const;
const PRIORITIES = ["Urgent", "High", "Review", "Monitor"] as const;
export function TfsBoard({workspaceId,workspaceName,issues,canOperate,owners}:{workspaceId:string;workspaceName?:string;issues:Issue[];canOperate:boolean;owners:OwnerChoice[]|null}) {
 const [region,setRegion]=useState<typeof REGIONS[number]>("all"); const [query,setQuery]=useState("");
 const [lane,setLane]=useState<typeof STATUSES[number]>(STATUSES[0]);
 const filtered=useMemo(()=>issues.filter(i=>(region==="all"||i.source_region===region) &&
  [i.store_name,i.store_number||"",i.evidence_summary,i.issue_type].join(" ").toLowerCase().includes(query.trim().toLowerCase())),[issues,region,query]);
 const open=filtered.filter(i=>i.status!=="Closed").length;
 return <div className={styles.board}><p className="cw-evidence-notice">Evidence first. Tester ordering, stock differences and red stocktakes are review signals. They do not establish internal theft. Confirm counts, deliveries, adjustments and CCTV before escalation.</p><div className="cw-toolbar"><div className="cw-region" aria-label="Region filter">{REGIONS.map(r=><button type="button" aria-pressed={region===r} onClick={()=>setRegion(r)} key={r}>{r==="all"?"All areas":r==="north"?"North of Birmingham · Dave":r==="south"?"South of Birmingham · Andy":"Boundary / outside UK"}</button>)}</div><label className="cw-search">Search issues<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search store or issue" type="search"/></label>{canOperate&&<TfsIssueAction workspaceId={workspaceId} workspaceName={workspaceName} owners={owners} label="+ Add issue"/>}</div>
 <div className="cw-metrics"><div><b>{filtered.length}</b><span>Total cards · {open} open</span></div><div><b>{filtered.filter(i=>i.status==="Visit needed").length}</b><span>Visit needed</span></div><div><b>{filtered.filter(i=>i.potential_internal_theft_review&&i.status!=="Closed").length}</b><span>Internal theft review · unproven</span></div><div><b>{filtered.filter(i=>i.priority==="Urgent"&&i.status!=="Closed").length}</b><span>Red / urgent</span></div></div>
 <div className="cw-lane-tabs" aria-label="Issue status">{STATUSES.map(s=><button type="button" key={s} aria-pressed={lane===s} onClick={()=>setLane(s)}>{s} <span>{filtered.filter(i=>i.status===s).length}</span></button>)}</div>
 <div className="cw-board">{STATUSES.map(s=><section key={s} className={`cw-lane ${lane===s?"cw-lane-active":""}`} aria-label={s}><h2>{s} <span>{filtered.filter(i=>i.status===s).length}</span></h2><div className="cw-lane-list" role="region" aria-label={`${s} cards`} tabIndex={0}>{filtered.filter(i=>i.status===s).map(i=><Link className="cw-issue-card" key={i.id} href={`/client-workspaces/${workspaceId}/loss-prevention/${i.id}`}><span className="cw-card-top"><strong>{i.store_number?`${i.store_number} · `:""}{i.store_name}</strong><span className={`cw-priority cw-${i.priority.toLowerCase()}`}>{i.priority}</span></span><small>{i.ownerPersonName ? `${i.ownerPersonName} · mapped KSS Person` : `${i.source_owner} · source label only`} · {i.issue_type} · Evidence {i.evidence_date||"date to verify"}</small><p>{i.evidence_summary}</p>{i.potential_internal_theft_review&&<em>◉ Internal theft review · unproven</em>}<span className="cw-next"><b>Next:</b> {i.next_action}</span>{i.source_note&&<span className="cw-source">{i.source_note}</span>}</Link>)}</div></section>)}</div>
 </div>;
}
export function TfsIssueAction({workspaceId,workspaceName,issue,owners,label}:{workspaceId:string;workspaceName?:string;issue?:Issue;owners:OwnerChoice[]|null;label?:string}) {
 const [open,setOpen]=useState(false),[pending,setPending]=useState(false);
 return <Sheet open={open} onOpenChange={next=>{if(!pending)setOpen(next);}}><SheetTrigger asChild><button type="button" className="cw-primary">{label??"Update issue"}</button></SheetTrigger><SheetContent className={styles.panel} onEscapeKeyDown={event=>{if(pending)event.preventDefault();}} onInteractOutside={event=>{if(pending)event.preventDefault();}}><SheetHeader><SheetTitle>{issue?"Update issue":"Add issue"}</SheetTitle><SheetDescription>{workspaceName??"Selected workspace"}{issue?` · ${issue.store_number??"Unmatched store"} · ${issue.store_name} · revision ${issue.revision}`:" · record source evidence and the next action"}</SheetDescription></SheetHeader><p className={styles.exactIdentity}>Workspace <code>{workspaceId}</code>{issue&&<> · Issue <code>{issue.id}</code></>}</p>{open&&<TfsIssueEditor workspaceId={workspaceId} issue={issue} owners={owners} onBusyChange={setPending} onSaved={()=>setOpen(false)}/>}</SheetContent></Sheet>;
}
export function TfsIssueEditor({workspaceId,issue,onSaved,owners,onBusyChange}:{workspaceId:string;issue?:Issue;owners:OwnerChoice[]|null;onSaved?:()=>void;onBusyChange?:(busy:boolean)=>void}) {
 const pending=useRef(false),sequence=useRef(0);

 const router=useRouter(); const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
 const [status,setStatus]=useState(issue?.status||STATUSES[0]); const [priority,setPriority]=useState(issue?.priority||"Review");
 const [type,setType]=useState(issue?.issue_type||TYPES[0]); const [region,setRegion]=useState(issue?.source_region||"unassigned");
 const choicesUnavailable=owners===null;
 const context=JSON.stringify([workspaceId,issue?.id,issue?.revision,issue?.status,issue?.priority,issue?.issue_type,issue?.source_region,choicesUnavailable]);
 const previousContext=useRef(context);
 useEffect(()=>{const version=sequence;const changed=previousContext.current!==context;previousContext.current=context;const timer=changed?setTimeout(()=>{pending.current=false;setBusy(false);onBusyChange?.(false);setMessage("");setStatus(issue?.status||STATUSES[0]);setPriority(issue?.priority||"Review");setType(issue?.issue_type||TYPES[0]);setRegion(issue?.source_region||"unassigned");},0):undefined;return()=>{clearTimeout(timer);version.current++;pending.current=false;onBusyChange?.(false);};},[context,issue?.status,issue?.priority,issue?.issue_type,issue?.source_region,onBusyChange]);
 async function save(form:FormData) {
  if(pending.current)return;
  if (owners === null) {setMessage("Person choices unavailable. Reload before saving.");return;}
  pending.current=true;const ticket=++sequence.current;
  flushSync(()=>{setBusy(true);onBusyChange?.(true);setMessage("Saving and reading back…");});
  const data={storeName:String(form.get("storeName")||""),storeNumber:String(form.get("storeNumber")||""),region,
   owner:String(form.get("owner")||"Unassigned"),ownerPersonId:String(form.get("ownerPersonId")||"")||null,type,priority,status,evidenceDate:String(form.get("evidenceDate")||""),
   evidenceSummary:String(form.get("evidenceSummary")||""),nextAction:String(form.get("nextAction")||""),
   sourceNote:String(form.get("sourceNote")||""),potentialInternalTheftReview:form.get("internal")==="on"};
  try { const path=`/api/client-workspaces/${workspaceId}/issues${issue?`/${issue.id}`:""}`;
   const res=await fetch(path,{method:issue?"PATCH":"POST",headers:{"content-type":"application/json"},body:JSON.stringify({revision:issue?.revision??null,data,reason:String(form.get("reason")||"")})});
   const body=await res.json();if(ticket!==sequence.current)return; if(!res.ok||!body.issue) {setMessage(body.error||"Save failed. The issue was not confirmed.");return;}
   const receipt=assignmentReceipt(body.issue,{workspaceId,issueId:issue?.id,revision:issue?.revision,previousOwner:issue?.owner_person_id,ownerPersonId:data.ownerPersonId,sourceOwner:data.owner,reason:String(form.get("reason")||"")});
   if(!receipt){setMessage("A save response was received, but the exact Person assignment and history could not be confirmed. Reload before another change.");return;}
   setMessage(`Server confirmed revision ${receipt.revision}.`); router.refresh(); onSaved?.();
   if(!issue) router.push(`/client-workspaces/${workspaceId}/loss-prevention/${receipt.id}`);
  } catch {if(ticket===sequence.current)setMessage("Connection failed. No save was confirmed.");} finally {if(ticket===sequence.current){pending.current=false;setBusy(false);onBusyChange?.(false);}}
 }
 return <form key={`${workspaceId}:${issue?.id||"new"}:${issue?.revision||0}`} className="cw-form" action={save}><fieldset className={styles.editorFields} disabled={busy||owners===null}><label>Store name<input name="storeName" required maxLength={160} defaultValue={issue?.store_name}/></label><label>Store number (text, exact)<input name="storeNumber" maxLength={40} defaultValue={issue?.store_number||""}/></label>
 <label>Source region<select value={region} onChange={e=>setRegion(e.target.value as typeof region)}><option value="north">North</option><option value="south">South</option><option value="unassigned">Unassigned</option></select></label>
 <label>Source owner label<input name="owner" required maxLength={120} defaultValue={issue?.source_owner||"Unassigned"}/></label>
 <label>Assigned KSS Person<select name="ownerPersonId" defaultValue={issue?.owner_person_id || ""} disabled={owners===null}>
 <option value="">Unassigned / source label only</option>
 {issue?.owner_person_id&&!owners?.some(p=>p.id===issue.owner_person_id)&&<option value={issue.owner_person_id}>{issue.ownerPersonName||"Existing Person"} · preserve current link</option>}
 {owners?.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
 {owners===null&&<p role="alert">Person choices unavailable. Reload before saving.</p>}
 <label>Type<select value={type} onChange={e=>setType(e.target.value)}>{TYPES.map(t=><option key={t}>{t}</option>)}</select></label>
 <label>Priority<select value={priority} onChange={e=>setPriority(e.target.value as typeof priority)}>{PRIORITIES.map(p=><option key={p}>{p}</option>)}</select></label>
 <label>Status<select value={status} onChange={e=>setStatus(e.target.value as typeof status)}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></label>
 <label>Evidence date<input name="evidenceDate" type="date" defaultValue={issue?.evidence_date||""}/></label>
 <label className="cw-span">Evidence summary<textarea name="evidenceSummary" required maxLength={2000} defaultValue={issue?.evidence_summary}/></label>
 <label className="cw-span">Next action<textarea name="nextAction" required maxLength={1000} defaultValue={issue?.next_action}/></label>
 <label className="cw-span">Source note<textarea name="sourceNote" maxLength={1000} defaultValue={issue?.source_note||""}/></label>
 <label className="cw-checkbox cw-span"><input name="internal" type="checkbox" defaultChecked={issue?.potential_internal_theft_review}/><span>Potential internal theft review · unproven</span></label>
 {issue&&<label className="cw-span">Reason for change<input name="reason" required minLength={10} maxLength={500}/></label>}
 <div className="cw-span"><button className="cw-primary" disabled={busy||owners===null}>{busy?"Confirming…":issue?"Save change":"Create issue"}</button><p role="status" aria-live="polite">{message}</p></div></fieldset></form>;
}
