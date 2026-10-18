"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./workspace-access-admin.module.css";
type Grant={id:string;personId:string;personName:string;permission:string;effectiveFrom:string;effectiveUntil:string|null;revokedAt:string|null;reason:string};
type Workspace={id:string;organisationId:string;name:string;status:string;creationReason?:string;grants:Grant[]};
type Choice={id:string;name:string};
type Draft=Record<string,string>;
const validId=(value:unknown):value is string=>typeof value==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const validDate=(value:unknown)=>typeof value==="string"&&Number.isFinite(Date.parse(value));
function isRegistry(value:unknown):value is Workspace[] {
 if(!Array.isArray(value))return false;
 const workspaceIds=new Set<string>();const grantIds=new Set<string>();
 return value.every(w=>{
  if(!w||!validId(w.id)||workspaceIds.has(w.id)||!validId(w.organisationId)||typeof w.name!=="string"||typeof w.status!=="string"||!Array.isArray(w.grants))return false;
  workspaceIds.add(w.id);
  return w.grants.every((g:Grant)=>{
   if(!g||!validId(g.id)||grantIds.has(g.id)||!validId(g.personId)||typeof g.personName!=="string"||!["VIEW","OPERATE","MANAGE"].includes(g.permission)||!validDate(g.effectiveFrom)||(g.effectiveUntil!==null&&!validDate(g.effectiveUntil))||(g.revokedAt!==null&&!validDate(g.revokedAt))||typeof g.reason!=="string")return false;
   grantIds.add(g.id);return true;
  });
 });
}
function confirms(before:Workspace[],after:Workspace[],data:Draft){
 if(data.action==="create")return !before.some(w=>w.organisationId===data.organisationId)&&after.some(w=>w.organisationId===data.organisationId&&w.status==="ACTIVE"&&w.creationReason===data.reason);
 const target=before.find(w=>data.action==="grant"?w.id===data.workspaceId:w.grants.some(g=>g.id===data.grantId));
 const current=after.find(w=>w.id===target?.id&&w.organisationId===target.organisationId);
 if(!target||!current)return false;
 if(data.action==="grant")return current.status==="ACTIVE"&&current.grants.some(g=>!target.grants.some(old=>old.id===g.id)&&g.personId===data.personId&&g.permission===data.permission&&g.reason===data.reason&&g.revokedAt===null&&Date.parse(g.effectiveFrom)<=Date.now()&&g.effectiveUntil===null);
 const old=target.grants.find(g=>g.id===data.grantId);
 return !!old&&old.revokedAt===null&&current.grants.some(g=>g.id===old.id&&g.personId===old.personId&&g.permission===old.permission&&g.revokedAt!==null);
}
const scope=(g:Grant)=>g.revokedAt?"Revoked":Date.parse(g.effectiveFrom)>Date.now()?"Not yet effective":g.effectiveUntil&&Date.parse(g.effectiveUntil)<=Date.now()?"Expired":"Current";
const displayDate=(value:string)=>new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/London"}).format(new Date(value));
export function WorkspaceAccessAdmin({registry,choices}:{registry:Workspace[];choices:{organisations:Choice[];people:Choice[]}}) {
 const [items,setItems]=useState(registry);const [selectedId,setSelectedId]=useState(registry[0]?.id??"");
 const [mode,setMode]=useState<"create"|"grant"|"revoke"|null>(null);const [grantId,setGrantId]=useState("");
 const [draft,setDraft]=useState<Draft|null>(null);const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const [unavailable,setUnavailable]=useState(false);
 const lifetime=useRef(true);const pending=useRef(false);const actionHeading=useRef<HTMLHeadingElement>(null);const opener=useRef<HTMLButtonElement|null>(null);
 useEffect(()=>{lifetime.current=true;return ()=>{lifetime.current=false;};},[]);
 useEffect(()=>{if(mode)actionHeading.current?.focus();else opener.current?.focus();},[mode,draft]);
 const workspace=items.find(w=>w.id===selectedId);const grant=workspace?.grants.find(g=>g.id===grantId);
 function open(next:typeof mode,id="",trigger?:HTMLButtonElement){if(pending.current||unavailable)return;if(trigger)opener.current=trigger;setMode(next);setGrantId(id);setDraft(null);setMessage("");}
 function review(form:FormData){
  if(pending.current||unavailable||!mode)return;
  const reason=String(form.get("reason")??"").trim();if(reason.length<10||reason.length>500)return;
  let next:Draft;
  if(mode==="create"){
   const organisationId=String(form.get("organisationId")??"");
   if(!choices.organisations.some(o=>o.id===organisationId)||items.some(w=>w.organisationId===organisationId))return;
   next={action:mode,organisationId,reason};
  }else if(mode==="grant"){
   const personId=String(form.get("personId")??"");const permission=String(form.get("permission")??"");
   if(!workspace||workspace.status!=="ACTIVE"||!choices.people.some(p=>p.id===personId)||!["VIEW","OPERATE","MANAGE"].includes(permission))return;
   next={action:mode,workspaceId:workspace.id,personId,permission,reason};
  }else{
   if(!workspace||!grant||grant.revokedAt)return;
   next={action:mode,grantId:grant.id,reason};
  }
  setDraft(next);
 }
 async function submit(){
  if(pending.current||unavailable||!draft||!lifetime.current)return;
  pending.current=true;setBusy(true);setMessage("Saving and reading the current registry…");const sent=draft;const before=items;
  try{
   const res=await fetch("/api/client-workspaces/manage",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(sent)});
   if(!lifetime.current)return;
   const body=await res.json();if(!lifetime.current)return;
   if(!res.ok||!isRegistry(body.registry)||!confirms(before,body.registry,sent)){
    setItems([]);setUnavailable(true);setDraft(null);setMode(null);setMessage("The requested change is not confirmed. It may have been saved. Reload the current registry before taking another action.");return;
   }
   const current:Workspace[]=body.registry;setItems(current);if(sent.action==="create")setSelectedId(current.find(w=>w.organisationId===sent.organisationId)!.id);
   setDraft(null);setMode(null);setMessage(`Current registry confirms the requested ${sent.action==="create"?"workspace":sent.action==="grant"?"Loss Prevention grant":"revocation"}.`);
  }catch{
   if(!lifetime.current)return;
   setItems([]);setUnavailable(true);setDraft(null);setMode(null);setMessage("The requested change is not confirmed. It may have been saved. Reload the current registry before taking another action.");
  }finally{if(lifetime.current){pending.current=false;setBusy(false);}}
 }
 const organisation=draft&&choices.organisations.find(o=>o.id===draft.organisationId);
 const recipient=draft&&choices.people.find(p=>p.id===draft.personId);
 return <div className={styles.admin}><p role="status" aria-live="polite">{message}</p>{unavailable?<section className={styles.panel}><h2>Current registry unavailable</h2><p>Previous workspace and grant facts have been cleared. A fresh server read is required.</p><form method="get" action="/client-workspaces/manage"><button>Reload current registry</button></form></section>:<>
 <div className={styles.toolbar}><p>{items.length} workspace{items.length===1?"":"s"} · Loss Prevention</p><button disabled={busy} onClick={event=>open("create","",event.currentTarget)}>Create workspace</button></div>
 <div className={styles.layout}><section className={styles.panel} aria-labelledby="registry-heading"><h2 id="registry-heading">Workspace registry</h2><p>Organisation identity stays separate from its name.</p><ul className={styles.registry}>{items.map(w=><li key={w.id}><button aria-pressed={w.id===selectedId} disabled={busy} onClick={()=>{if(pending.current)return;setSelectedId(w.id);setMode(null);setDraft(null);}}><strong>{w.name}</strong><span>{w.status} · {w.grants.filter(g=>scope(g)==="Current").length} current grants</span><small>Organisation {w.organisationId}</small></button></li>)}</ul>{!items.length&&<p>No workspaces in the current registry.</p>}</section>
 <section className={styles.panel} aria-labelledby="workspace-heading">{workspace?<><p className={styles.eyebrow}>Selected workspace · {workspace.status}</p><h2 id="workspace-heading">{workspace.name}</h2><dl className={styles.identity}><div><dt>Workspace</dt><dd>{workspace.id}</dd></div><div><dt>Client Organisation</dt><dd>{workspace.organisationId}</dd></div><div><dt>Module</dt><dd>Loss Prevention</dd></div></dl><Link href={`/client-workspaces/${workspace.id}`}>Open workspace if granted →</Link><div className={styles.sectionHeader}><h3>Loss Prevention grants</h3><button disabled={busy||workspace.status!=="ACTIVE"} onClick={event=>open("grant","",event.currentTarget)}>Grant exact access</button></div><ul className={styles.grants}>{workspace.grants.map(g=><li key={g.id}><div><strong>{g.personName}</strong><p className={styles.exact}>Person {g.personId}</p><p>{g.permission} · Loss Prevention · {scope(g)}</p><p>Effective {displayDate(g.effectiveFrom)}{g.effectiveUntil?` until ${displayDate(g.effectiveUntil)}`:" · no end date recorded"}</p>{g.revokedAt&&<p>Revoked {displayDate(g.revokedAt)}</p>}<p>Grant reason: {g.reason}</p><small className={styles.exact}>Grant {g.id}</small></div>{!g.revokedAt&&<button disabled={busy} aria-label={`Review revocation for ${g.personName}, grant ${g.id}`} onClick={event=>open("revoke",g.id,event.currentTarget)}>Review revocation</button>}</li>)}</ul>{!workspace.grants.length&&<p>No Loss Prevention grants recorded.</p>}</>:<><h2 id="workspace-heading">Select a workspace</h2><p>Review its exact Organisation and module grants.</p></>}</section></div>
 {mode&&<section className={styles.panel} aria-labelledby="action-heading"><h2 id="action-heading" ref={actionHeading} tabIndex={-1}>{mode==="create"?"Create workspace":mode==="grant"?"Grant Loss Prevention access":"Revoke exact grant"}</h2><p>{mode==="create"?"Only existing CRM Organisations with Client status can be selected.":`${workspace?.name} · Workspace ${workspace?.id} · Loss Prevention`}</p>{mode==="revoke"&&grant&&<p>{grant.personName} · Person {grant.personId} · {grant.permission} · Grant {grant.id}</p>}
 {draft?<div className={styles.review}><h3>Review before saving</h3>{organisation&&<p>{organisation.name} · Organisation {organisation.id}</p>}{recipient&&<p>{recipient.name} · Person {recipient.id} · {draft.permission}</p>}<p>Reason: {draft.reason}</p><p>This change applies only to the exact workspace and Loss Prevention scope shown above.</p><div className={styles.actions}><button className="cw-primary" disabled={busy} onClick={()=>void submit()}>Confirm {mode==="create"?"workspace creation":mode==="grant"?"exact grant":"revocation"}</button><button disabled={busy} onClick={()=>setDraft(null)}>Edit details</button></div></div>:<form action={review}><fieldset disabled={busy}><legend className={styles.legend}>Exact scope and required reason</legend><div className={styles.form}>{mode==="create"&&<label>Client Organisation<select name="organisationId" required><option value="">Choose Client Organisation</option>{choices.organisations.filter(o=>!items.some(w=>w.organisationId===o.id)).map(o=><option value={o.id} key={o.id}>{o.name} · {o.id}</option>)}</select></label>}{mode==="grant"&&<><label>Person<select name="personId" required><option value="">Choose exact Person</option>{choices.people.map(p=><option value={p.id} key={p.id}>{p.name} · {p.id}</option>)}</select></label><label>Loss Prevention permission<select name="permission"><option>VIEW</option><option>OPERATE</option><option>MANAGE</option></select></label></>}<label>Reason<textarea name="reason" minLength={10} maxLength={500} required rows={3}/></label><button className="cw-primary" type="submit">Review exact change</button></div></fieldset></form>}<button disabled={busy} onClick={()=>open(null)}>Close action</button></section>}
 </>}</div>;
}
