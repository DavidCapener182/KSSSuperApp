"use client";
import "./record-studies.css";
import { RecordSectionTracker } from "./record-section-tracker";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CrmPipeline, CrmRecordWork } from "@/components/crm-operational";
import { CrmOperationalLinks } from "@/components/crm-operational-links";
import journey from "./commercial-journey.module.css";

type Row = Record<string, unknown>;
type Props = { view: "overview" | "pipeline" | "organisations" | "contacts" | "opportunities" | "organisation" | "opportunity"; id?: string; currentPersonId: string };
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
  const load = useCallback(async (): Promise<Record<string, unknown> | null> => {
    if (view === "pipeline") { setLoading(false); return null; }
    setLoading(true); setError("");
    const qs = new URLSearchParams({view, offset:String(offset)});
    if (id) qs.set("id", id);
    if (search) qs.set("search",search);
    if (filter) qs.set(view === "organisations" ? "status" : "stage",filter);
    try {
      const response = await fetch(`/api/crm?${qs}`,{cache:"no-store"});
      if (!response.ok) throw Error("CRM is temporarily unavailable.");
      const next = await response.json(); setData(next); return next;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "CRM is temporarily unavailable."); return null; }
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
      if (action === "createOrganisation" || action === "createOpportunity") {
        const recordKind = action === "createOrganisation" ? "organisation" : "opportunity";
        const readback = await fetch(`/api/crm?view=${recordKind}&id=${encodeURIComponent(String(result.id))}`, { cache: "no-store" });
        if (!readback.ok) throw Error("The new commercial record could not be confirmed. Refresh before trying again.");
        const confirmed = await readback.json();
        if (confirmed[recordKind]?.id !== result.id) throw Error("The new commercial record could not be confirmed. Refresh before trying again.");
        setForm(""); setFields({});
        router.push(action === "createOrganisation" ? `/crm/organisations/${result.id}` : `/crm/opportunities/${result.id}`);
      } else {
        const confirmed = await load();
        if (!confirmed) throw Error("The server responded, but the commercial record could not be refreshed. Check it before another change.");
        const current = (action === "updateOrganisation" || action === "createContact" || action === "updateContact" ? confirmed.organisation : confirmed.opportunity) as Row | undefined;
        if (action === "transition" && current?.stage !== extra.stage ||
          action === "changeOwner" && current?.owner_person_id !== extra.ownerId ||
          action === "changeValue" && current?.estimated_value_gbp_pence !== extra.valuePence ||
          action === "updateOrganisation" && current?.name !== extra.name ||
          (action === "createContact" || action === "updateContact") &&
            !(confirmed.contacts as Row[] | undefined)?.some((item) => item.id === (action === "createContact" ? result.id : extra.id)))
          throw Error("The commercial change could not be confirmed from its source record. Refresh before another change.");
        setForm(""); setFields({}); setReason(""); setStage(""); setConfirm(false);
        router.refresh();
      }
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
  return <main className={`enterprise-main crm-page ${journey.controls}`}>
    <p className="eyebrow">Commercial workspace · synthetic development data</p>
    {view !== "organisation" && view !== "opportunity" && <div className="crm-heading"><div><h1>CRM</h1>
      <p className="enterprise-intro">{view === "overview" ? "Organisations, business contacts and opportunities in one place." : "Commercial records remain separate from private Staff information."}</p></div></div>}
    {view !== "organisation" && view !== "opportunity" && <nav className="crm-tabs" aria-label="CRM sections">
      {[["overview","Overview"],["pipeline","Pipeline"],["organisations","Organisations"],["contacts","Contacts"],["opportunities","Opportunities"]].map(([key,label])=><Link key={key} href={key==="overview"?"/crm":`/crm?view=${key}`} aria-current={view===key?"page":undefined}>{label}</Link>)}
    </nav>}
    {view==="overview" && <nav className={journey.path} aria-label="Commercial to service journey">
      <span><small>01 · Prospect or Client</small><Link href="/crm?view=organisations">Organisation</Link></span>
      <span><small>02 · Sales opportunity</small><Link href="/crm?view=pipeline">Pipeline and next action</Link></span>
      <span><small>03 · Explicit authorisation</small><Link href="/mobilisations">Mobilisation</Link></span>
      <span><small>04 · Source setup</small><Link href="/sites">Site, Service or Event</Link></span>
    </nav>}
    {view==="pipeline" && <CrmPipeline owners={owners} />}
    {error && <p role="alert" className="enterprise-error">{error} <button type="button" onClick={()=>void load()}>Retry</button></p>}
    {loading ? <div className="crm-skeleton" role="status">Loading CRM…</div> : null}
    {!loading && data && view==="overview" && <><div className="crm-stat-grid">
      {([["open","Open opportunities"],["newLeads","New leads"],["proposals","Proposal / Tender"],["won","Won"],["lost","Lost"]] as const).map(([key,label])=><section className="crm-stat" key={key}><span>{label}</span><strong>{String(data[key] ?? 0)}</strong></section>)}
      </div><p className="enterprise-honesty">Opportunity stages describe sales progress. Won does not establish a signed contract or active service.</p>
      <div className="crm-operational-summary">{([["dueToday","CRM follow-ups due today"],["overdue","Overdue CRM follow-ups"],["noFutureFollowUp","Open Opportunities without a future follow-up"],["decisionsNextSevenDays","Expected decisions in the next 7 days"]] as const)
        .map(([key,label])=><section className="crm-stat" key={key}><span>{label}</span><strong>{String((data.operational as Row)?.[key] ?? 0)}</strong></section>)}</div>
      <div className="crm-actions"><Link href="/crm?view=pipeline">Open pipeline</Link><Link href="/crm?view=organisations">Browse Organisations</Link><Link href="/crm?view=opportunities">Browse Opportunities</Link></div></>}
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
    {!loading && org && view==="organisation" && <div className="crm-organisation-record">
      <Link className="crm-record-back" href="/crm?view=organisations">← Organisations</Link>
      <header className="crm-organisation-header"><h1>{String(org.name)}</h1><div className="crm-record-identity"><span>Organisation</span><strong>{title(org.relationship_status)}</strong></div><p>Account owner: {owners.find((o)=>o.id===org.owner_person_id)?.displayName ?? "Assigned Office"} · Created {date(org.created_at)}</p></header>
      <nav className="crm-organisation-sections" aria-label="Organisation sections"><a href="#organisation-overview">Overview</a><a href="#organisation-contacts">Contacts</a><a href="#organisation-opportunities">Opportunities</a><a href="#organisation-history">History</a><a href="#organisation-work">Work</a><a href="#organisation-sources">Sites and Events</a></nav>
      <RecordSectionTracker label="Organisation sections" />
      <div className="crm-organisation-related"><strong>Related workflows</strong><a href="#organisation-opportunities">Sales opportunities</a>{org.relationship_status==="CLIENT"&&<Link href={`/mobilisations?organisation=${org.id}`}>Authorise mobilisation</Link>}<a href="#organisation-sources">Source records</a></div>
      <div className="crm-organisation-content">
      <div className="crm-detail-grid"><section id="organisation-overview" className="crm-panel"><div className="crm-panel-heading"><h2>Overview</h2><Button variant="outline" onClick={openOrganisationEdit}>Edit</Button></div>
        <dl><div><dt>Trading name</dt><dd>{String(org.trading_name ?? "—")}</dd></div><div><dt>Website</dt><dd>{String(org.website ?? "—")}</dd></div><div><dt>General email</dt><dd>{String(org.general_email ?? "—")}</dd></div><div><dt>Main phone</dt><dd>{String(org.main_phone ?? "—")}</dd></div></dl>
      </section><section id="organisation-contacts" className="crm-panel"><div className="crm-panel-heading"><h2>Contacts</h2><Button variant="outline" onClick={()=>setForm("contact")}>Add Contact</Button></div>
        {rows("contacts").length?rows("contacts").map((contact)=><div className="crm-subrow" key={String(contact.id)}><strong>{String(contact.first_name)} {String(contact.last_name)}</strong><span>{String(contact.job_title ?? "")}</span><span>{contact.is_primary?"Primary contact":contact.active?"Active":"Inactive"}</span><small>{String(contact.business_email ?? "")}</small><Button variant="ghost" onClick={()=>openContactEdit(contact)}>Edit</Button></div>):<p>No Contacts yet.</p>}
      </section><section id="organisation-opportunities" className="crm-panel"><div className="crm-panel-heading"><h2>Opportunities</h2><Button variant="outline" onClick={()=>setForm("opportunity")}>New Opportunity</Button></div>
        {rows("opportunities").length?rows("opportunities").map((item)=><Link className="crm-subrow" key={String(item.id)} href={`/crm/opportunities/${item.id}`}><strong>{String(item.title)}</strong><span>{title(item.stage)}</span><span>{value(item.estimated_value_gbp_pence)}</span></Link>):<p>No Opportunities yet.</p>}
      </section><section id="organisation-history" className="crm-panel"><h2>Relationship history</h2>{rows("history").length?rows("history").map((item)=><p key={String(item.id)}>{title(item.old_status)} → {title(item.new_status)} · {date(item.occurred_at)} · by {personName(item.actor_person_id)}</p>):<p>No relationship transition yet.</p>}
        {rows("ownerHistory").map((item)=><p key={String(item.id)}>Account owner: {personName(item.old_owner_person_id)} → {personName(item.new_owner_person_id)} · {date(item.occurred_at)} · by {personName(item.actor_person_id)}</p>)}</section></div>
      <div id="organisation-work"><CrmRecordWork kind="organisation" id={String(org.id)} organisationId={String(org.id)} owners={owners}
        currentPersonId={currentPersonId} commercialHistory={[...rows("history"),...rows("ownerHistory")]} /></div>
      <div id="organisation-sources"><CrmOperationalLinks organisationId={String(org.id)} /></div>
      <p className="enterprise-honesty">Commercial Documents and staffing remain separate future work.</p>
      </div></div>}
    {!loading && opportunity && view==="opportunity" && <div className="crm-opportunity-record">
      <Link className="crm-record-back" href="/crm?view=opportunities">← Opportunities</Link>
      <header className="crm-organisation-header"><h1>{String(opportunity.title)}</h1><div className="crm-record-identity"><span>Opportunity</span><strong>{title(opportunity.stage)}</strong><span>{title(opportunity.opportunity_type)}</span></div><p>{String((data?.organisation as Row)?.name ?? "Organisation")} · Owner: {owners.find((o)=>o.id===opportunity.owner_person_id)?.displayName ?? "Assigned Office"}</p></header>
      <nav className="crm-opportunity-sections" aria-label="Opportunity sections"><a href="#opportunity-overview">Overview</a><a href="#opportunity-stage">Stage and owner</a><a href="#opportunity-work">Work and history</a></nav>
      <RecordSectionTracker label="Opportunity sections" />
      <div className="crm-organisation-related"><strong>Related workflows</strong><Link href={`/crm/organisations/${opportunity.organisation_id}`}>Organisation</Link>{opportunity.stage==="WON"&&<><Link href={`/mobilisations?organisation=${opportunity.organisation_id}&opportunity=${opportunity.id}`}>Authorise mobilisation</Link><Link href={`/events?organisation=${opportunity.organisation_id}&opportunity=${opportunity.id}`}>Create operational Event</Link></>}</div>
      <div className="crm-detail-grid"><section id="opportunity-overview" className="crm-panel"><h2>Opportunity</h2><dl>
        <div><dt>Estimated opportunity value</dt><dd>{value(opportunity.estimated_value_gbp_pence)}</dd></div>
        <div><dt>Expected decision</dt><dd>{String(opportunity.expected_decision_date ?? "Not set")}</dd></div>
        <div><dt>Owner</dt><dd>{owners.find((o)=>o.id===opportunity.owner_person_id)?.displayName ?? "Assigned Office"}</dd></div>
        <div><dt>Primary Contact</dt><dd>{data?.contact?`${String((data.contact as Row).first_name)} ${String((data.contact as Row).last_name)}`:"Not selected"}</dd></div>
        <div><dt>Summary</dt><dd>{String(opportunity.summary ?? "No summary")}</dd></div>
      </dl></section><section id="opportunity-stage" className="crm-panel"><h2>Stage and ownership</h2>{!["WON","LOST"].includes(String(opportunity.stage)) ? <>
        <label className="crm-field">Move to stage<select value={stage} onChange={(e)=>setStage(e.target.value)}><option value="">Select stage</option>{stageNames.filter((s)=>s!==opportunity.stage).map((s)=><option key={s} value={s}>{title(s)}</option>)}</select></label>
        {(stage==="LOST"||backwards)&&<label className="crm-field">{stage==="LOST"?"Lost reason":"Reason for moving backwards"}<Input required value={reason} maxLength={500} onChange={(e)=>setReason(e.target.value)}/></label>}
        {stage==="WON"&&<label className="crm-confirm"><input type="checkbox" checked={confirm} onChange={(e)=>setConfirm(e.target.checked)}/> I confirm this opportunity is Won. This does not establish a contract or active service.</label>}
        <Button disabled={busy||!stage||(stage==="WON"&&!confirm)||((stage==="LOST"||backwards)&&reason.trim().length<3)} onClick={()=>void act("transition",{id:opportunity.id,stage,reason})}>Record stage change</Button>
        <label className="crm-field">Change accountable owner<select value={fields.ownerId ?? ""} onChange={(e)=>setFields({...fields,ownerId:e.target.value})}><option value="">Select owner</option>{ownerOptions.map((x)=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
        <Button variant="outline" disabled={busy||!fields.ownerId} onClick={()=>void act("changeOwner",{id:opportunity.id,ownerId:fields.ownerId})}>Change owner</Button>
        <label className="crm-field">Estimated value (£)<Input type="number" min="0" step="0.01" value={fields.value ?? ""} onChange={(e)=>setFields({...fields,value:e.target.value})}/></label>
        <Button variant="outline" disabled={busy} onClick={()=>void act("changeValue",{id:opportunity.id,valuePence:fields.value===""?null:Math.round(Number(fields.value)*100)})}>Update estimate</Button>
      </>:<><p><strong>{title(opportunity.stage)} recorded</strong></p><p>This outcome is terminal in 05A. The record and its history remain available; corrections require a future approved process.</p></>}</section>
      </div>
      <div id="opportunity-work"><CrmRecordWork kind="opportunity" id={String(opportunity.id)} organisationId={String(opportunity.organisation_id)}
        owners={owners} currentPersonId={currentPersonId} accountableOwnerId={String(opportunity.owner_person_id)} commercialHistory={rows("history")} /></div>
      <p className="enterprise-honesty">Estimated value is not contracted or invoiced revenue.</p>
    </div>}
    {form && <div className="crm-dialog-backdrop" role="presentation"><section className="crm-dialog" role="dialog" aria-modal="true" aria-labelledby="crm-dialog-title">
      <div className="crm-panel-heading"><h2 id="crm-dialog-title">{form==="organisation"?"New Organisation":form==="editOrganisation"?"Edit Organisation":form==="contact"?"Add Contact":form==="editContact"?"Edit Contact":"New Opportunity"}</h2><Button variant="ghost" onClick={()=>{setForm("");setFields({});}}>Close</Button></div>
      {error && <p role="alert" className="enterprise-error">{error}</p>}
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
