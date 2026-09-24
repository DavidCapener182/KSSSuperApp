"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";

type SiteListItem = { id: string; siteReference: string; name: string; townCity: string; status: string; canManage: boolean };
type SiteDetail = { id: string; site_reference: string; name: string; address_line1: string; town_city: string; postcode: string; reporting_point: string; site_type: string | null; status: string };
type Assignment = { id: string; person_id: string; effective_from: string; effective_until: string | null; revoked_at: string | null; change_reason: string };
type Event = { id: string; actor_person_id: string | null; entity_type: string; action: string; reason: string | null; occurred_at: string };

const emptySite = { site_reference: "", name: "", address_line1: "", town_city: "", postcode: "", reporting_point: "", site_type: "" };
const siteTypes = ["STADIUM","VENUE","RETAIL","WAREHOUSE","OFFICE","FESTIVAL_SITE","STATIC_SITE","OTHER"];

async function json(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Request denied");
  return body;
}

export default function SitesPage() {
  const [roles, setRoles] = useState<string[]>([]);
  const [authState, setAuthState] = useState<"loading" | "ready" | "denied">("loading");
  const [sites, setSites] = useState<SiteListItem[]>([]);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SiteDetail | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [draft, setDraft] = useState(emptySite);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [history, setHistory] = useState<Event[]>([]);
  const [staffPersonId, setStaffPersonId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [reason, setReason] = useState("");
  const [operationalSite,setOperationalSite] = useState<Record<string,unknown>|null>(null);
  const [clientChoices,setClientChoices] = useState<{id:string;name:string}[]>([]);
  const [clientId,setClientId] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadSites(term = search) {
    const body = await json(`/api/sites?search=${encodeURIComponent(term)}`);
    setSites(body.sites); setCount(body.count);
  }

  async function openSite(id: string) {
    const body = await json(`/api/sites/${id}`);
    setSelected(body.site); setCanManage(body.canManage);
    setDraft({
      site_reference: body.site.site_reference, name: body.site.name,
      address_line1: body.site.address_line1, town_city: body.site.town_city,
      postcode: body.site.postcode, reporting_point: body.site.reporting_point, site_type: body.site.site_type ?? "",
    });
    if (roles.includes("OFFICE_ADMIN") || roles.includes("SUPER_ADMIN")) {
      const related = await json(`/api/operational-sites/${id}`);
      setOperationalSite(related.site);
    } else setOperationalSite(null);
    if (body.canManage) {
      const [a, h] = await Promise.all([
        json(`/api/sites/${id}/assignments`), json(`/api/sites/${id}/history`),
      ]);
      setAssignments(a.assignments); setHistory(h.events);
    } else { setAssignments([]); setHistory([]); }
  }

  useEffect(() => {
    void (async () => {
      try {
        const me = await json("/api/me");
        setRoles(me.roles); setAuthState("ready");
        if(me.roles.includes("OFFICE_ADMIN")||me.roles.includes("SUPER_ADMIN")){
          const choices=await json("/api/events/choices");setClientChoices(choices.clients ?? []);
        }
        const body = await json("/api/sites?search=");
        setSites(body.sites); setCount(body.count);
      } catch { setAuthState("denied"); }
    })();
  }, []);

  async function act(action: () => Promise<void>) {
    setBusy(true); setNotice("");
    try { await action(); } catch (error) { setNotice(error instanceof Error ? error.message : "Request denied"); }
    setBusy(false);
  }

  async function createSite(event: FormEvent) {
    event.preventDefault();
    await act(async () => {
      const body = await json("/api/sites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
      await loadSites(""); await openSite(body.site.id); setNotice("Draft Site created and audited.");
    });
  }

  async function changeSite(fields: Record<string, string>) {
    if (!selected) return;
    await act(async () => {
      await json(`/api/sites/${selected.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(fields) });
      await loadSites(); await openSite(selected.id); setNotice("Site change saved and audited.");
    });
  }

  async function linkClient(event: FormEvent) {
    event.preventDefault();if(!selected||!clientId)return;
    await act(async()=>{await json(`/api/sites/${selected.id}/client`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({organisationId:clientId})});
      await openSite(selected.id);setNotice("Exact Client link recorded; Site ownership and Staff access are unchanged.");});
  }

  async function assign(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    await act(async () => {
      await json("/api/access/sites", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          personId: staffPersonId.trim(), siteId: selected.id,
          effectiveFrom: new Date(startAt).toISOString(), effectiveUntil: new Date(endAt).toISOString(), reason: reason.trim(),
        }),
      });
      await openSite(selected.id); setNotice("Staff assignment saved and audited.");
    });
  }

  async function changeAssignment(id: string, revoke: boolean) {
    if (!selected) return;
    const newReason = reason.trim();
    if (!newReason) { setNotice("Enter a new reason before changing an assignment."); return; }
    await act(async () => {
      await json(`/api/access/sites/${id}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify(revoke ? { revoke: true, reason: newReason } : { effectiveUntil: new Date().toISOString(), reason: newReason }),
      });
      await openSite(selected.id); setNotice(revoke ? "Assignment revoked and audited." : "Assignment expired and audited.");
    });
  }

  if (authState === "loading") return <main className="sites-shell"><p>Checking Site access…</p></main>;
  if (authState === "denied") return <main className="sites-shell"><h1>Site access unavailable</h1><p>Your current Enterprise access could not be confirmed.</p><Link href="/app">Return Home</Link></main>;
  const office = roles.includes("OFFICE_ADMIN") || roles.includes("SUPER_ADMIN");

  return <main className="sites-shell">
    <header className="sites-header"><div><Link href="/app">← Home</Link><p className="eyebrow">Synthetic development journey</p><h1>Sites</h1><p>Only Sites in your authorised scope appear here. {office&&<Link href="/sites?view=operational">Browse operational Sites</Link>}</p></div></header>
    {notice && <p className="sites-notice" role="status">{notice}</p>}
    <section className="sites-grid">
      <div className="sites-card">
        <h2>Find a Site</h2>
        <form className="sites-search" onSubmit={(event) => { event.preventDefault(); void act(() => loadSites()); }}>
          <input aria-label="Search Sites" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or reference" />
          <button disabled={busy}>Search</button>
        </form>
        <p className="sites-count">{count} permitted Site{count === 1 ? "" : "s"}</p>
        <ul className="sites-list">{sites.map((site) => <li key={site.id}><button onClick={() => void act(() => openSite(site.id))}><strong>{site.name}</strong><span>{site.siteReference} · {site.townCity} · {site.status}</span></button></li>)}</ul>
        {!sites.length && <p>{search ? "No permitted Sites match this search." : "You have no permitted Sites yet."}</p>}
      </div>

      <div className="sites-card">
        {selected ? <>
          <div className="sites-title"><div><p className="eyebrow">{selected.site_reference} · {selected.status}</p><h2>{selected.name}</h2></div><button className="subtle" onClick={() => { setSelected(null); setDraft(emptySite); }}>Close</button></div>
          <p>{selected.address_line1}, {selected.town_city}, {selected.postcode}</p>
          <p><strong>Reporting point:</strong> {selected.reporting_point}</p>
          <p><strong>Type:</strong> {selected.site_type?.replaceAll("_"," ") ?? "Unclassified"}</p>
          {office&&<><p><strong>Client:</strong> {operationalSite?.client_name ? <Link href={`/crm/organisations/${operationalSite.organisation_id}`}>{String(operationalSite.client_name)}</Link> : "Not linked"}</p>
            {((operationalSite?.events as {id:string;name:string}[])??[]).length>0&&<p>Events: {((operationalSite?.events as {id:string;name:string}[])??[]).map((item)=><Link key={item.id} href={`/events/${item.id}`}>{item.name}</Link>)}</p>}</>}
          {operationalSite?.organisation_id&&<p><Link href={`/sites/${selected.id}/services`}>Ongoing Site Services and shift demand</Link></p>}
          <p className="sites-id">Site ID: {selected.id}</p>
          {canManage && <>
            <h3>Manage Site</h3>
            <form className="sites-form" onSubmit={(event) => { event.preventDefault(); void changeSite({ name: draft.name, address_line1: draft.address_line1, town_city: draft.town_city, postcode: draft.postcode, reporting_point: draft.reporting_point, site_type:draft.site_type }); }}>
              {(["name", "address_line1", "town_city", "postcode", "reporting_point"] as const).map((field) => <label key={field}>{field.replaceAll("_", " ")}<input value={draft[field]} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} required /></label>)}
              <label>Site type<select value={draft.site_type} onChange={(event)=>setDraft({...draft,site_type:event.target.value})}><option value="">Unclassified</option>{siteTypes.map((type)=><option key={type} value={type}>{type.replaceAll("_"," ")}</option>)}</select></label>
              <button disabled={busy}>Save Site fields</button>
            </form>
            {!operationalSite?.organisation_id&&office&&<><h3>Link Client</h3><p>Choose the exact Client. This does not grant CRM or Site administration access.</p>
              <form className="sites-form" onSubmit={linkClient}><label>Client Organisation<select required value={clientId} onChange={(event)=>setClientId(event.target.value)}><option value="">Choose Client</option>{clientChoices.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button disabled={busy||!clientId}>Link Client</button></form></>}
            {selected.status === "DRAFT" && <button disabled={busy} onClick={() => void changeSite({ status: "ACTIVE" })}>Activate Site</button>}
            {selected.status === "ACTIVE" && <button disabled={busy} className="subtle" onClick={() => void changeSite({ status: "RETIRED" })}>Retire Site</button>}
            <h3>Staff assignments</h3>
            {selected.status === "ACTIVE" && <form className="sites-form" onSubmit={assign}>
              <label>Security Staff Person ID<input value={staffPersonId} onChange={(event) => setStaffPersonId(event.target.value)} required placeholder="Stable Person UUID" /></label>
              <label>Start<input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} required /></label>
              <label>End<input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} required /></label>
              <label>Reason<input value={reason} onChange={(event) => setReason(event.target.value)} required /></label>
              <button disabled={busy}>Assign Security Staff</button>
            </form>}
            <ul className="sites-assignments">{assignments.map((a) => <li key={a.id}><span>Person {a.person_id}<br />{a.effective_from} → {a.effective_until ?? "No end"}<br />{a.revoked_at ? "Revoked" : "Recorded"} · {a.change_reason}</span>{selected.status === "ACTIVE" && !a.revoked_at && <div><button disabled={busy} className="subtle" onClick={() => void changeAssignment(a.id, false)}>Expire now</button><button disabled={busy} className="subtle" onClick={() => void changeAssignment(a.id, true)}>Revoke</button></div>}</li>)}</ul>
            <h3>Change history</h3>
            <ul className="sites-history">{history.map((event) => <li key={event.id}>{event.occurred_at} · {event.action} {event.entity_type} · actor {event.actor_person_id}{event.reason ? ` · ${event.reason}` : ""}</li>)}</ul>
          </>}
        </> : office ? <><h2>Create a synthetic Site</h2><p>Draft Sites remain private until activated and assigned.</p><form className="sites-form" onSubmit={createSite}>
          {(["site_reference", "name", "address_line1", "town_city", "postcode", "reporting_point"] as const).map((field) => <label key={field}>{field.replaceAll("_", " ")}<input value={draft[field]} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} required /></label>)}
          <label>Site type<select value={draft.site_type} onChange={(event)=>setDraft({...draft,site_type:event.target.value})}><option value="">Unclassified</option>{siteTypes.map((type)=><option key={type} value={type}>{type.replaceAll("_"," ")}</option>)}</select></label>
          <button disabled={busy}>Create Draft Site</button>
        </form></> : <><h2>Select a Site</h2><p>Choose one of your assigned active Sites to view its location and reporting point.</p></>}
      </div>
    </section>
  </main>;
}
