"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { STATUSES, type Issue } from "@/lib/client-workspaces/types";
const REGIONS = ["all", "north", "south", "unassigned"] as const;
const TYPES = ["Stock loss", "External theft", "Tester orders", "Stock discrepancy", "Other"] as const;
const PRIORITIES = ["Urgent", "High", "Review", "Monitor"] as const;
export function TfsBoard({workspaceId,issues,canOperate}:{workspaceId:string;issues:Issue[];canOperate:boolean}) {
 const [region,setRegion]=useState<typeof REGIONS[number]>("all"); const [query,setQuery]=useState("");
 const [lane,setLane]=useState<typeof STATUSES[number]>(STATUSES[0]); const [newIssue,setNewIssue]=useState(false);
 const filtered=useMemo(()=>issues.filter(i=>(region==="all"||i.source_region===region) &&
  [i.store_name,i.store_number||"",i.evidence_summary,i.issue_type].join(" ").toLowerCase().includes(query.trim().toLowerCase())),[issues,region,query]);
 const open=filtered.filter(i=>i.status!=="Closed").length;
 return <><div className="cw-metrics"><div><b>{open}</b><span>Open issues</span></div><div><b>{filtered.filter(i=>i.status==="Visit needed").length}</b><span>Visit needed</span></div><div><b>{filtered.filter(i=>i.potential_internal_theft_review).length}</b><span>Internal theft review · unproven</span></div><div><b>{filtered.filter(i=>i.priority==="Urgent").length}</b><span>Urgent</span></div></div>
 <div className="cw-toolbar"><div className="cw-region" aria-label="Region filter">{REGIONS.map(r=><button type="button" aria-pressed={region===r} onClick={()=>setRegion(r)} key={r}>{r==="all"?"All regions":r}</button>)}</div><label className="cw-search">Search issues<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Store, number, evidence or type" type="search"/></label>{canOperate&&<button className="cw-primary" onClick={()=>setNewIssue(true)}>Add issue</button>}</div>
 <div className="cw-lane-tabs" aria-label="Issue status">{STATUSES.map(s=><button type="button" key={s} aria-pressed={lane===s} onClick={()=>setLane(s)}>{s} <span>{filtered.filter(i=>i.status===s).length}</span></button>)}</div>
 <div className="cw-board">{STATUSES.map(s=><section key={s} className={`cw-lane ${lane===s?"cw-lane-active":""}`} aria-label={s}><h2>{s} <span>{filtered.filter(i=>i.status===s).length}</span></h2><div>{filtered.filter(i=>i.status===s).map(i=><Link className="cw-issue-card" key={i.id} href={`/client-workspaces/${workspaceId}/loss-prevention/${i.id}`}><span className={`cw-priority cw-${i.priority.toLowerCase()}`}>{i.priority}</span><strong>{i.store_name}</strong><small>{i.store_number?`Store ${i.store_number} · `:"Unmatched store · "}{i.source_region}</small><p>{i.evidence_summary}</p><span className="cw-next">Next: {i.next_action}</span>{i.potential_internal_theft_review&&<em>Internal theft review · unproven</em>}</Link>)}</div></section>)}</div>
 {newIssue&&<div className="cw-dialog-wrap"><div className="cw-dialog" role="dialog" aria-modal="true" aria-label="Add issue"><button type="button" className="cw-dialog-close" onClick={()=>setNewIssue(false)}>Close</button><h2>Add issue</h2><p>New details are saved only after the server accepts and reads them back.</p><TfsIssueEditor workspaceId={workspaceId} onSaved={()=>setNewIssue(false)}/></div></div>}</>;
}
export function TfsIssueEditor({workspaceId,issue,onSaved}:{workspaceId:string;issue?:Issue;onSaved?:()=>void}) {
 const router=useRouter(); const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
 const [status,setStatus]=useState(issue?.status||STATUSES[0]); const [priority,setPriority]=useState(issue?.priority||"Review");
 const [type,setType]=useState(issue?.issue_type||TYPES[0]); const [region,setRegion]=useState(issue?.source_region||"unassigned");
 async function save(form:FormData) {
  setBusy(true); setMessage("Saving and reading back…");
  const data={storeName:String(form.get("storeName")||""),storeNumber:String(form.get("storeNumber")||""),region,
   owner:String(form.get("owner")||"Unassigned"),type,priority,status,evidenceDate:String(form.get("evidenceDate")||""),
   evidenceSummary:String(form.get("evidenceSummary")||""),nextAction:String(form.get("nextAction")||""),
   sourceNote:String(form.get("sourceNote")||""),potentialInternalTheftReview:form.get("internal")==="on"};
  try { const path=`/api/client-workspaces/${workspaceId}/issues${issue?`/${issue.id}`:""}`;
   const res=await fetch(path,{method:issue?"PATCH":"POST",headers:{"content-type":"application/json"},body:JSON.stringify({revision:issue?.revision??null,data,reason:String(form.get("reason")||"")})});
   const body=await res.json(); if(!res.ok||!body.issue) {setMessage(body.error||"Save failed. The issue was not confirmed.");return;}
   setMessage(`Server confirmed revision ${body.issue.revision}.`); router.refresh(); onSaved?.();
   if(!issue) router.push(`/client-workspaces/${workspaceId}/loss-prevention/${body.issue.id}`);
  } catch {setMessage("Connection failed. No save was confirmed.");} finally {setBusy(false);}
 }
 return <form className="cw-form" action={save}><label>Store name<input name="storeName" required maxLength={160} defaultValue={issue?.store_name}/></label><label>Store number (text, exact)<input name="storeNumber" maxLength={40} defaultValue={issue?.store_number||""}/></label>
 <label>Source region<select value={region} onChange={e=>setRegion(e.target.value as typeof region)}><option value="north">North</option><option value="south">South</option><option value="unassigned">Unassigned</option></select></label>
 <label>Source owner<input name="owner" required maxLength={120} defaultValue={issue?.source_owner||"Unassigned"}/></label>
 <label>Type<select value={type} onChange={e=>setType(e.target.value)}>{TYPES.map(t=><option key={t}>{t}</option>)}</select></label>
 <label>Priority<select value={priority} onChange={e=>setPriority(e.target.value as typeof priority)}>{PRIORITIES.map(p=><option key={p}>{p}</option>)}</select></label>
 <label>Status<select value={status} onChange={e=>setStatus(e.target.value as typeof status)}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></label>
 <label>Evidence date<input name="evidenceDate" type="date" defaultValue={issue?.evidence_date||""}/></label>
 <label className="cw-span">Evidence summary<textarea name="evidenceSummary" required maxLength={2000} defaultValue={issue?.evidence_summary}/></label>
 <label className="cw-span">Next action<textarea name="nextAction" required maxLength={1000} defaultValue={issue?.next_action}/></label>
 <label className="cw-span">Source note · human entered, unverified<textarea name="sourceNote" maxLength={1000} defaultValue={issue?.source_note||""}/></label>
 <label className="cw-checkbox cw-span"><input name="internal" type="checkbox" defaultChecked={issue?.potential_internal_theft_review}/><span>Potential internal theft review · unproven</span></label>
 {issue&&<label className="cw-span">Reason for change<input name="reason" required minLength={10} maxLength={500}/></label>}
 <div className="cw-span"><button className="cw-primary" disabled={busy}>{busy?"Confirming…":issue?"Save change":"Create issue"}</button><p role="status" aria-live="polite">{message}</p></div></form>;
}
