"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {Sheet,SheetContent,SheetDescription,SheetHeader,SheetTitle} from "@/components/ui/sheet";

type Managed = { id:string;purpose:string;source_type:string;source_id:string|null;manual_origin:string|null;
 accountable_manager_id:string|null;state:string;revision:number;current_version_id:string;source_health:string;
 display_name:string;role_organisation:string;phone:string|null;email:string|null;priority:number;
 effective_from:string;effective_until:string;london_start:string|null;london_end:string|null;reviewed_on:string };
type Grant = { id:string;person_id:string;person_name:string;valid_from:string;valid_until:string;revoked_at:string|null };
type Preview = { context_kind:string;context_id:string;purpose:string;display_name:string;role_organisation:string;
 phone:string|null;email:string|null;priority:string;effective_from:string;effective_until:string;
 london_start:string|null;london_end:string|null;reviewed_on:string;preview_marker:string };
type ContactHistory = { routeId:string; data:{
 events:{id:string;action:string;occurred_at:string;actor_person_id:string;reason:string|null;old_version_id:string|null;new_version_id:string|null}[];
 versions:{id:string;version:number;display_name:string;role_organisation:string;phone:string|null;email:string|null;priority:number;effective_from:string;effective_until:string;reviewed_on:string}[] } };
type Draft = { route_id?:string;expected_revision?:number;action?:string;context_kind:string;context_id:string;purpose:string;
 source_type:string;source_id:string;manual_origin:string;accountable_manager_id:string;display_name:string;role_organisation:string;
 phone:string;email:string;use_phone:boolean;use_email:boolean;priority:string;effective_from:string;effective_until:string;
 london_start:string;london_end:string;reviewed_on:string;reason:string;preview_marker?:string };
const purposes=["CLIENT_OPERATIONAL","SITE_MANAGEMENT","KSS_DUTY_MANAGER","KSS_ESCALATION","FACILITIES_MAINTENANCE","HEALTH_SAFETY","EMERGENCY_SITE_CONTACT","OTHER_OPERATIONAL"];
const label=(value:string)=>value.split("_").map((v)=>v==="KSS"?v:v[0]+v.slice(1).toLowerCase()).join(" ");
const date=(v:string)=>new Date(v).toLocaleString("en-GB",{timeZone:"Europe/London",day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
const initial=(kind:string,id:string):Draft=>({context_kind:kind,context_id:id,purpose:"KSS_ESCALATION",source_type:"MANUAL_OPERATIONAL",
 source_id:"",manual_origin:"",accountable_manager_id:"",display_name:"",role_organisation:"",phone:"",email:"",use_phone:true,use_email:true,
 priority:"1",effective_from:"",effective_until:"",london_start:"",london_end:"",reviewed_on:"",reason:""});

export function OperationalContactsManager({kind,contextId,isSuper}:{kind:string;contextId:string;isSuper:boolean}) {return <ContactManagerScope key={`${kind}:${contextId}:${isSuper}`} kind={kind} contextId={contextId} isSuper={isSuper}/>;}
function ContactManagerScope({kind,contextId,isSuper}:{kind:string;contextId:string;isSuper:boolean}) {
 const active=useRef(true),draftSequence=useRef(0),readSequence=useRef(0),historySequence=useRef(0),reasonTrigger=useRef<HTMLButtonElement|null>(null);
 useEffect(()=>{active.current=true;return()=>{active.current=false}},[]);
 const [loading,setLoading]=useState(true),[previewing,setPreviewing]=useState(false),[grantsAllowed,setGrantsAllowed]=useState(false);
 const [reasonTarget,setReasonTarget]=useState<{action:"revoke"|"expire"|"revoke_grant";row?:Managed;grant?:Grant}|null>(null),[actionReason,setActionReason]=useState("");
 const [managed,setManaged]=useState<Managed[]|null>(null);const [current,setCurrent]=useState<Managed[]|null>(null);
 const [grants,setGrants]=useState<Grant[]>([]);const [draft,setDraft]=useState<Draft>(()=>initial(kind,contextId));
 const [preview,setPreview]=useState<Preview|null>(null);const [history,setHistory]=useState<ContactHistory|null>(null);
 const [historyReason,setHistoryReason]=useState("");const [grantPerson,setGrantPerson]=useState("");
 const [grantFrom,setGrantFrom]=useState("");const [grantUntil,setGrantUntil]=useState("");const [grantReason,setGrantReason]=useState("");
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const api="/api/operational-contacts";
 const reload=useCallback(async()=>{const ticket=++readSequence.current;historySequence.current++;setLoading(true);setError("");setNotice("");setManaged(null);setCurrent(null);setPreview(null);setHistory(null);const qs=`kind=${kind}&id=${encodeURIComponent(contextId)}`;let rows:Managed[]|null=null;const live=()=>active.current&&ticket===readSequence.current;
  try{const m=await fetch(`${api}?view=manage&${qs}`,{cache:"no-store"});if(!live())return null;if(m.ok){const j=await m.json();if(!live())return null;rows=j.routes??[];setManaged(rows);}else{setReasonTarget(null);setDraft(initial(kind,contextId));const c=await fetch(`${api}?view=current&${qs}`,{cache:"no-store"});if(!live())return null;if(c.ok){const j=await c.json();if(!live())return null;setCurrent(j.routes??[]);}else setError("This exact context is unavailable or you do not have access.");}
   if(isSuper){const g=await fetch(`${api}?view=grants&${qs}`,{cache:"no-store"});if(!live())return null;if(g.ok){const j=await g.json();if(!live())return null;setGrants(j);setGrantsAllowed(true);}else{setGrants([]);setGrantsAllowed(false);}}return rows;
  }catch{if(live()){setManaged(null);setCurrent(null);setGrants([]);setGrantsAllowed(false);setReasonTarget(null);setError("This exact context could not be refreshed. Check current access before acting.");}return null;}finally{if(live())setLoading(false)}
 },[kind,contextId,isSuper]);
 useEffect(()=>{const timer=setTimeout(()=>void reload(),0);return()=>clearTimeout(timer);},[reload]);
 function editable(key:keyof Draft){if(loading||(busy&&!previewing))return false;return draft.action==="REORDERED"?["priority","reason"].includes(key):draft.action==="REVIEWED"?["reviewed_on","reason"].includes(key):true;}
 function change<K extends keyof Draft>(key:K,value:Draft[K]) {if(!editable(key))return;draftSequence.current++;setDraft((d)=>({...d,[key]:value,preview_marker:undefined}));setPreview(null);}
 function select(row:Managed,action="CORRECTED") {if(busy||loading)return;historySequence.current++;draftSequence.current++;setDraft({context_kind:kind,context_id:contextId,route_id:row.id,expected_revision:row.revision,action,
  purpose:row.purpose,source_type:row.source_type,source_id:row.source_id??"",manual_origin:row.manual_origin??"",
  accountable_manager_id:row.accountable_manager_id??"",display_name:row.display_name,role_organisation:row.role_organisation,
  phone:row.phone??"",email:row.email??"",use_phone:!!row.phone,use_email:!!row.email,priority:String(row.priority),
  effective_from:row.effective_from,effective_until:row.effective_until,london_start:row.london_start??"",
  london_end:row.london_end??"",reviewed_on:row.reviewed_on,reason:""});setPreview(null);setHistory(null);
  document.getElementById("contact-editor")?.scrollIntoView({block:"start"});}
 async function post(body:unknown) {if(!active.current)throw new Error("This view changed. Check its current source before acting.");const response=await fetch(api,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body),cache:"no-store"});
  const result=await response.json();if(!active.current)throw new Error("This view changed. Check its current source before acting.");if(!response.ok)throw new Error("Action denied or source/context changed. Refresh and review again.");return result;}
 async function makePreview() {if(busy||loading)return;const ticket=draftSequence.current;setPreviewing(true);setBusy(true);setError("");setNotice("");try {const result=await post({action:"preview",contact:draft}) as Preview;
  if(!active.current||ticket!==draftSequence.current)return;if(!result||result.context_kind!==kind||result.context_id!==contextId||typeof result.preview_marker!=="string"||!result.preview_marker)throw new Error("Preview did not confirm this exact selected context. Refresh and review again.");setPreview(result);setDraft((d)=>({...d,preview_marker:result.preview_marker}));}
  catch(e){if(active.current&&ticket===draftSequence.current){setPreview(null);setError(e instanceof Error?e.message:"Preview unavailable");}}finally{if(active.current){setPreviewing(false);setBusy(false);}}}
 async function publish() {if(!preview||busy||loading)return;if(preview.context_kind!==kind||preview.context_id!==contextId||preview.preview_marker!==draft.preview_marker){setPreview(null);setError("Preview changed. Review the exact Staff snapshot again before publication.");return;}setBusy(true);setError("");setNotice("");const priorVersion=managed?.find((row)=>row.id===draft.route_id)?.current_version_id;
  try{const result=await post({action:"publish",contact:draft}) as {routeId:string};
  const rows=await reload();if(!active.current)return;const published=rows?.find((row)=>row.id===result.routeId);
  if(!published || (priorVersion && published.current_version_id===priorVersion))throw new Error("Publication was sent, but its new exact version could not be confirmed in the current managed view. Refresh before trying again.");
  setNotice("Published route confirmed in the current managed view.");setDraft(initial(kind,contextId));setPreview(null);}
  catch(e){if(active.current){setPreview(null);setError(e instanceof Error?e.message:"Publication denied");}}finally{if(active.current)setBusy(false);}}
 async function act(action:"revoke"|"expire",row:Managed,reason:string) {if(busy||loading)return;if(reason.trim().length<3){setError("Enter a controlled reason of at least 3 characters.");return;}setBusy(true);setError("");setNotice("");try{await post({action,routeId:row.id,expectedRevision:row.revision,reason});
   const rows=await reload();if(!active.current)return;
   if(action==="revoke"){
    if(!rows?.some((current)=>current.id===row.id && current.state==="REVOKED" && current.revision>row.revision))throw new Error("Revocation was sent, but the exact route state could not be confirmed. Refresh before trying again.");
    setNotice("Route revocation confirmed in the current managed view.");setReasonTarget(null);
   } else {setNotice("Expiry action was sent. Read the restricted history to confirm its event.");setReasonTarget(null);}}
   catch(e){if(active.current)setError(e instanceof Error?e.message:"Action denied");}finally{if(active.current)setBusy(false);}}
 async function readHistory(row:Managed) {if(busy||loading)return;const ticket=++historySequence.current;if(historyReason.trim().length<3){setError("Enter a controlled history-read reason.");return;}
  setBusy(true);setError("");try{const q=new URLSearchParams({view:"history",id:row.id,reason:historyReason});
   const response=await fetch(`${api}?${q}`,{cache:"no-store"});if(!response.ok)throw new Error("History read denied.");
   const data=await response.json();if(!active.current||ticket!==historySequence.current)return;setHistory({routeId:row.id,data});}
   catch(e){if(active.current&&ticket===historySequence.current){setHistory(null);setError(e instanceof Error?e.message:"History unavailable");}}finally{if(active.current)setBusy(false);}}
 async function issueGrant() {if(busy||loading||!grantsAllowed)return;setBusy(true);setError("");setNotice("");try{const result=await post({action:"grant",kind,contextId,personId:grantPerson,validFrom:grantFrom,validUntil:grantUntil,reason:grantReason}) as {grantId:string};
  const response=await fetch(`${api}?view=grants&kind=${kind}&id=${encodeURIComponent(contextId)}`,{cache:"no-store"});
  if(!active.current)return;if(!response.ok){setGrants([]);setGrantsAllowed(false);setReasonTarget(null);throw new Error("Grant was sent, but current access could not be confirmed. Refresh before trying again.");}
  const rows=await response.json() as Grant[];if(!active.current)return;setGrants(rows);
  if(!rows.some((row)=>row.id===result.grantId && !row.revoked_at))throw new Error("Grant was sent, but its exact ID was not found in current access. Refresh before trying again.");
  setNotice("Finite exact-context grant confirmed in current access.");}catch(e){if(active.current)setError(e instanceof Error?e.message:"Grant denied");}finally{if(active.current)setBusy(false);}}
 async function revokeGrant(id:string,reason:string) {if(busy||loading||!grantsAllowed)return;if(reason.trim().length<3){setError("Enter a controlled reason of at least 3 characters.");return;}
  setBusy(true);setError("");setNotice("");try{await post({action:"revoke_grant",grantId:id,reason});
   const response=await fetch(`${api}?view=grants&kind=${kind}&id=${encodeURIComponent(contextId)}`,{cache:"no-store"});
   if(!active.current)return;if(!response.ok){setGrants([]);setGrantsAllowed(false);setReasonTarget(null);throw new Error("Revocation was sent, but current access could not be confirmed. Refresh before trying again.");}
   const rows=await response.json() as Grant[];if(!active.current)return;setGrants(rows);
   if(!rows.some((row)=>row.id===id && row.revoked_at))throw new Error("Revocation was sent, but the exact grant still appears active. Refresh before trying again.");
   setNotice("Grant revocation confirmed in current access.");setReasonTarget(null);}
  catch(e){if(active.current)setError(e instanceof Error?e.message:"Grant revocation denied");}finally{if(active.current)setBusy(false);}}
 return <div className="contact-management">
  <div className="contact-context-heading"><p className="enterprise-eyebrow">Published contact management</p><h2 data-contact-context tabIndex={-1}>{kind==="SITE_SERVICE"?"Site Service":label(kind)} contacts</h2><p>Exact context: {contextId}</p><p>Publishing creates a reviewed version for this context. Current contact access is checked separately for each viewer.</p></div>
  {error&&<p role="alert" className="enterprise-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <button data-contact-refresh type="button" onClick={()=>void reload()} disabled={busy||loading}>Refresh context</button>
  {current&&<section><h2>Current operational projection</h2><p>Operations can read current published routes within its accepted scope. Historical values and publication controls are restricted.</p>
   <div className="contact-cards">{current.map((r)=><article className="contact-card" key={r.id}><h3>{label(r.purpose)} · {r.priority===1?"Primary":"Backup"}</h3>
    <p>{r.state==="CURRENT"?r.display_name:r.state}</p>{r.state==="CURRENT"&&<p>{r.phone} {r.email}</p>}</article>)}</div></section>}
  {loading&&<p role="status">Refreshing current context and independent access…</p>}{managed&&<div className="contact-publishing-layout"><section className="contact-route-register"><h2>Published routes <small>{managed.length}</small></h2><p>Review purpose, priority, source health and effective time before correcting or republishing.</p><div className="contact-cards">{managed.map((r)=><article className="contact-card" key={r.id}>
   <p className="enterprise-eyebrow">{label(r.purpose)} · {r.priority===1?"Primary contact":`Backup ${r.priority-1}`}</p><h3>{r.display_name}</h3>
   <p>{r.role_organisation}</p><details className="contact-route-evidence"><summary>Current snapshot and source evidence</summary><p>Source: {r.source_type}{r.source_id?` · ${r.source_id}`:""} · {r.source_health} · {r.state}</p>
   {r.phone||r.email?<p>Published telephone: {r.phone??"Not published"} · email: {r.email??"Not published"}</p>
    :<p>Phone and email are restricted to the audited history read.</p>}
   {r.manual_origin&&<p>Controlled origin: {r.manual_origin} · accountable manager: {r.accountable_manager_id}</p>}
   <p>Current version: {r.current_version_id} · revision {r.revision}</p><p>Effective: {date(r.effective_from)} to {date(r.effective_until)}</p>
   <p>Daily London applicability: {r.london_start&&r.london_end?`${r.london_start}–${r.london_end}`:"All day"} · Reviewed: {r.reviewed_on.split("-").reverse().join("/")}</p></details><div className="contact-toolbar"><button type="button" aria-label={`Correct or republish ${r.display_name}`} onClick={()=>select(r)} disabled={busy||loading||r.state==="REVOKED"}>Correct / republish</button>
    <button type="button" aria-label={`Reorder ${r.display_name}`} onClick={()=>select(r,"REORDERED")} disabled={busy||loading||r.state==="REVOKED"}>Reorder</button>
    <button type="button" aria-label={`Review ${r.display_name}`} onClick={()=>select(r,"REVIEWED")} disabled={busy||loading||r.state==="REVOKED"}>Review</button>
    <button type="button" onClick={e=>{reasonTrigger.current=e.currentTarget;setActionReason("");setNotice("");setError("");setReasonTarget({action:"revoke",row:r})}} aria-label={`Revoke route for ${r.display_name}`} disabled={busy||loading||r.state==="REVOKED"}>Revoke</button>
    <button type="button" onClick={e=>{reasonTrigger.current=e.currentTarget;setActionReason("");setNotice("");setError("");setReasonTarget({action:"expire",row:r})}} aria-label={`Record expiry for ${r.display_name} if due`} disabled={busy||loading||r.state==="REVOKED"}>Record expiry if due</button></div>
   <button type="button" aria-label={`Read restricted history for ${r.display_name}`} onClick={()=>void readHistory(r)} disabled={busy||loading}>Read restricted history</button>
  </article>)}</div><details className="contact-privileged"><summary>Restricted source history</summary><label>Reason for privileged history read<input value={historyReason} maxLength={300} onChange={(e)=>setHistoryReason(e.target.value)} /></label>
  {history&&<div className="contact-history" role="region" aria-label="Restricted contact history"><h3>Restricted immutable history</h3><p>Exact route: <code>{history.routeId}</code>. This access is recorded with your reason.</p>
   <h4>Attributed events</h4><ol className="contact-history-list">{history.data.events.map((event)=><li key={event.id}><strong>{label(event.action)}</strong><span>{date(event.occurred_at)} · actor <code>{event.actor_person_id}</code></span>{event.reason&&<p>Reason: {event.reason}</p>}{event.new_version_id&&<p>New version: <code>{event.new_version_id}</code></p>}</li>)}</ol>
   <h4>Published versions</h4><ol className="contact-history-list">{history.data.versions.map((version)=><li key={version.id}><strong>Version {version.version} · {version.display_name}</strong><span>{version.role_organisation} · priority {version.priority}</span><p>Effective: {date(version.effective_from)} to {date(version.effective_until)} · reviewed {version.reviewed_on}</p><p>Published telephone: {version.phone??"Not published"} · email: {version.email??"Not published"}</p><p>Version ID: <code>{version.id}</code></p></li>)}</ol>
  </div>}</details></section>
  <section id="contact-editor" className="contact-editor"><p className="enterprise-eyebrow">{draft.action?label(draft.action):"New publication"}</p><h2>{draft.route_id?draft.display_name||"Selected route":"Publish new route"}</h2>{draft.route_id&&<p>Route {draft.route_id} · expected revision {draft.expected_revision}</p>}{draft.action==="REORDERED"&&<p>Reorder changes priority only. The same source values and validity remain pinned for review.</p>}{draft.action==="REVIEWED"&&<p>Review updates the review date and source marker; it does not silently correct contact values.</p>}
   <p>Staff will see only the previewed fields below. A source change after preview blocks publication.</p>
   <fieldset className="contact-fieldset"><legend>Contact and purpose</legend><div className="contact-form-grid"><label>Purpose<select value={draft.purpose} disabled={!editable("purpose")||!!draft.route_id} onChange={(e)=>change("purpose",e.target.value)}>{purposes.map((p)=><option key={p} value={p}>{label(p)}</option>)}</select></label>
   <label>Source type<select value={draft.source_type} disabled={!editable("source_type")||!!draft.route_id} onChange={(e)=>change("source_type",e.target.value)}><option value="MANUAL_OPERATIONAL">Manual operational</option><option value="CRM_CONTACT">Exact CRM Contact</option><option value="KSS_PERSON">Exact KSS Person</option></select></label>
   {draft.source_type!=="MANUAL_OPERATIONAL"?<><label>Exact source ID<input value={draft.source_id} disabled={!editable("source_id")||!!draft.route_id} onChange={(e)=>change("source_id",e.target.value)} /></label>
    <label><input type="checkbox" checked={draft.use_phone} disabled={!editable("use_phone")} onChange={(e)=>change("use_phone",e.target.checked)} /> Publish source telephone</label>
    <label><input type="checkbox" checked={draft.use_email} disabled={!editable("use_email")} onChange={(e)=>change("use_email",e.target.checked)} /> Publish source email</label></>:<>
    <label>Display name<input value={draft.display_name} disabled={!editable("display_name")} onChange={(e)=>change("display_name",e.target.value)} /></label>
    <label>Approved telephone<input value={draft.phone} disabled={!editable("phone")} onChange={(e)=>change("phone",e.target.value)} /></label>
    <label>Approved email<input value={draft.email} disabled={!editable("email")} onChange={(e)=>change("email",e.target.value)} /></label>
    <label>Controlled origin<input value={draft.manual_origin} disabled={!editable("manual_origin")||!!draft.route_id} onChange={(e)=>change("manual_origin",e.target.value)} /></label>
    <label>Accountable Contact Manager Person ID<input value={draft.accountable_manager_id} disabled={!editable("accountable_manager_id")||!!draft.route_id} onChange={(e)=>change("accountable_manager_id",e.target.value)} /></label></>}
   {draft.source_type!=="CRM_CONTACT"&&<label>Role / organisation<input value={draft.role_organisation} disabled={!editable("role_organisation")} onChange={(e)=>change("role_organisation",e.target.value)} /></label>}
   <label>Priority (1 primary, 2+ backup)<input type="number" min="1" max="20" value={draft.priority} disabled={!editable("priority")} onChange={(e)=>change("priority",e.target.value)} /></label>
   </div></fieldset><fieldset className="contact-fieldset"><legend>Validity and review</legend><div className="contact-form-grid"><label>Effective from (ISO with offset)<input placeholder="2026-09-24T20:00:00+01:00" value={draft.effective_from} disabled={!editable("effective_from")} onChange={(e)=>change("effective_from",e.target.value)} /></label>
   <label>Effective until / expiry (ISO with offset)<input placeholder="2026-10-01T20:00:00+01:00" value={draft.effective_until} disabled={!editable("effective_until")} onChange={(e)=>change("effective_until",e.target.value)} /></label>
   <label>Daily London start (optional)<input type="time" value={draft.london_start} disabled={!editable("london_start")} onChange={(e)=>change("london_start",e.target.value)} /></label>
   <label>Daily London end (optional)<input type="time" value={draft.london_end} disabled={!editable("london_end")} onChange={(e)=>change("london_end",e.target.value)} /></label>
   <label>Reviewed on<input type="date" value={draft.reviewed_on} disabled={!editable("reviewed_on")} onChange={(e)=>change("reviewed_on",e.target.value)} /></label>
   </div></fieldset><fieldset className="contact-fieldset"><legend>Publication reason</legend><div className="contact-form-grid"><label>Controlled reason<textarea value={draft.reason} maxLength={300} disabled={!editable("reason")} onChange={(e)=>change("reason",e.target.value)} /></label></div></fieldset>
   <div className="contact-toolbar"><button type="button" onClick={()=>void makePreview()} disabled={busy||loading}>Preview exact Staff view</button>
    {draft.route_id&&<button type="button" disabled={busy||loading} onClick={()=>{draftSequence.current++;setDraft(initial(kind,contextId));setPreview(null);}}>Start new route</button>}</div>

  </section><aside className="contact-preview-column">   {preview&&<div className="contact-preview" role="region" aria-label="Exact Staff-visible preview"><h3>Staff-visible preview · {preview.context_kind.replace("_"," ")} {preview.context_id}</h3>
    <p>{label(preview.purpose)} · {Number(preview.priority)===1?"Primary":`Backup ${Number(preview.priority)-1}`}</p><strong>{preview.display_name}</strong>
    <p>{preview.role_organisation}</p><p>Telephone: {preview.phone??"Not published"}</p><p>Email: {preview.email??"Not published"}</p>
    <p>Applicable: {date(preview.effective_from)} to {date(preview.effective_until)} · Reviewed {preview.reviewed_on.split("-").reverse().join("/")}</p>
    <button type="button" onClick={()=>void publish()} disabled={busy||loading}>Publish this reviewed snapshot</button></div>}{!preview&&<div className="contact-preview"><h3>Staff-visible snapshot</h3><p>Use Preview exact Staff view after editing. Publication is available only beside a current reviewed snapshot.</p></div>}</aside></div>}
  {isSuper&&<details className="contact-editor contact-grant-section"><summary>Exact-context Contact Manager access</summary>{!grantsAllowed?<p>Current grant access is unavailable. Refresh this context before an access change.</p>:<section><h2>Exact-context Contact Manager grants</h2><p>Office Admin role alone grants no contact publication authority.</p>
   <div className="contact-form-grid"><label>Office Admin Person ID<input value={grantPerson} onChange={(e)=>setGrantPerson(e.target.value)} /></label>
    <label>Grant starts (ISO with offset)<input value={grantFrom} onChange={(e)=>setGrantFrom(e.target.value)} /></label>
    <label>Grant ends (ISO with offset)<input value={grantUntil} onChange={(e)=>setGrantUntil(e.target.value)} /></label>
    <label>Controlled reason<input value={grantReason} onChange={(e)=>setGrantReason(e.target.value)} /></label></div>
   <button type="button" onClick={()=>void issueGrant()} disabled={busy||loading}>Issue finite grant</button>
   <ul>{grants.map((g)=><li key={g.id}>{g.person_name} · {date(g.valid_from)} to {date(g.valid_until)} · {g.revoked_at?"Revoked":"Active unless expired"}
    {!g.revoked_at&&<button type="button" onClick={e=>{reasonTrigger.current=e.currentTarget;setActionReason("");setNotice("");setError("");setReasonTarget({action:"revoke_grant",grant:g})}} aria-label={`Revoke contact-manager grant for ${g.person_name}`} disabled={busy||loading}>Revoke grant</button>}</li>)}</ul>
  </section>}</details>}
  <Sheet open={Boolean(reasonTarget)} onOpenChange={open=>{if(!open&&!busy)setReasonTarget(null)}}><SheetContent className="contact-reason-sheet" onCloseAutoFocus={e=>{e.preventDefault();if(reasonTrigger.current?.isConnected)reasonTrigger.current.focus();else document.querySelector<HTMLElement>("[data-contact-context]")?.focus()}} showCloseButton={!busy} onEscapeKeyDown={e=>{if(busy)e.preventDefault()}} onInteractOutside={e=>{if(busy)e.preventDefault()}}><SheetHeader><SheetTitle>{reasonTarget?.action==="expire"?"Record expiry if due":"Record exact revocation"}</SheetTitle><SheetDescription>{kind.replace("_"," ")} · {contextId}. {reasonTarget?.row?`${reasonTarget.row.display_name} · route ${reasonTarget.row.id} · revision ${reasonTarget.row.revision}`:reasonTarget?.grant?`${reasonTarget.grant.person_name} · grant ${reasonTarget.grant.id}`:""}</SheetDescription></SheetHeader><div className="contact-reason-body">{error&&<p role="alert" className="enterprise-error">{error}</p>}{notice&&<p role="status">{notice}</p>}<form className="contact-reason-form" onSubmit={e=>{e.preventDefault();if(!reasonTarget)return;if(reasonTarget.action==="revoke_grant"&&reasonTarget.grant)void revokeGrant(reasonTarget.grant.id,actionReason);else if(reasonTarget.row&&reasonTarget.action!=="revoke_grant")void act(reasonTarget.action,reasonTarget.row,actionReason)}}><label>Controlled reason<textarea required minLength={3} maxLength={300} value={actionReason} onChange={e=>setActionReason(e.target.value)} disabled={busy}/></label><button type="submit" disabled={busy||loading}>{busy?"Recording and checking…":reasonTarget?.action==="expire"?"Record expiry if due":"Confirm exact revocation"}</button></form></div></SheetContent></Sheet>
 </div>;
}
