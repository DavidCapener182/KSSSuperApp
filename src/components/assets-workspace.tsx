"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./assets-workspace.module.css";

type Item = { id: string; reference: string; class: string; description: string; condition: string;
  maintenanceState: string; exceptionState: string; holderKind: string; holderId: string;
  holderLabel: string | null; locationLabel: string | null;
  expectedReturnAt: string | null; pendingAck: string | null; revision: number; overdue: boolean };
type Stock = { id: string; sku: string; garment: string; size: string; available: number; issued: number; revision: number };
type Data = { stores: { id: string; name: string }[]; items: Item[]; stock: Stock[];
  myStock: { issueId: string; garment: string; size: string; outstanding: number; acknowledgement: string }[] };
type History = { reference: string; serial: string | null; events: { id: string; revision: number; action: string;
  conditionAfter: string; maintenanceAfter: string; holderAfter: string; recordedAt: string; reason: string | null }[] };
type Admin = { operations: { id: string; name: string }[]; scopes: { kind: string; id: string; name: string }[];
  grants: { id: string; personId: string; scopeKind: string; scopeId: string; effectiveUntil: string }[];
  grantEvents: { id: string; grantId: string; kind: string; actorId: string; reason: string; occurredAt: string }[] };
type Holder = { kind: string; id: string; name: string };
type StockHistory = { id: string; sku: string; events: { id: string; revision: number; action: string;
  quantity: number; availableAfter: number; outstandingAfter: number; issueId: string | null;
  recordedAt: string; reason: string | null }[] };

const conditions = ["GOOD", "SERVICEABLE", "DAMAGED", "UNSERVICEABLE", "UNKNOWN"];
const classes = ["RADIO", "KEY_CARD", "PHONE", "LAPTOP_TABLET", "BODYCAM"];
const empty: Data = { stores: [], items: [], stock: [], myStock: [] };
const stamp = (value: string | null) => value ? new Intl.DateTimeFormat("en-GB",
  { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(value)) : "Not set";

async function api(body?: Record<string, unknown>, query = "") {
  const response = await fetch("/api/assets" + query, body ? {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, requestKey: crypto.randomUUID() }),
  } : { cache: "no-store" });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || "Asset request failed");
  return json.data ?? json.result;
}

export function AssetsWorkspace({ mode, office, operations, superAdmin }: {
  mode: "register" | "self"; office: boolean; operations: boolean; superAdmin: boolean;
}) {
  const [data, setData] = useState<Data>(empty);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [stockHistory, setStockHistory] = useState<StockHistory | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [action, setAction] = useState("ISSUE");
  const [holderKind, setHolderKind] = useState("PERSON");
  const [holderId, setHolderId] = useState("");
  const [condition, setCondition] = useState("GOOD");
  const [reason, setReason] = useState("");
  const [expectedReturn, setExpectedReturn] = useState("");
  const [message, setMessage] = useState("");
  const [contextFilter, setContextFilter] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    setData(await api(undefined, mode === "self" ? "?self=1" : "") as Data);
    if (superAdmin && mode === "register") setAdmin(await api(undefined, "?admin=1") as Admin);
    if (operations && mode === "register") {
      try { const choices = await api(undefined, "?holders=1") as { people: Holder[]; places: Holder[] };
        setHolders([...choices.people, ...choices.places]); } catch { setHolders([]); }
    }
  }, [mode, operations, superAdmin]);
  useEffect(() => { void Promise.resolve().then(refresh).catch(() => setMessage("Asset view unavailable.")); }, [refresh]);
  async function submit(body: Record<string, unknown>) {
    setBusy(true); setMessage("");
    try {
      await api(body); await refresh();
      if (item) setHistory(await api(undefined, "?assetId=" + encodeURIComponent(item.id)) as History);
      setMessage("Saved. The committed record is shown below.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Action unavailable."); }
    finally { setBusy(false); }
  }
  async function open(value: Item) {
    setItem(value); setCondition(value.condition);
    setAction(mode === "self" ? (value.pendingAck === "ISSUE" ? "ACK_ISSUE" : "REPORT_DAMAGE")
      : operations ? "ISSUE" : "RETIRE");
    setReason(""); setHolderId(""); setHistory(null);
    try { setHistory(await api(undefined, "?assetId=" + encodeURIComponent(value.id)) as History); }
    catch { setMessage("History unavailable for this record."); }
  }
  const current = data.items.find((value) => value.id === item?.id) ?? item;
  const actionList = mode === "self"
    ? (current?.pendingAck === "ISSUE" ? ["ACK_ISSUE", "DISPUTE_ISSUE"] : current?.holderKind === "PERSON" ? ["REPORT_DAMAGE", "REPORT_LOSS"] : [])
    : [
      ...(operations ? ["ISSUE", "TRANSFER", "RETURN", "ACK_RETURN"] : []),
      ...(operations ? ["INSPECT", "RECOVER", "REPAIR_START", "REPAIR_COMPLETE"] : []),
      ...(office || operations ? ["RETIRE"] : []),
    ];
  const store = data.stores[0];
  const contexts = [...new Map(data.items.filter((value) => ["SITE", "SITE_SERVICE", "EVENT"].includes(value.holderKind))
    .map((value) => [value.holderKind + ":" + value.holderId, value])).values()];
  const visibleItems = data.items.filter((value) => (!contextFilter ||
    value.holderKind + ":" + value.holderId === contextFilter) &&
    (!search || (value.reference + " " + value.description).toLowerCase().includes(search.toLowerCase())));
  return <div className={styles.workspace}>
    <p className={styles.hint}>Synthetic development only. Custody, condition and repair are recorded separately. Damage or loss is an operational fact, not an attribution of blame.</p>
    <p role="status" aria-live="polite">{busy ? "Saving…" : message}</p>
    {mode === "register" && office && <details className={styles.setup}><summary>Register items and opening stock</summary><p>Use these controls after confirming the exact item or stock record does not already exist.</p><div className={styles.grid}>
      <section className={styles.panel}><h2>Register an item</h2>
        <form onSubmit={(event) => { event.preventDefault(); const f = new FormData(event.currentTarget);
          submit({ action: "REGISTER", reference: String(f.get("reference")).trim().toUpperCase(),
            class: f.get("class"), description: f.get("description"), serial: f.get("serial"),
            condition: f.get("condition"), storeId: f.get("storeId") }); }}>
          <label>Reference<input name="reference" required maxLength={32} placeholder="RADIO-001" /></label>
          <label>Class<select name="class">{classes.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Description<input name="description" required maxLength={160} /></label>
          <label>Serial (optional)<input name="serial" maxLength={100} /></label>
          <label>Condition<select name="condition">{conditions.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>KSS store<select name="storeId">{data.stores.map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
          <button disabled={busy || !store}>Register</button>
        </form>
      </section>
      <section className={styles.panel}><h2>Open uniform stock</h2>
        <form onSubmit={(event) => { event.preventDefault(); const f = new FormData(event.currentTarget);
          submit({ action: "STOCK_CREATE", sku: String(f.get("sku")).trim().toUpperCase(),
            garment: f.get("garment"), size: f.get("size"), quantity: Number(f.get("quantity")),
            reason: f.get("reason"), storeId: f.get("storeId") }); }}>
          <label>Stock reference<input name="sku" required maxLength={32} placeholder="POLO-M" /></label>
          <label>Garment<input name="garment" required maxLength={100} placeholder="Polo Shirt" /></label>
          <label>Size<input name="size" required maxLength={20} placeholder="Medium" /></label>
          <label>Verified opening quantity<input name="quantity" type="number" min={1} required defaultValue={20} /></label>
          <label>Stocktake reason<input name="reason" required minLength={3} maxLength={500} /></label>
          <label>KSS store<select name="storeId">{data.stores.map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
          <button disabled={busy || !store}>Open stock</button>
        </form>
      </section>
    </div></details>}
    {mode === "register" && superAdmin && admin && <section className={styles.panel}>
      <details className={styles.adminDetails}><summary>Scoped Operations grants</summary><p>Grant and revocation change access for one exact scope. Review current grants before making a change.</p>
      <form onSubmit={(event) => { event.preventDefault(); const f = new FormData(event.currentTarget);
        const scope = admin.scopes.find((value) => value.kind + ":" + value.id === f.get("scope"));
        if (scope) submit({ action: "GRANT", personId: f.get("person"), scopeKind: scope.kind, scopeId: scope.id,
          until: new Date(String(f.get("until"))).toISOString(), reason: f.get("reason") }); }}>
        <label>Operations person<select name="person">{admin.operations.map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
        <label>Exact scope<select name="scope">{admin.scopes.map((value) => <option key={value.kind + value.id} value={value.kind + ":" + value.id}>{value.kind}: {value.name}</option>)}</select></label>
        <label>Grant ends<input name="until" type="datetime-local" required /></label>
        <label>Reason<input name="reason" required minLength={3} maxLength={300} /></label>
        <button disabled={busy || admin.operations.length === 0}>Grant</button>
      </form>
      <ul>{admin.grants.map((grant) => <li key={grant.id}>{grant.scopeKind} · {grant.personId.slice(0, 8)} · until {stamp(grant.effectiveUntil)}{" "}
        <button type="button" disabled={busy} onClick={() => { const why = window.prompt("Revocation reason");
          if (why) submit({ action: "REVOKE_GRANT", grantId: grant.id, reason: why }); }}>Revoke</button></li>)}</ul>
      <details><summary>Recent grant history</summary><ol className={styles.history}>{admin.grantEvents.map((event) =>
        <li key={event.id}>{event.kind} · {stamp(event.occurredAt)} · grant {event.grantId.slice(0, 8)}
          <span>Reason: {event.reason}</span></li>)}</ol></details>
      </details>
    </section>}
    <section className={styles.panel}><h2>{mode === "self" ? "My equipment" : "Asset register"}</h2><p className={styles.hint}>{mode === "self" ? "Current items issued to you. Open an item to acknowledge, dispute or report an observation." : "Search authorised items and inspect custody, condition and repair separately. Open an item for exact history and guarded actions."}</p>
      <label>Find asset by reference or description<input type="search" value={search}
        onChange={(event) => setSearch(event.target.value)} /></label>
      {mode === "register" && <label>Site, Service or Event view<select value={contextFilter} onChange={(event) => setContextFilter(event.target.value)}>
        <option value="">All authorised items</option>
        {contexts.map((value) => <option key={value.holderKind + value.holderId} value={value.holderKind + ":" + value.holderId}>
          {value.holderKind.replaceAll("_", " ")} · {value.holderLabel ?? value.holderId}</option>)}
      </select></label>}
      <p className={styles.count} role="status">{visibleItems.length} {visibleItems.length === 1 ? "item" : "items"} in this view</p>
      {visibleItems.length === 0 && <p>No assets in this view.</p>}
      <div className={styles.grid}>{visibleItems.map((value) => <article className={styles.card} key={value.id}>
        <span className={styles.reference}>{value.reference} · {value.class.replaceAll("_", " ")}</span><h3>{value.description}</h3>
        <dl><dt>Available to issue</dt><dd>{value.holderKind === "STORE" && value.pendingAck === null &&
          value.maintenanceState === "NONE" && value.exceptionState === "NONE" &&
          ["GOOD", "SERVICEABLE"].includes(value.condition) ? "Yes" : "No"}</dd>
          <dt>Custody</dt><dd>{value.holderKind.replaceAll("_", " ")} · {value.holderLabel ?? value.holderId}</dd>
          <dt>Last location</dt><dd>{value.locationLabel ?? "Not recorded"}</dd>
          <dt>Condition</dt><dd>{value.condition}</dd><dt>Repair</dt><dd>{value.maintenanceState}</dd>
          <dt>Exception</dt><dd>{value.exceptionState}</dd><dt>Return expected</dt><dd>{stamp(value.expectedReturnAt)}</dd></dl>
        {value.overdue && <p className={styles.alert}>Expected return has passed.</p>}
        {value.pendingAck && <p className={styles.alert}>Handover acknowledgement pending: {value.pendingAck}</p>}
        <button type="button" onClick={() => open(value)}>View history and actions</button>
      </article>)}</div>
    </section>
    {current && <section className={styles.panel}><h2>{current.reference} · history</h2>
      {history?.serial && <p>Serial: {history.serial}</p>}
      {actionList.length > 0 && <form onSubmit={(event) => { event.preventDefault();
        submit({ action, assetId: current.id, expectedRevision: current.revision,
          holderKind: ["ISSUE", "TRANSFER", "RETURN"].includes(action) ? holderKind : null,
          holderId: ["ISSUE", "TRANSFER", "RETURN"].includes(action) ? holderId : null,
          condition: ["RETURN", "INSPECT"].includes(action) ? condition : null,
          expectedReturnAt: expectedReturn ? new Date(expectedReturn).toISOString() : null, reason: reason || null }); }}>
        <label>Action<select value={action} onChange={(event) => setAction(event.target.value)}>
          {actionList.map((value) => <option key={value}>{value}</option>)}</select></label>
        {["ISSUE", "TRANSFER", "RETURN"].includes(action) && <>
          <label>New holder type<select value={holderKind} onChange={(event) => { setHolderKind(event.target.value); setHolderId(""); }}>
            {["PERSON", "STORE", "SITE", "SITE_SERVICE", "EVENT"].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Exact holder<select value={holderId} onChange={(event) => setHolderId(event.target.value)} required>
            <option value="">Choose a {holderKind.toLowerCase().replaceAll("_", " ")}</option>
            {holders.filter((value) => value.kind === holderKind).map((value) =>
              <option key={value.id} value={value.id}>{value.name}</option>)}
          </select></label>
          {holderKind === "STORE" && store && <button type="button" onClick={() => setHolderId(store.id)}>Use KSS store</button>}
          <label>Expected return (optional)<input type="datetime-local" value={expectedReturn} onChange={(event) => setExpectedReturn(event.target.value)} /></label>
        </>}
        {["RETURN", "INSPECT"].includes(action) && <label>Observed condition<select value={condition} onChange={(event) => setCondition(event.target.value)}>
          {conditions.map((value) => <option key={value}>{value}</option>)}</select></label>}
        <label>Reason / observation<input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500}
          required={["DISPUTE_ISSUE", "REPORT_DAMAGE", "REPORT_LOSS", "RECOVER", "RETIRE"].includes(action)} /></label>
        <button disabled={busy}>Record {action.replaceAll("_", " ").toLowerCase()}</button>
      </form>}
      <ol className={styles.history}>{history?.events.map((value) => <li key={value.id}>
        <strong>{value.action.replaceAll("_", " ")}</strong> · {stamp(value.recordedAt)} · revision {value.revision}
        <span>Custody {value.holderAfter}; condition {value.conditionAfter}; repair {value.maintenanceAfter}</span>
        {value.reason && <span>Observation: {value.reason}</span>}
      </li>)}</ol>
    </section>}
    {mode === "register" && <section className={styles.panel}><h2>Uniform stock by size</h2>
      <div className={styles.grid}>{data.stock.map((value) => <article className={styles.card} key={value.id}>
        <strong>{value.garment} · {value.size}</strong><p>{value.sku} · Available {value.available} · Issued {value.issued}</p>
        <button type="button" onClick={async () => { try { setStockHistory(await api(undefined, "?stockId=" + encodeURIComponent(value.id)) as StockHistory); }
          catch { setMessage("Stock history unavailable."); } }}>View movements and issue IDs</button>
        {(operations || office) && <form onSubmit={(event) => { event.preventDefault(); const f = new FormData(event.currentTarget);
          submit({ action: "STOCK_" + f.get("movement"), stockId: value.id, quantity: Number(f.get("quantity")),
            personId: f.get("personId") || null, issueId: f.get("issueId") || null,
            expectedRevision: value.revision, reason: f.get("reason") || null }); }}>
          <label>Movement<select name="movement">{operations && <><option>ISSUE</option><option>RETURN</option></>}
            {office && <option>ADJUST</option>}</select></label>
          <label>Quantity or signed adjustment<input name="quantity" type="number" required defaultValue={2} /></label>
          <label>Recipient Person UUID<input name="personId" /></label>
          <label>Issue UUID for return<input name="issueId" /></label>
          <label>Reason for adjustment<input name="reason" maxLength={500} /></label>
          <button disabled={busy}>Record movement</button>
        </form>}
      </article>)}</div>
      {stockHistory && <div className={styles.card}><h3>{stockHistory.sku} · movement history</h3>
        <ol className={styles.history}>{stockHistory.events.map((value) => <li key={value.id}>
          <strong>{value.action}</strong> · {stamp(value.recordedAt)} · quantity {value.quantity} · available after {value.availableAfter}
          {value.issueId && <span>Issue ID for return: {value.issueId}</span>}
          {value.reason && <span>Reason: {value.reason}</span>}
        </li>)}</ol></div>}
    </section>}
    {mode === "self" && <section className={styles.panel}><h2>My issued uniform</h2>
      {data.myStock.length === 0 && <p>No uniform issue is outstanding.</p>}
      {data.myStock.map((value) => <article className={styles.card} key={value.issueId}>
        <strong>{value.garment} · {value.size}</strong><p>Quantity {value.outstanding}. Acknowledgement: {value.acknowledgement}.</p>
        {value.acknowledgement === "PENDING" && <>
          <button disabled={busy} onClick={() => submit({ action: "STOCK_ACK", issueId: value.issueId, dispute: false })}>Acknowledge receipt</button>{" "}
          <button disabled={busy} onClick={() => { const why = window.prompt("Describe the discrepancy");
            if (why) submit({ action: "STOCK_ACK", issueId: value.issueId, dispute: true, reason: why }); }}>Dispute receipt</button>
        </>}
      </article>)}
    </section>}
  </div>;
}
