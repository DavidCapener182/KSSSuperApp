"use client";

import { useCallback, useEffect, useState } from "react";

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

export function OperationalContactsManager({kind,contextId,isSuper}:{kind:string;contextId:string;isSuper:boolean}) {
 const [managed,setManaged]=useState<Managed[]|null>(null);const [current,setCurrent]=useState<Managed[]|null>(null);
 const [grants,setGrants]=useState<Grant[]>([]);const [draft,setDraft]=useState<Draft>(()=>initial(kind,contextId));
 const [preview,setPreview]=useState<Preview|null>(null);const [history,setHistory]=useState<ContactHistory|null>(null);
 const [historyReason,setHistoryReason]=useState("");const [grantPerson,setGrantPerson]=useState("");
 const [grantFrom,setGrantFrom]=useState("");const [grantUntil,setGrantUntil]=useState("");const [grantReason,setGrantReason]=useState("");
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const api="/api/operational-contacts";
 const reload=useCallback(async()=>{
  setError("");
  const qs=`kind=${kind}&id=${encodeURIComponent(contextId)}`;
  const m=await fetch(`${api}?view=manage&${qs}`,{cache:"no-store"});
  let managedRows:Managed[]|null=null;
  if(m.ok){managedRows=(await m.json()).routes??[];setManaged(managedRows);setCurrent(null);}
  else {const c=await fetch(`${api}?view=current&${qs}`,{cache:"no-store"});
   if(c.ok){setCurrent((await c.json()).routes??[]);setManaged(null);}else{setError("This exact context is unavailable or you do not have access.");setManaged(null);setCurrent(null);}}
  if(isSuper){const g=await fetch(`${api}?view=grants&${qs}`,{cache:"no-store"});if(g.ok)setGrants(await g.json());}
  return managedRows;
 },[kind,contextId,isSuper]);
 useEffect(()=>{const timer=setTimeout(()=>void reload(),0);return()=>clearTimeout(timer);},[reload]);
 function change<K extends keyof Draft>(key:K,value:Draft[K]) {setDraft((d)=>({...d,[key]:value,preview_marker:undefined}));setPreview(null);}
 function select(row:Managed,action="CORRECTED") {setDraft({context_kind:kind,context_id:contextId,route_id:row.id,expected_revision:row.revision,action,
  purpose:row.purpose,source_type:row.source_type,source_id:row.source_id??"",manual_origin:row.manual_origin??"",
  accountable_manager_id:row.accountable_manager_id??"",display_name:row.display_name,role_organisation:row.role_organisation,
  phone:row.phone??"",email:row.email??"",use_phone:!!row.phone,use_email:!!row.email,priority:String(row.priority),
  effective_from:row.effective_from,effective_until:row.effective_until,london_start:row.london_start??"",
  london_end:row.london_end??"",reviewed_on:row.reviewed_on,reason:""});setPreview(null);setHistory(null);
  document.getElementById("contact-editor")?.scrollIntoView({behavior:"smooth"});}
 async function post(body:unknown) {const response=await fetch(api,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body),cache:"no-store"});
  if(!response.ok)throw new Error("Action denied or source/context changed. Refresh and review again.");return response.json();}
 async function makePreview() {setBusy(true);setError("");setNotice("");try {const result=await post({action:"preview",contact:draft}) as Preview;
  setPreview(result);setDraft((d)=>({...d,preview_marker:result.preview_marker}));}
  catch(e){setPreview(null);setError(e instanceof Error?e.message:"Preview unavailable");}finally{setBusy(false);}}
 async function publish() {if(!preview)return;setBusy(true);setError("");setNotice("");const priorVersion=managed?.find((row)=>row.id===draft.route_id)?.current_version_id;
  try{const result=await post({action:"publish",contact:draft}) as {routeId:string};
  const rows=await reload();const published=rows?.find((row)=>row.id===result.routeId);
  if(!published || (priorVersion && published.current_version_id===priorVersion))throw new Error("Publication was sent, but its new exact version could not be confirmed in the current managed view. Refresh before trying again.");
  setNotice("Published route confirmed in the current managed view.");setDraft(initial(kind,contextId));setPreview(null);}
  catch(e){setPreview(null);setError(e instanceof Error?e.message:"Publication denied");}finally{setBusy(false);}}
 async function act(action:"revoke"|"expire",row:Managed) {const reason=window.prompt(`Controlled reason for ${action}`);
  if(!reason)return;setBusy(true);setError("");setNotice("");try{await post({action,routeId:row.id,expectedRevision:row.revision,reason});
   const rows=await reload();
   if(action==="revoke"){
    if(!rows?.some((current)=>current.id===row.id && current.state==="REVOKED" && current.revision>row.revision))throw new Error("Revocation was sent, but the exact route state could not be confirmed. Refresh before trying again.");
    setNotice("Route revocation confirmed in the current managed view.");
   } else setNotice("Expiry action was sent. Read the restricted history to confirm its event.");}
   catch(e){setError(e instanceof Error?e.message:"Action denied");}finally{setBusy(false);}}
 async function readHistory(row:Managed) {if(historyReason.trim().length<3){setError("Enter a controlled history-read reason.");return;}
  setBusy(true);setError("");try{const q=new URLSearchParams({view:"history",id:row.id,reason:historyReason});
   const response=await fetch(`${api}?${q}`,{cache:"no-store"});if(!response.ok)throw new Error("History read denied.");
   setHistory({routeId:row.id,data:await response.json()});}
   catch(e){setError(e instanceof Error?e.message:"History unavailable");}finally{setBusy(false);}}
 async function issueGrant() {setBusy(true);setError("");setNotice("");try{const result=await post({action:"grant",kind,contextId,personId:grantPerson,validFrom:grantFrom,validUntil:grantUntil,reason:grantReason}) as {grantId:string};
  const response=await fetch(`${api}?view=grants&kind=${kind}&id=${encodeURIComponent(contextId)}`,{cache:"no-store"});
  if(!response.ok)throw new Error("Grant was sent, but current access could not be confirmed. Refresh before trying again.");
  const rows=await response.json() as Grant[];setGrants(rows);
  if(!rows.some((row)=>row.id===result.grantId && !row.revoked_at))throw new Error("Grant was sent, but its exact ID was not found in current access. Refresh before trying again.");
  setNotice("Finite exact-context grant confirmed in current access.");}catch(e){setError(e instanceof Error?e.message:"Grant denied");}finally{setBusy(false);}}
 async function revokeGrant(id:string) {const reason=window.prompt("Controlled reason for grant revocation");if(!reason)return;
  setBusy(true);setError("");setNotice("");try{await post({action:"revoke_grant",grantId:id,reason});
   const response=await fetch(`${api}?view=grants&kind=${kind}&id=${encodeURIComponent(contextId)}`,{cache:"no-store"});
   if(!response.ok)throw new Error("Revocation was sent, but current access could not be confirmed. Refresh before trying again.");
   const rows=await response.json() as Grant[];setGrants(rows);
   if(!rows.some((row)=>row.id===id && row.revoked_at))throw new Error("Revocation was sent, but the exact grant still appears active. Refresh before trying again.");
   setNotice("Grant revocation confirmed in current access.");}
  catch(e){setError(e instanceof Error?e.message:"Grant revocation denied");}finally{setBusy(false);}}
 return <div className="contact-management">
  <div className="contact-context-heading"><p className="enterprise-eyebrow">Published contact management</p><h2>{kind==="SITE_SERVICE"?"Site Service":kind.toLowerCase()} contacts</h2><p>Exact context: {contextId}</p><p>Publishing creates a reviewed version for this context. Current contact access is checked separately for each viewer.</p></div>
  {error&&<p role="alert" className="enterprise-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <button type="button" onClick={()=>void reload()} disabled={busy}>Refresh context</button>
  {current&&<section><h2>Current operational projection</h2><p>Operations can read current published routes within its accepted scope. Historical values and publication controls are restricted.</p>
   <div className="contact-cards">{current.map((r)=><article className="contact-card" key={r.id}><h3>{label(r.purpose)} · {r.priority===1?"Primary":"Backup"}</h3>
    <p>{r.state==="CURRENT"?r.display_name:r.state}</p>{r.state==="CURRENT"&&<p>{r.phone} {r.email}</p>}</article>)}</div></section>}
  {managed&&<><section><h2>Published routes <small>{managed.length}</small></h2><p>Review purpose, priority, source health and effective time before correcting or republishing.</p><div className="contact-cards">{managed.map((r)=><article className="contact-card" key={r.id}>
   <p className="enterprise-eyebrow">{label(r.purpose)} · {r.priority===1?"Primary contact":`Backup ${r.priority-1}`}</p><h3>{r.display_name}</h3>
   <p>{r.role_organisation}</p><p>Source: {r.source_type}{r.source_id?` · ${r.source_id}`:""} · {r.source_health} · {r.state}</p>
   {r.phone||r.email?<p>Published telephone: {r.phone??"Not published"} · email: {r.email??"Not published"}</p>
    :<p>Phone and email are restricted to the audited history read.</p>}
   {r.manual_origin&&<p>Controlled origin: {r.manual_origin} · accountable manager: {r.accountable_manager_id}</p>}
   <p>Current version: {r.current_version_id} · revision {r.revision}</p><p>Effective: {date(r.effective_from)} to {date(r.effective_until)}</p>
   <p>Daily London applicability: {r.london_start&&r.london_end?`${r.london_start}–${r.london_end}`:"All day"} · Reviewed: {r.reviewed_on}</p><div className="contact-toolbar"><button type="button" onClick={()=>select(r)} disabled={busy||r.state==="REVOKED"}>Correct / republish</button>
    <button type="button" onClick={()=>select(r,"REORDERED")} disabled={busy||r.state==="REVOKED"}>Reorder</button>
    <button type="button" onClick={()=>select(r,"REVIEWED")} disabled={busy||r.state==="REVOKED"}>Review</button>
    <button type="button" onClick={()=>void act("revoke",r)} disabled={busy||r.state==="REVOKED"}>Revoke</button>
    <button type="button" onClick={()=>void act("expire",r)} disabled={busy||r.state==="REVOKED"}>Record expiry if due</button></div>
   <button type="button" onClick={()=>void readHistory(r)} disabled={busy}>Read restricted history</button>
  </article>)}</div><label>Reason for privileged history read<input value={historyReason} maxLength={300} onChange={(e)=>setHistoryReason(e.target.value)} /></label>
  {history&&<div className="contact-history" role="region" aria-label="Restricted contact history"><h3>Restricted immutable history</h3><p>Exact route: <code>{history.routeId}</code>. This access is recorded with your reason.</p>
   <h4>Attributed events</h4><ol className="contact-history-list">{history.data.events.map((event)=><li key={event.id}><strong>{label(event.action)}</strong><span>{date(event.occurred_at)} · actor <code>{event.actor_person_id}</code></span>{event.reason&&<p>Reason: {event.reason}</p>}{event.new_version_id&&<p>New version: <code>{event.new_version_id}</code></p>}</li>)}</ol>
   <h4>Published versions</h4><ol className="contact-history-list">{history.data.versions.map((version)=><li key={version.id}><strong>Version {version.version} · {version.display_name}</strong><span>{version.role_organisation} · priority {version.priority}</span><p>Effective: {date(version.effective_from)} to {date(version.effective_until)} · reviewed {version.reviewed_on}</p><p>Published telephone: {version.phone??"Not published"} · email: {version.email??"Not published"}</p><p>Version ID: <code>{version.id}</code></p></li>)}</ol>
  </div>}</section>
  <section id="contact-editor" className="contact-editor"><h2>{draft.route_id?"Correct or republish route":"Publish new route"}</h2>
   <p>Staff will see only the previewed fields below. A source change after preview blocks publication.</p>
   <div className="contact-form-grid"><label>Purpose<select value={draft.purpose} disabled={!!draft.route_id} onChange={(e)=>change("purpose",e.target.value)}>{purposes.map((p)=><option key={p} value={p}>{label(p)}</option>)}</select></label>
   <label>Source type<select value={draft.source_type} disabled={!!draft.route_id} onChange={(e)=>change("source_type",e.target.value)}><option value="MANUAL_OPERATIONAL">Manual operational</option><option value="CRM_CONTACT">Exact CRM Contact</option><option value="KSS_PERSON">Exact KSS Person</option></select></label>
   {draft.source_type!=="MANUAL_OPERATIONAL"?<><label>Exact source ID<input value={draft.source_id} disabled={!!draft.route_id} onChange={(e)=>change("source_id",e.target.value)} /></label>
    <label><input type="checkbox" checked={draft.use_phone} onChange={(e)=>change("use_phone",e.target.checked)} /> Publish source telephone</label>
    <label><input type="checkbox" checked={draft.use_email} onChange={(e)=>change("use_email",e.target.checked)} /> Publish source email</label></>:<>
    <label>Display name<input value={draft.display_name} onChange={(e)=>change("display_name",e.target.value)} /></label>
    <label>Approved telephone<input value={draft.phone} onChange={(e)=>change("phone",e.target.value)} /></label>
    <label>Approved email<input value={draft.email} onChange={(e)=>change("email",e.target.value)} /></label>
    <label>Controlled origin<input value={draft.manual_origin} disabled={!!draft.route_id} onChange={(e)=>change("manual_origin",e.target.value)} /></label>
    <label>Accountable Contact Manager Person ID<input value={draft.accountable_manager_id} disabled={!!draft.route_id} onChange={(e)=>change("accountable_manager_id",e.target.value)} /></label></>}
   {draft.source_type!=="CRM_CONTACT"&&<label>Role / organisation<input value={draft.role_organisation} onChange={(e)=>change("role_organisation",e.target.value)} /></label>}
   <label>Priority (1 primary, 2+ backup)<input type="number" min="1" max="20" value={draft.priority} onChange={(e)=>change("priority",e.target.value)} /></label>
   <label>Effective from (ISO with offset)<input placeholder="2026-09-24T20:00:00+01:00" value={draft.effective_from} onChange={(e)=>change("effective_from",e.target.value)} /></label>
   <label>Effective until / expiry (ISO with offset)<input placeholder="2026-10-01T20:00:00+01:00" value={draft.effective_until} onChange={(e)=>change("effective_until",e.target.value)} /></label>
   <label>Daily London start (optional)<input type="time" value={draft.london_start} onChange={(e)=>change("london_start",e.target.value)} /></label>
   <label>Daily London end (optional)<input type="time" value={draft.london_end} onChange={(e)=>change("london_end",e.target.value)} /></label>
   <label>Reviewed on<input type="date" value={draft.reviewed_on} onChange={(e)=>change("reviewed_on",e.target.value)} /></label>
   <label>Controlled reason<textarea value={draft.reason} maxLength={300} onChange={(e)=>change("reason",e.target.value)} /></label></div>
   <div className="contact-toolbar"><button type="button" onClick={()=>void makePreview()} disabled={busy}>Preview exact Staff view</button>
    {draft.route_id&&<button type="button" onClick={()=>{setDraft(initial(kind,contextId));setPreview(null);}}>Start new route</button>}</div>
   {preview&&<div className="contact-preview" role="region" aria-label="Exact Staff-visible preview"><h3>Staff-visible preview · {preview.context_kind.replace("_"," ")} {preview.context_id}</h3>
    <p>{label(preview.purpose)} · {Number(preview.priority)===1?"Primary":`Backup ${Number(preview.priority)-1}`}</p><strong>{preview.display_name}</strong>
    <p>{preview.role_organisation}</p><p>Telephone: {preview.phone??"Not published"}</p><p>Email: {preview.email??"Not published"}</p>
    <p>Applicable: {date(preview.effective_from)} to {date(preview.effective_until)} · Reviewed {preview.reviewed_on}</p>
    <button type="button" onClick={()=>void publish()} disabled={busy}>Publish this reviewed snapshot</button></div>}
  </section></>}
  {isSuper&&<section className="contact-editor"><h2>Exact-context Contact Manager grants</h2><p>Office Admin role alone grants no contact publication authority.</p>
   <div className="contact-form-grid"><label>Office Admin Person ID<input value={grantPerson} onChange={(e)=>setGrantPerson(e.target.value)} /></label>
    <label>Grant starts (ISO with offset)<input value={grantFrom} onChange={(e)=>setGrantFrom(e.target.value)} /></label>
    <label>Grant ends (ISO with offset)<input value={grantUntil} onChange={(e)=>setGrantUntil(e.target.value)} /></label>
    <label>Controlled reason<input value={grantReason} onChange={(e)=>setGrantReason(e.target.value)} /></label></div>
   <button type="button" onClick={()=>void issueGrant()} disabled={busy}>Issue finite grant</button>
   <ul>{grants.map((g)=><li key={g.id}>{g.person_name} · {date(g.valid_from)} to {date(g.valid_until)} · {g.revoked_at?"Revoked":"Active unless expired"}
    {!g.revoked_at&&<button type="button" onClick={()=>void revokeGrant(g.id)} disabled={busy}>Revoke grant</button>}</li>)}</ul>
  </section>}
 </div>;
}
