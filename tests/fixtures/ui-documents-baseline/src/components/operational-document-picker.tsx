"use client";

import { useState } from "react";

export type DocumentChoice = { id: string; label: string; parent?: string };
type Kind = "DOCUMENT" | "SITE" | "SITE_SERVICE" | "EVENT" | "PERSON" | "OPERATIONAL_ROLE";

export function OperationalDocumentPicker({ kind, title, siteId, onChoose }: {
  kind: Kind; title: string; siteId?: string; onChoose: (choice: DocumentChoice) => void;
}) {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<DocumentChoice[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function find(nextOffset = 0) {
    if (search.trim().length < 2 || (kind === "SITE_SERVICE" && !siteId)) return;
    setBusy(true); setError("");
    try {
      const query = new URLSearchParams({ kind, search: search.trim(), offset: String(nextOffset) });
      if (siteId) query.set("site", siteId);
      const response = await fetch(`/api/operational-documents/choices?${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Authorised choices unavailable");
      const result = await response.json();
      setItems(nextOffset ? [...items, ...(result.items ?? [])] : result.items ?? []);
      setTotal(result.total ?? 0);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Search unavailable"); }
    finally { setBusy(false); }
  }

  return <div>
    <label>{title}<input type="search" value={search} minLength={2} maxLength={80}
      placeholder={`Search ${title.toLowerCase()}…`} onChange={(event) => { setSearch(event.target.value); setItems([]); setTotal(0); }} /></label>
    <button type="button" disabled={busy || search.trim().length < 2 || (kind === "SITE_SERVICE" && !siteId)}
      onClick={() => void find()}>Search</button>
    {error && <p role="alert">{error}</p>}
    {!busy && search.trim().length >= 2 && items.length === 0 && total === 0 &&
      <p>Search for a named, authorised source.</p>}
    {items.length > 0 && <ul aria-label={`${title} choices`}>{items.map((choice) => <li key={choice.id}>
      <button type="button" onClick={() => onChoose(choice)}>
        {choice.label}{choice.parent ? <small> · {choice.parent}</small> : null}
      </button>
    </li>)}</ul>}
    {items.length < total && <button type="button" disabled={busy} onClick={() => void find(items.length)}>More results</button>}
  </div>;
}
