"use client";
import { useState } from "react";
import type { TrainingBlock, TrainingModule, TrainingVersion } from "@/lib/training/types";
import { TrainingContent } from "@/components/training-content";

type Grant = { id: string; personId: string; personName: string; capability: string; grantedAt: string; revokedAt: string | null };
type Capabilities = { author: boolean; publisher: boolean; superAdmin: boolean };
const emptyContent = (): TrainingModule[] => [{ title: "Module 1", pages: [{ title: "Page 1", blocks: [{ type: "paragraph", text: "" }] }] }];
const clone = (modules: TrainingModule[]) => structuredClone(modules);
const blockTypes: TrainingBlock["type"][] = ["heading", "paragraph", "bullet", "numbered", "emphasis", "callout"];
export function TrainingAdminClient({ initial, capabilities, initialGrants }: { initial: TrainingVersion[]; capabilities: Capabilities; initialGrants: Grant[] }) {
  const [versions, setVersions] = useState(initial);
  const [grants, setGrants] = useState(initialGrants);
  const [selected, setSelected] = useState<string | null>(initial.find(v => v.state === "DRAFT")?.versionId ?? initial[0]?.versionId ?? null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [modules, setModules] = useState<TrainingModule[]>(emptyContent());
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [personId, setPersonId] = useState("");
  const [grantReason, setGrantReason] = useState("");
  const [grantCapability, setGrantCapability] = useState("TRAINING_AUTHOR");
  const [history, setHistory] = useState<Record<string, unknown>[] | null>(null);
  const [courseQuery, setCourseQuery] = useState("");
  const version = versions.find(v => v.versionId === selected);
  const draft = version?.state === "DRAFT";
  const courseIds = Array.from(new Set(versions.map(v => v.courseId)));
  const visibleCourseIds = courseIds.filter(courseId => (versions.find(v => v.courseId === courseId)?.courseTitle ?? "")
    .toLocaleLowerCase().includes(courseQuery.trim().toLocaleLowerCase()));
  const refresh = async () => {
    const result = await fetch("/api/training?view=admin", { cache: "no-store" });
    if (!result.ok) throw new Error("Training changes need a fresh read before confirmation.");
    const latest: TrainingVersion[] = (await result.json()).data ?? [];
    setVersions(latest);
    if (capabilities.superAdmin) {
      const grantsResult = await fetch("/api/training?view=grants", { cache: "no-store" });
      if (!grantsResult.ok) throw new Error("Training grants need a fresh read before confirmation.");
      setGrants((await grantsResult.json()).data ?? []);
    }
    return latest;
  };
  const act = async (body: Record<string, unknown>) => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/training", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error ?? "Action unavailable"); return; }
      const latest = await refresh();
      if (body.action === "CREATE_DRAFT" && typeof result.data === "string") { const created = latest.find(v => v.versionId === result.data); if (created) choose(created); }
      if (body.action === "CREATE_COURSE" && typeof result.data === "string") { const created = latest.find(v => v.courseId === result.data); if (created) choose(created); }
      setMessage("Server action accepted; current Training records refreshed.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Training action unavailable"); }
    finally { setBusy(false); }
  };
  const choose = (v: TrainingVersion) => { setSelected(v.versionId); setTitle(v.title); setSummary(v.summary); setModules(clone(v.modules)); setPreview(false); setHistory(null); };
  const changeModule = (mi: number, value: string) => setModules(old => { const next = clone(old); next[mi].title = value; return next; });
  const changePage = (mi: number, pi: number, value: string) => setModules(old => { const next = clone(old); next[mi].pages[pi].title = value; return next; });
  const changeBlock = (mi: number, pi: number, bi: number, key: "type" | "text", value: string) => setModules(old => { const next = clone(old); next[mi].pages[pi].blocks[bi] = { ...next[mi].pages[pi].blocks[bi], [key]: value } as TrainingBlock; return next; });
  const move = (mi: number, pi: number, direction: number) => setModules(old => { const next = clone(old); const target = pi + direction; if (target < 0 || target >= next[mi].pages.length) return old; [next[mi].pages[pi], next[mi].pages[target]] = [next[mi].pages[target], next[mi].pages[pi]]; return next; });
  const showHistory = async (courseId: string) => { const response = await fetch(`/api/training?view=history&courseId=${courseId}`, { cache: "no-store" }); setHistory(response.ok ? (await response.json()).data ?? [] : []); };
  return <div className="training-admin">
    <section className="training-admin-list"><h2>Courses and versions</h2>{capabilities.author && <button type="button" onClick={() => { setSelected(null); setTitle(""); setSummary(""); setModules(emptyContent()); setPreview(false); }}>New course</button>}
      <label>Filter loaded courses<input type="search" value={courseQuery} onChange={event => setCourseQuery(event.target.value)} placeholder="Course title" /></label>
      <p role="status">Showing {visibleCourseIds.length} of {courseIds.length} courses</p>
      {visibleCourseIds.length === 0 && <p>No matching courses in this loaded view.</p>}
      {visibleCourseIds.map(courseId => <details className="training-admin-course" key={courseId}><summary>{versions.find(v => v.courseId === courseId)?.courseTitle}</summary><div>{versions.filter(v => v.courseId === courseId).map(v => <button type="button" className={selected === v.versionId ? "selected" : ""} onClick={() => choose(v)} key={v.versionId}>v{v.versionNumber} · {v.state}{v.currentVersionId === v.versionId ? " · Current" : ""}{v.retiredAt ? " · Retired" : ""}</button>)}<button type="button" onClick={() => showHistory(courseId)}>History</button>{capabilities.author && !versions.some(v => v.courseId === courseId && v.state === "DRAFT") && <button disabled={busy} type="button" onClick={() => act({ action: "CREATE_DRAFT", courseId })}>Create next draft</button>}</div></details>)}
      {history && <div className="training-history"><h3>Attributable history</h3>{history.length ? history.map((event, i) => <p key={i}>{String(event.action)} · {String(event.occurredAt)} · Actor {String(event.actorPersonId)}</p>) : <p>No history available.</p>}</div>}
    </section>
    <section className="training-admin-edit"><h2>{version ? `Version ${version.versionNumber}: ${version.state}` : "New course draft"}</h2>{version?.contentHash && <p>Published content hash: <code>{version.contentHash}</code></p>}
      {(!version || draft) && capabilities.author ? <><label>Title<input value={title} maxLength={160} onChange={event => setTitle(event.target.value)} /></label><label>Summary<textarea value={summary} maxLength={600} onChange={event => setSummary(event.target.value)} /></label><p>Audience: company-wide active Security Staff · rule ACTIVE_SECURITY_STAFF_V1</p>
        <div className="training-editor-actions"><button type="button" onClick={() => setPreview(!preview)}>{preview ? "Edit" : "Preview"}</button><button disabled={busy} type="button" onClick={() => act(version ? { action: "EDIT_DRAFT", versionId: version.versionId, revision: version.revision, title, summary, modules } : { action: "CREATE_COURSE", title, summary, modules })}>{version ? "Save draft" : "Create course"}</button></div>
        {preview ? modules.map((m, mi) => <div key={mi}><h3>{m.title}</h3>{m.pages.map((p, pi) => <article className="training-preview" key={pi}><h4>{p.title}</h4><TrainingContent blocks={p.blocks} headingLevel={5} /></article>)}</div>) : modules.map((m, mi) => <fieldset key={mi}><legend>Module {mi + 1}</legend><label>Module title<input value={m.title} onChange={event => changeModule(mi, event.target.value)} /></label>{m.pages.map((p, pi) => <fieldset key={pi}><legend>Page {pi + 1}</legend><label>Page title<input value={p.title} onChange={event => changePage(mi, pi, event.target.value)} /></label><div className="training-editor-actions"><button type="button" onClick={() => move(mi, pi, -1)}>Move up</button><button type="button" onClick={() => move(mi, pi, 1)}>Move down</button><button type="button" onClick={() => setModules(old => { const next = clone(old); if (next[mi].pages.length > 1) next[mi].pages.splice(pi, 1); return next; })}>Remove page</button></div>{p.blocks.map((b, bi) => <div className="training-block-editor" key={bi}><label>Block type<select value={b.type} onChange={event => changeBlock(mi, pi, bi, "type", event.target.value)}>{blockTypes.map(t => <option key={t} value={t}>{t}</option>)}</select></label><label>Text<textarea value={b.text} maxLength={1500} onChange={event => changeBlock(mi, pi, bi, "text", event.target.value)} /></label><button type="button" onClick={() => setModules(old => { const next = clone(old); next[mi].pages[pi].blocks.splice(bi, 1); return next; })}>Remove block</button></div>)}<button type="button" onClick={() => setModules(old => { const next = clone(old); next[mi].pages[pi].blocks.push({ type: "paragraph", text: "" }); return next; })}>Add block</button></fieldset>)}<button type="button" onClick={() => setModules(old => { const next = clone(old); next[mi].pages.push({ title: `Page ${next[mi].pages.length + 1}`, blocks: [{ type: "paragraph", text: "" }] }); return next; })}>Add page</button><button type="button" onClick={() => setModules(old => old.length > 1 ? old.filter((_, i) => i !== mi) : old)}>Remove module</button></fieldset>)}{!preview && <button type="button" onClick={() => setModules(old => [...clone(old), { title: `Module ${old.length + 1}`, pages: [{ title: "New page", blocks: [{ type: "paragraph", text: "" }] }] }])}>Add module</button>}
      </> : version ? <div><p>{version.summary}</p>{version.modules.map((m, i) => <div key={i}><h3>{m.title}</h3>{m.pages.map((p, j) => <article className="training-preview" key={j}><h4>{p.title}</h4><TrainingContent blocks={p.blocks} headingLevel={5} /></article>)}</div>)}</div> : null}
      {version && draft && capabilities.publisher && <button disabled={busy} type="button" onClick={() => act({ action: "PUBLISH", versionId: version.versionId, revision: version.revision })}>Publish this saved draft</button>}
      {version && draft && capabilities.author && <button disabled={busy} type="button" onClick={() => { const reason = window.prompt("Reason for abandoning this draft (10–300 characters)"); if (reason) act({ action: "ABANDON", versionId: version.versionId, revision: version.revision, reason }); }}>Abandon draft</button>}
      {version && version.currentVersionId === version.versionId && capabilities.publisher && <button disabled={busy} type="button" onClick={() => { const reason = window.prompt("Reason for retiring this version (10–300 characters)"); if (reason) act({ action: "RETIRE", versionId: version.versionId, reason }); }}>Retire current version</button>}
      {message && <p role="status">{message}</p>}
    </section>
    {capabilities.superAdmin && <section className="training-grants"><h2>Named Training capabilities</h2><p>Active Office Admin membership alone grants no Training author or publisher access.</p><label>Office Admin Person ID<input value={personId} onChange={event => setPersonId(event.target.value)} /></label><label>Capability<select value={grantCapability} onChange={event => setGrantCapability(event.target.value)}><option>TRAINING_AUTHOR</option><option>TRAINING_PUBLISHER</option></select></label><label>Reason<input value={grantReason} onChange={event => setGrantReason(event.target.value)} /></label><button disabled={busy} type="button" onClick={() => act({ action: "GRANT", personId, capability: grantCapability, reason: grantReason })}>Grant capability</button>{grants.map(g => <div key={g.id}><p>{g.personName} · {g.capability} · {g.revokedAt ? "Revoked" : "Active"}</p>{!g.revokedAt && <button disabled={busy} type="button" onClick={() => { const reason = window.prompt("Reason for revocation (10–300 characters)"); if (reason) act({ action: "REVOKE", grantId: g.id, reason }); }}>Revoke</button>}</div>)}</section>}
  </div>;
}
