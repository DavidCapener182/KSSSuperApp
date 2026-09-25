"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import styles from "./crm-new-lead.module.css";

type Organisation = { id: string; name: string; relationship_status: string };
type Owner = { id: string; displayName: string };
type Contact = { id: string; first_name: string; last_name: string; active: boolean };
async function read(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail ?? body.error ?? "Commercial request denied");
  return body;
}
export function CrmNewLead({ currentPersonId, initialOrganisationId }: { currentPersonId: string; initialOrganisationId?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Organisation[]>([]);
  const [selected, setSelected] = useState<Organisation | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("DIRECT_ENQUIRY");
  const [ownerId, setOwnerId] = useState(currentPersonId);
  const [contactId, setContactId] = useState("");
  const [value, setValue] = useState("");
  const [decisionDate, setDecisionDate] = useState("");
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedOrganisationId, setSavedOrganisationId] = useState<string | null>(null);
  const [savedOpportunityId, setSavedOpportunityId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    Promise.all(["OFFICE_ADMIN", "SUPER_ADMIN"].map(role => read(`/api/people?role=${role}&limit=50`).catch(() => ({ items: [] }))))
      .then(results => { if (active) setOwners([...new Map(results.flatMap(result => result.items ?? []).map((item: Owner) => [item.id, item])).values()]); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!initialOrganisationId) return;
    let active = true;
    read(`/api/crm?view=organisation&id=${initialOrganisationId}`).then(result => {
      if (active) { setSelected(result.organisation); setContacts(result.contacts ?? []); }
    }).catch(() => { if (active) setError("The linked Organisation is unavailable. Find it below before continuing."); });
    return () => { active = false; };
  }, [initialOrganisationId]);
  useEffect(() => {
    if (mode !== "existing" || query.trim().length < 2 || selected) return;
    let active = true;
    const timer = window.setTimeout(() => {
      read(`/api/crm?view=organisations&search=${encodeURIComponent(query.trim())}`).then(result => {
        if (active) { setMatches(result.items ?? []); setError(""); }
      }).catch(() => { if (active) setError("Organisation search is unavailable. Try again before creating a new record."); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [mode, query, selected]);
  async function chooseOrganisation(item: Organisation) {
    setSelected(item); setError(""); setContactId("");
    try { const result = await read(`/api/crm?view=organisation&id=${item.id}`); setContacts(result.contacts ?? []); }
    catch { setContacts([]); setError("Organisation selected, but Contacts could not be read. You can still create the lead without one."); }
  }
  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (savedOpportunityId) {
        const confirmed = await read(`/api/crm?view=opportunity&id=${savedOpportunityId}`);
        if (confirmed.opportunity?.id !== savedOpportunityId || confirmed.opportunity?.stage !== "NEW_LEAD")
          throw new Error("The saved lead could not be confirmed. Check the Opportunities list before another action.");
        router.push(`/crm/opportunities/${savedOpportunityId}`);
        return;
      }
      let organisation = selected;
      if (!organisation) {
        if (mode !== "new" || !name.trim()) throw new Error("Choose an existing Organisation or enter a new one.");
        const created = savedOrganisationId ? { id: savedOrganisationId } : await read("/api/crm", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "createOrganisation", name: name.trim(), ownerId: currentPersonId }) });
        setSavedOrganisationId(created.id);
        const confirmed = await read(`/api/crm?view=organisation&id=${created.id}`);
        if (confirmed.organisation?.id !== created.id) throw new Error("Organisation creation could not be confirmed. Check the Organisation list before trying again.");
        organisation = confirmed.organisation as Organisation;
        setSelected(organisation);
        setContacts([]);
      }
      const pence = value.trim() ? Math.round(Number(value) * 100) : null;
      if (pence !== null && (!Number.isSafeInteger(pence) || pence < 0)) throw new Error("Enter a valid non-negative estimated value.");
      const created = await read("/api/crm", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "createOpportunity", organisationId: organisation.id, title: title.trim(), type,
          ownerId, contactId: contactId || null, valuePence: pence, decisionDate: decisionDate || null, summary: summary.trim() || null }) });
      setSavedOpportunityId(created.id);
      const confirmed = await read(`/api/crm?view=opportunity&id=${created.id}`);
      if (confirmed.opportunity?.id !== created.id || confirmed.opportunity?.stage !== "NEW_LEAD")
        throw new Error("Lead creation could not be confirmed. Check the Opportunities list before trying again.");
      router.push(`/crm/opportunities/${created.id}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Lead creation denied"); }
    finally { setBusy(false); }
  }
  return <main className={`enterprise-main ${styles.page}`}>
    <Link href="/crm?view=pipeline">← CRM pipeline</Link>
    <p className="eyebrow">Commercial workspace · synthetic development data</p>
    <h1>New lead</h1>
    <p className="enterprise-intro">Create a New Lead Opportunity for an existing or new Organisation. This records a commercial enquiry; it does not authorise Mobilisation or an operational service.</p>
    {error && <p role="alert" className="enterprise-error">{error}</p>}
    <form onSubmit={event => void create(event)} className={styles.form}>
      <section className={styles.panel}><h2>1 · Organisation</h2>
        {selected ? <div className={styles.selected}><strong>{selected.name}</strong><span>{selected.relationship_status.replaceAll("_", " ").toLowerCase()}</span>
          <Button type="button" variant="outline" onClick={() => { setSelected(null); setSavedOrganisationId(null); setContacts([]); setContactId(""); }}>Change Organisation</Button></div> : <>
          <div className={styles.choice}><Button type="button" variant={mode === "existing" ? "default" : "outline"} onClick={() => setMode("existing")}>Find existing</Button>
            <Button type="button" variant={mode === "new" ? "default" : "outline"} onClick={() => setMode("new")}>Create new Organisation</Button></div>
          {mode === "existing" ? <><label>Search Organisation<Input value={query} onChange={event => { setQuery(event.target.value); setMatches([]); }} placeholder="Enter at least two letters" /></label>
            {query.trim().length >= 2 && <div className={styles.results} aria-label="Matching Organisations">{matches.map(item => <button type="button" key={item.id} onClick={() => void chooseOrganisation(item)}><strong>{item.name}</strong><span>{item.relationship_status.replaceAll("_", " ").toLowerCase()}</span></button>)}
              {!matches.length && <p>No matches in this page of the authorised search. Refine the name before creating a new Organisation.</p>}</div>}</> : <><label>New Organisation name<Input required value={name} maxLength={160} onChange={event => setName(event.target.value)} /></label>
            <p>Check the Organisation list for duplicates. If the next step fails, this Organisation stays saved and can be selected for a retry.</p></>}
        </>}
      </section>
      <section className={styles.panel}><h2>2 · Lead details</h2>
        <label>Opportunity title<Input required maxLength={180} value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Reading festival security enquiry" /></label>
        <label>Enquiry type<select value={type} onChange={event => setType(event.target.value)}><option value="DIRECT_ENQUIRY">Direct enquiry</option><option value="TENDER">Tender</option><option value="PROSPECTING">Prospecting</option><option value="EXISTING_CLIENT_EXPANSION">Existing Client expansion</option><option value="RENEWAL">Renewal</option></select></label>
        <label>Opportunity owner<select value={ownerId} onChange={event => setOwnerId(event.target.value)}><option value={currentPersonId}>Me</option>{owners.filter(item => item.id !== currentPersonId).map(item => <option value={item.id} key={item.id}>{item.displayName}</option>)}</select></label>
        {selected && contacts.some(item => item.active) && <label>Primary business Contact<select value={contactId} onChange={event => setContactId(event.target.value)}><option value="">Add later</option>{contacts.filter(item => item.active).map(item => <option value={item.id} key={item.id}>{item.first_name} {item.last_name}</option>)}</select></label>}
        <div className={styles.two}><label>Estimated value (£)<Input type="number" min="0" step="0.01" value={value} onChange={event => setValue(event.target.value)} /></label>
          <label>Expected decision date<Input type="date" value={decisionDate} onChange={event => setDecisionDate(event.target.value)} /></label></div>
        <label>Short summary<textarea maxLength={1000} value={summary} onChange={event => setSummary(event.target.value)} /></label>
      </section>
      <div className={styles.actions}><Button disabled={busy || (!savedOpportunityId && !selected && (mode !== "new" || !name.trim()))}>{busy ? "Saving lead…" : savedOpportunityId ? "Check saved lead" : "Create new lead"}</Button><Link href="/crm?view=pipeline">Cancel</Link></div>
    </form>
  </main>;
}
