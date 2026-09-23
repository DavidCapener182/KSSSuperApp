"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Row = Record<string, unknown>;
type Props = { view: "overview" | "organisations" | "contacts" | "opportunities" | "organisation" | "opportunity"; id?: string; currentPersonId: string };
const stageNames = ["NEW_LEAD","CONTACTED","QUALIFIED","PROPOSAL_TENDER","NEGOTIATION","WON","LOST"];
const typeNames = ["TENDER","DIRECT_ENQUIRY","EXISTING_CLIENT_EXPANSION","RENEWAL","PROSPECTING"];
const title = (value: unknown) => String(value ?? "").replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
const value = (pence: unknown) => pence == null ? "Not estimated" : new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(Number(pence)/100);
const date = (raw: unknown) => raw ? new Date(String(raw)).toLocaleString("en-GB") : "—";

export function CrmClient({ view, id, currentPersonId }: Props) {
  const router = useRouter();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [owners, setOwners] = useState<{id:string; displayName:string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [form, setForm] = useState("");
  const previousFocus = useRef<HTMLElement | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [stage, setStage] = useState("");
  const [confirm, setConfirm] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    const qs = new URLSearchParams({view, offset:String(offset)});
    if (id) qs.set("id", id);
    if (search) qs.set("search",search);
    if (filter) qs.set(view === "organisations" ? "status" : "stage",filter);
    try {
      const response = await fetch(`/api/crm?${qs}`,{cache:"no-store"});
      if (!response.ok) throw Error("CRM is temporarily unavailable.");
      setData(await response.json());
    } catch (caught) { setError(caught instanceof Error ? caught.message : "CRM is temporarily unavailable."); }
    finally { setLoading(false); }
  },[view,id,offset,search,filter]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); },[load]);
  useEffect(() => {
    Promise.all(["OFFICE_ADMIN","SUPER_ADMIN"].map((role)=>fetch(`/api/people?role=${role}&limit=50`,{cache:"no-store"}).then((r)=>r.ok?r.json():null)))
      .then((lists)=>{ const found = new Map<string,{id:string;displayName:string}>();
        for (const list of lists) for (const item of (list?.items ?? []) as Row[]) found.set(String(item.id),{id:String(item.id),displayName:String(item.displayName)});
        setOwners([...found.values()]); }).catch(()=>{});
  },[]);
  useEffect(() => {
    if (!form) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(() => document.querySelector<HTMLElement>(".crm-dialog input, .crm-dialog select")?.focus(), 0);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setForm(""); setFields({}); previousFocus.current?.focus(); }
      if (event.key === "Tab") {
        const controls = [...document.querySelectorAll<HTMLElement>(".crm-dialog button:not(:disabled), .crm-dialog input:not(:disabled), .crm-dialog select:not(:disabled)")];
        if (!controls.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { window.clearTimeout(timer); document.removeEventListener("keydown", onKey); };
  },[form]);
  const rows = (key:string): Row[] => Array.isArray(data?.[key]) ? data[key] as Row[] : [];
  const field = (key:string, label:string, required=false, kind="text") => <label className="crm-field">{label}
    <Input type={kind} required={required} value={fields[key] ?? ""} onChange={(event)=>setFields({...fields,[key]:event.target.value})} /></label>;
  const choose = (key:string,label:string,options:{value:string;label:string}[],required=false) => <label className="crm-field">{label}<select required={required} value={fields[key] ?? ""} onChange={(event)=>setFields({...fields,[key]:event.target.value})}>
    <option value="">Select</option>{options.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
  async function act(action:string, extra:Record<string, unknown>) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/crm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...extra})});
      const result = await response.json();
      if (!response.ok) throw Error(result.detail ?? result.error ?? "Action denied");
      setForm(""); setFields({}); setReason(""); setStage(""); setConfirm(false);
      if (action === "createOrganisation") router.push(`/crm/organisations/${result.id}`);
      else if (action === "createOpportunity") router.push(`/crm/opportunities/${result.id}`);
      else await load();
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Action denied"); }
    finally { setBusy(false); }
  }
  const ownerOptions = owners.map((o)=>({value:o.id,label:o.displayName}));
  const personName = (personId:unknown) => personId ? owners.find((o)=>o.id===personId)?.displayName ?? "Authorised Office actor" : "Unassigned";
  const org = data?.organisation as Row | undefined;
  const opportunity = data?.opportunity as Row | undefined;
  const backwards = !!opportunity && stageNames.indexOf(stage)>=0 && stageNames.indexOf(stage)<stageNames.indexOf(String(opportunity.stage));
  const openOrganisationEdit = () => { if (!org) return; setFields({name:String(org.name),tradingName:String(org.trading_name ?? ""),website:String(org.website ?? ""),email:String(org.general_email ?? ""),phone:String(org.main_phone ?? ""),ownerId:String(org.owner_person_id ?? "")}); setForm("editOrganisation"); };
  const openContactEdit = (contact:Row) => { setFields({contactId:String(contact.id),firstName:String(contact.first_name),lastName:String(contact.last_name),jobTitle:String(contact.job_title ?? ""),email:String(contact.business_email ?? ""),phone:String(contact.business_phone ?? ""),primary:contact.is_primary?"yes":"no",active:contact.active?"yes":"no"}); setForm("editContact"); };
  return <main className="enterprise-main crm-page">
    <p className="eyebrow">Commercial workspace · synthetic development data</p>
    <div className="crm-heading"><div><h1>{view === "organisation" ? String(org?.name ?? "Organisation") : view === "opportunity" ? String(opportunity?.title ?? "Opportunity") : "CRM"}</h1>
      <p className="enterprise-intro">{view === "overview" ? "Organisations, business contacts and opportunities in one place." : "Commercial records remain separate from private Staff information."}</p></div></div>
    <nav className="crm-tabs" aria-label="CRM sections">
      {[["overview","Overview"],["organisations","Organisations"],["contacts","Contacts"],["opportunities","Opportunities"]].map(([key,label])=><Link key={key} href={key==="overview"?"/crm":`/crm?view=${key}`} aria-current={view===key||(view==="organisation"&&key==="organisations")||(view==="opportunity"&&key==="opportunities")?"page":undefined}>{label}</Link>)}
    </nav>
    {error && <p role="alert" className="enterprise-error">{error} <button type="button" onClick={()=>void load()}>Retry</button></p>}
    {loading ? <div className="crm-skeleton" role="status">Loading CRM…</div> : null}
    {!loading && data && view==="overview" && <><div className="crm-stat-grid">
      {([["open","Open opportunities"],["newLeads","New leads"],["proposals","Proposal / Tender"],["won","Won"],["lost","Lost"]] as const).map(([key,label])=><section className="crm-stat" key={key}><span>{label}</span><strong>{String(data[key] ?? 0)}</strong></section>)}
      </div><p className="enterprise-honesty">Opportunity stages describe sales progress. Won does not establish a signed contract or active service.</p>
      <div className="crm-actions"><Link href="/crm?view=organisations">Browse Organisations</Link><Link href="/crm?view=opportunities">Browse Opportunities</Link></div></>}
    {!loading && data && ["organisations","contacts","opportunities"].includes(view) && <>
      <form className="crm-filters" onSubmit={(event)=>{event.preventDefault();setOffset(0);setSearch(fields.search ?? "");setFilter(fields.filter ?? "");}}>
        <label>Search<Input placeholder={view==="contacts"?"Contact name or email":"Name or title"} value={fields.search ?? ""} onChange={(e)=>setFields({...fields,search:e.target.value})}/></label>
        {view!=="contacts" && <label>{view==="organisations"?"Relationship":"Stage"}<select value={fields.filter ?? ""} onChange={(e)=>setFields({...fields,filter:e.target.value})}><option value="">All</option>{(view==="organisations"?["PROSPECT","CLIENT","FORMER_CLIENT","PARTNER"]:stageNames).map((s)=><option value={s} key={s}>{title(s)}</option>)}</select></label>}
        <Button type="submit">Apply</Button>
      </form>
      <div className="crm-list-heading"><h2>{title(view)}</h2><span>{String(data.total ?? 0)} records</span>
        {view==="organisations" && <Button onClick={()=>setForm("organisation")}>New Organisation</Button>}</div>
      {rows("items").length===0?<p className="crm-empty">No matching records. Try a different search or create an Organisation.</p>:<div className="crm-list">
        <div className="crm-list-head" aria-hidden="true"><span>{view==="organisations"?"Organisation":view==="contacts"?"Contact":"Opportunity"}</span><span>{view==="organisations"?"Relationship":view==="contacts"?"Organisation":"Stage · Organisation"}</span><span>{view==="organisations"?"Primary Contact · open work":view==="contacts"?"Job title":"Estimated value"}</span></div>
        {rows("items").map((row)=><Link className="crm-row" key={String(row.id)} href={view==="organisations"?`/crm/organisations/${row.id}`:view==="opportunities"?`/crm/opportunities/${row.id}`:`/crm/organisations/${row.organisation_id}`}>
          <strong>{view==="organisations"?String(row.name):view==="contacts"?`${row.first_name} ${row.last_name}`:String(row.title)}</strong>
          <span>{view==="organisations"?title(row.relationship_status):view==="contacts"?String((row.crm_organisations as Row)?.name ?? ""):`${title(row.stage)} · ${String((row.crm_organisations as Row)?.name ?? "")}`}</span>
          <span>{view==="opportunities"?value(row.estimated_value_gbp_pence):view==="contacts"?String(row.job_title ?? ""):`${String(row.primaryContactName ?? "No primary Contact")} · ${String(row.openOpportunityCount ?? 0)} open`}</span>
        </Link>)}
      </div>}
      <div className="people-pagination">{offset>0&&<Button variant="outline" onClick={()=>setOffset(Math.max(0,offset-25))}>Previous</Button>}
        <span>Showing {rows("items").length?offset+1:0}–{offset+rows("items").length} of {String(data.total ?? 0)}</span>
        {offset+25<Number(data.total)&&<Button variant="outline" onClick={()=>setOffset(offset+25)}>Next</Button>}</div>
    </>}
    {!loading && org && view==="organisation" && <>
      <div className="crm-record-summary"><span className="crm-state">{title(org.relationship_status)}</span><span>Account owner: {owners.find((o)=>o.id===org.owner_person_id)?.displayName ?? "Assigned Office"}</span><span>Created {date(org.created_at)}</span></div>
      <div className="crm-detail-grid"><section className="crm-panel"><div className="crm-panel-heading"><h2>Overview</h2><Button variant="outline" onClick={openOrganisationEdit}>Edit</Button></div>
        <dl><div><dt>Trading name</dt><dd>{String(org.trading_name ?? "—")}</dd></div><div><dt>Website</dt><dd>{String(org.website ?? "—")}</dd></div><div><dt>General email</dt><dd>{String(org.general_email ?? "—")}</dd></div><div><dt>Main phone</dt><dd>{String(org.main_phone ?? "—")}</dd></div></dl>
      </section><section className="crm-panel"><div className="crm-panel-heading"><h2>Contacts</h2><Button variant="outline" onClick={()=>setForm("contact")}>Add Contact</Button></div>
        {rows("contacts").length?rows("contacts").map((contact)=><div className="crm-subrow" key={String(contact.id)}><strong>{String(contact.first_name)} {String(contact.last_name)}</strong><span>{String(contact.job_title ?? "")}</span><span>{contact.is_primary?"Primary contact":contact.active?"Active":"Inactive"}</span><small>{String(contact.business_email ?? "")}</small><Button variant="ghost" onClick={()=>openContactEdit(contact)}>Edit</Button></div>):<p>No Contacts yet.</p>}
      </section><section className="crm-panel"><div className="crm-panel-heading"><h2>Opportunities</h2><Button variant="outline" onClick={()=>setForm("opportunity")}>New Opportunity</Button></div>
        {rows("opportunities").length?rows("opportunities").map((item)=><Link className="crm-subrow" key={String(item.id)} href={`/crm/opportunities/${item.id}`}><strong>{String(item.title)}</strong><span>{title(item.stage)}</span><span>{value(item.estimated_value_gbp_pence)}</span></Link>):<p>No Opportunities yet.</p>}
      </section><section className="crm-panel"><h2>Relationship history</h2>{rows("history").length?rows("history").map((item)=><p key={String(item.id)}>{title(item.old_status)} → {title(item.new_status)} · {date(item.occurred_at)} · by {personName(item.actor_person_id)}</p>):<p>No relationship transition yet.</p>}
        {rows("ownerHistory").map((item)=><p key={String(item.id)}>Account owner: {personName(item.old_owner_person_id)} → {personName(item.new_owner_person_id)} · {date(item.occurred_at)} · by {personName(item.actor_person_id)}</p>)}</section></div>
      <p className="enterprise-honesty">Sites, Events and commercial Documents are not connected in this CRM foundation.</p>
    </>}
    {!loading && opportunity && view==="opportunity" && <>
      <div className="crm-record-summary"><span className="crm-state">{title(opportunity.stage)}</span><Link href={`/crm/organisations/${opportunity.organisation_id}`}>{String((data?.organisation as Row)?.name ?? "Organisation")}</Link><span>{title(opportunity.opportunity_type)}</span></div>
      <div className="crm-detail-grid"><section className="crm-panel"><h2>Opportunity</h2><dl>
        <div><dt>Estimated opportunity value</dt><dd>{value(opportunity.estimated_value_gbp_pence)}</dd></div>
        <div><dt>Expected decision</dt><dd>{String(opportunity.expected_decision_date ?? "Not set")}</dd></div>
        <div><dt>Owner</dt><dd>{owners.find((o)=>o.id===opportunity.owner_person_id)?.displayName ?? "Assigned Office"}</dd></div>
        <div><dt>Primary Contact</dt><dd>{data?.contact?`${String((data.contact as Row).first_name)} ${String((data.contact as Row).last_name)}`:"Not selected"}</dd></div>
        <div><dt>Summary</dt><dd>{String(opportunity.summary ?? "No summary")}</dd></div>
      </dl></section><section className="crm-panel"><h2>Stage and ownership</h2>{!["WON","LOST"].includes(String(opportunity.stage)) ? <>
        <label className="crm-field">Move to stage<select value={stage} onChange={(e)=>setStage(e.target.value)}><option value="">Select stage</option>{stageNames.filter((s)=>s!==opportunity.stage).map((s)=><option key={s} value={s}>{title(s)}</option>)}</select></label>
        {(stage==="LOST"||backwards)&&<label className="crm-field">{stage==="LOST"?"Lost reason":"Reason for moving backwards"}<Input required value={reason} maxLength={500} onChange={(e)=>setReason(e.target.value)}/></label>}
        {stage==="WON"&&<label className="crm-confirm"><input type="checkbox" checked={confirm} onChange={(e)=>setConfirm(e.target.checked)}/> I confirm this opportunity is Won. This does not establish a contract or active service.</label>}
        <Button disabled={busy||!stage||(stage==="WON"&&!confirm)||((stage==="LOST"||backwards)&&reason.trim().length<3)} onClick={()=>void act("transition",{id:opportunity.id,stage,reason})}>Record stage change</Button>
        <label className="crm-field">Change accountable owner<select value={fields.ownerId ?? ""} onChange={(e)=>setFields({...fields,ownerId:e.target.value})}><option value="">Select owner</option>{ownerOptions.map((x)=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
        <Button variant="outline" disabled={busy||!fields.ownerId} onClick={()=>void act("changeOwner",{id:opportunity.id,ownerId:fields.ownerId})}>Change owner</Button>
        <label className="crm-field">Estimated value (£)<Input type="number" min="0" step="0.01" value={fields.value ?? ""} onChange={(e)=>setFields({...fields,value:e.target.value})}/></label>
        <Button variant="outline" disabled={busy} onClick={()=>void act("changeValue",{id:opportunity.id,valuePence:fields.value===""?null:Math.round(Number(fields.value)*100)})}>Update estimate</Button>
      </>:<><p><strong>{title(opportunity.stage)} recorded</strong></p><p>This outcome is terminal in 05A. The record and its history remain available; corrections require a future approved process.</p></>}</section>
      <section className="crm-panel"><h2>Commercial history</h2>{rows("history").length?rows("history").map((event)=><p key={String(event.id)}>{title(event.kind)} · {event.kind==="STAGE"?`${title(event.old_stage)} → ${title(event.new_stage)}`:event.kind==="OWNER"?`${personName(event.old_owner_person_id)} → ${personName(event.new_owner_person_id)}`:`${value(event.old_value_gbp_pence)} → ${value(event.new_value_gbp_pence)}`} · {date(event.occurred_at)} · by {personName(event.actor_person_id)}{event.reason?` · ${event.reason}`:""}</p>):<p>No changes yet.</p>}</section></div>
      <p className="enterprise-honesty">Estimated value is not contracted or invoiced revenue.</p>
    </>}
    {form && <div className="crm-dialog-backdrop" role="presentation"><section className="crm-dialog" role="dialog" aria-modal="true" aria-labelledby="crm-dialog-title">
      <div className="crm-panel-heading"><h2 id="crm-dialog-title">{form==="organisation"?"New Organisation":form==="editOrganisation"?"Edit Organisation":form==="contact"?"Add Contact":form==="editContact"?"Edit Contact":"New Opportunity"}</h2><Button variant="ghost" onClick={()=>{setForm("");setFields({});}}>Close</Button></div>
      <form onSubmit={(e)=>{e.preventDefault(); if(form==="organisation"||form==="editOrganisation") void act(form==="organisation"?"createOrganisation":"updateOrganisation",{id,name:fields.name,tradingName:fields.tradingName,website:fields.website,email:fields.email,phone:fields.phone,ownerId:fields.ownerId||currentPersonId});
        if(form==="contact"||form==="editContact") void act(form==="contact"?"createContact":"updateContact",{id:fields.contactId,organisationId:id,firstName:fields.firstName,lastName:fields.lastName,jobTitle:fields.jobTitle,email:fields.email,phone:fields.phone,primary:fields.primary==="yes",active:fields.active!=="no",duplicateConfirmed:fields.duplicateConfirmed==="yes"});
        if(form==="opportunity") void act("createOpportunity",{organisationId:id,title:fields.title,type:fields.type,ownerId:fields.ownerId||currentPersonId,contactId:fields.contactId||null,valuePence:fields.value?Math.round(Number(fields.value)*100):null,decisionDate:fields.decisionDate||null,summary:fields.summary||null});}}>
        {(form==="organisation"||form==="editOrganisation")&&<>{field("name","Organisation name",true)}{field("tradingName","Trading name")}{field("website","Website")}{field("email","General email",false,"email")}{field("phone","Main phone")}{choose("ownerId","Account owner",ownerOptions)}</>}
        {(form==="contact"||form==="editContact")&&<>{field("firstName","First name",true)}{field("lastName","Surname",true)}{field("jobTitle","Job title")}{field("email","Business email",false,"email")}{field("phone","Business phone")}{choose("primary","Primary Contact?",[{value:"yes",label:"Yes"},{value:"no",label:"No"}])}{form==="editContact"&&choose("active","Status",[{value:"yes",label:"Active"},{value:"no",label:"Inactive"}])}{!fields.email&&choose("duplicateConfirmed","I checked for a same-name Contact",[{value:"yes",label:"Checked — create if name matches"},{value:"no",label:"Not yet"}])}</>}
        {form==="opportunity"&&<>{field("title","Opportunity title",true)}{choose("type","Type",typeNames.map((x)=>({value:x,label:title(x)})),true)}{choose("contactId","Primary Contact",rows("contacts").filter((x)=>x.active).map((x)=>({value:String(x.id),label:`${x.first_name} ${x.last_name}`})))}{choose("ownerId","Owner",ownerOptions)}{field("value","Estimated value (£)",false,"number")}{field("decisionDate","Expected decision date",false,"date")}{field("summary","Short summary")}</>}
        <div className="crm-dialog-actions"><Button type="button" variant="outline" onClick={()=>setForm("")}>Cancel</Button><Button type="submit" disabled={busy}>{busy?"Saving…":"Save"}</Button></div>
      </form>
    </section></div>}
  </main>;
}
