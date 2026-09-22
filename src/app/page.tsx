"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type AccessView = {
  person: { id: string; displayName: string };
  roles: string[];
  view: string;
  sites: { id: string; name: string }[];
};

const supabase = createBrowserSupabase();

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [view, setView] = useState<AccessView | null>(null);
  const [status, setStatus] = useState("Checking development access…");
  const [busy, setBusy] = useState(false);
  const [recordId, setRecordId] = useState("");
  const [recordType, setRecordType] = useState<"people" | "sites">("sites");
  const [recordResult, setRecordResult] = useState("");

  async function refreshAccess() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setAuthenticated(false); setView(null); setStatus(""); return; }
    setAuthenticated(true);
    const response = await fetch("/api/me", { cache: "no-store" });
    if (!response.ok) { setView(null); setStatus("This sign-in has no active KSS Enterprise access."); return; }
    setView(await response.json());
    setStatus("");
  }

  useEffect(() => { void supabase.auth.getUser().then(() => refreshAccess()); }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setStatus("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setPassword("");
    if (error) setStatus("Sign-in failed. Check the development account details.");
    else await refreshAccess();
    setBusy(false);
  }

  async function signOut() {
    setBusy(true);
    await supabase.auth.signOut();
    setAuthenticated(false); setView(null); setEmail(""); setPassword("");
    setRecordId(""); setRecordType("sites"); setRecordResult(""); setStatus("Signed out.");
    setBusy(false);
  }

  async function checkRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRecordResult("");
    const response = await fetch(`/api/${recordType}/${encodeURIComponent(recordId.trim())}`, { cache: "no-store" });
    if (response.ok) {
      const record = await response.json();
      setRecordResult(`Permitted: ${record.displayName ?? record.name}`);
    } else {
      setRecordResult(response.status === 404 ? "Not available to this account." : "Request denied.");
    }
  }

  return (
    <main className="shell">
      <header className="shell-header" aria-label="KSS Enterprise Platform">
        <div className="identity"><span className="identity-mark" aria-hidden="true">K</span><span className="identity-name">KSS <span>Enterprise Platform</span></span></div>
        <span className="phase-label">Development · Access proof</span>
      </header>
      <section className="welcome" aria-labelledby="welcome-title">
        <div className="eyebrow">Identity &amp; scoped access</div>
        <h1 id="welcome-title">A secure place to start.</h1>
        <p className="lead">This development view proves that a signed-in person sees only their authorised KSS Enterprise records. Operational systems and live staff data are not connected.</p>
        <div className="notice" role="status"><span className="notice-dot" aria-hidden="true" /><div><strong>Development accounts only</strong><p>Use synthetic test accounts. This is an identity and access proof, not an operational dashboard.</p></div></div>
        {status && <p className="access-status" role="status">{status}</p>}
        {!authenticated && !status.startsWith("Checking") && (
          <form className="access-panel" onSubmit={signIn}>
            <h2>Sign in</h2>
            <label>Email<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <button disabled={busy} type="submit">{busy ? "Signing in…" : "Sign in to development"}</button>
          </form>
        )}
        {authenticated && (
          <div className="access-panel">
            <div className="panel-heading"><h2>{view?.view ?? "No Enterprise assignment"}</h2><button className="secondary" disabled={busy} onClick={signOut}>Sign out</button></div>
            {view && <>
              <p>Signed in as <strong>{view.person.displayName}</strong></p>
              <p className="small-line">Person ID: <code>{view.person.id}</code></p>
              <p className="small-line">Active role{view.roles.length === 1 ? "" : "s"}: {view.roles.join(", ")}</p>
              <h3>Permitted sites</h3>
              {view.sites.length ? <ul>{view.sites.map((site) => <li key={site.id}>{site.name} <code>{site.id}</code></li>)}</ul> : <p>No assigned sites.</p>}
              <form className="record-check" onSubmit={checkRecord}>
                <h3>Check a record ID</h3>
                <div className="record-fields"><select aria-label="Record type" value={recordType} onChange={(event) => setRecordType(event.target.value as "people" | "sites")}><option value="sites">Site</option><option value="people">Person</option></select><input aria-label="Record ID" placeholder="Record UUID" required value={recordId} onChange={(event) => setRecordId(event.target.value)} /><button type="submit">Check access</button></div>
                {recordResult && <p role="status">{recordResult}</p>}
              </form>
            </>}
          </div>
        )}
      </section>
      <footer className="shell-footer"><span>KSS Enterprise Platform</span><span>Synthetic development data only</span></footer>
    </main>
  );
}
