"use client";
import { useState } from "react";
import Link from "next/link";
type Grant={id:string;personId:string;personName:string;permission:string;effectiveFrom:string;effectiveUntil:string|null;revokedAt:string|null;reason:string};
type Workspace={id:string;organisationId:string;name:string;status:string;grants:Grant[]};
type Choice={id:string;name:string};
export function WorkspaceAccessAdmin({registry,choices}:{registry:Workspace[];choices:{organisations:Choice[];people:Choice[]}}) {
 const [items,setItems]=useState(registry); const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);
 async function submit(data:Record<string,string>) {
  setBusy(true);setMessage("Saving and reading back…");
  try {const res=await fetch("/api/client-workspaces/manage",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)});
   const body=await res.json();if(!res.ok||!Array.isArray(body.registry)){setMessage(body.error||"Change not confirmed");return;}
   setItems(body.registry);setMessage("Server confirmed the change.");
  } catch {setMessage("Connection failed. No change was confirmed.");} finally {setBusy(false);}
 }
 return <><p role="status" aria-live="polite">{message}</p><section className="cw-panel"><h2>Create workspace</h2><p>Only existing CRM Organisations with Client status can be selected.</p><form className="cw-form" action={form=>submit({action:"create",organisationId:String(form.get("organisationId")),reason:String(form.get("reason"))})}><label>Client Organisation<select name="organisationId" required><option value="">Choose Client</option>{choices.organisations.filter(o=>!items.some(w=>w.organisationId===o.id)).map(o=><option value={o.id} key={o.id}>{o.name}</option>)}</select></label><label>Reason<input name="reason" minLength={10} maxLength={500} required/></label><div className="cw-span"><button className="cw-primary" disabled={busy}>Create exact workspace</button></div></form></section>
 {items.map(w=><section className="cw-panel cw-history" key={w.id}><h2>{w.name}</h2><p><Link href={`/client-workspaces/${w.id}`}>Open workspace if granted →</Link></p><h3>Loss Prevention grants</h3><ul>{w.grants.map(g=><li key={g.id}><strong>{g.personName}</strong> · {g.permission} · {g.revokedAt?"Revoked":g.effectiveUntil&&Date.parse(g.effectiveUntil)<=Date.now()?"Expired":"Current"} {g.revokedAt?null:<form className="cw-inline-revoke" action={form=>submit({action:"revoke",grantId:g.id,reason:String(form.get("reason"))})}><label>Revocation reason<input name="reason" required minLength={10} maxLength={500}/></label><button disabled={busy}>Revoke</button></form>}</li>)}</ul><h3>Grant exact access</h3><form className="cw-form" action={form=>submit({action:"grant",workspaceId:w.id,personId:String(form.get("personId")),permission:String(form.get("permission")),reason:String(form.get("reason"))})}><label>Person<select name="personId" required><option value="">Choose Person</option>{choices.people.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label><label>Permission<select name="permission"><option>VIEW</option><option>OPERATE</option><option>MANAGE</option></select></label><label className="cw-span">Reason<input name="reason" required minLength={10} maxLength={500}/></label><div className="cw-span"><button className="cw-primary" disabled={busy}>Grant Loss Prevention access</button></div></form></section>)}</>;
}
