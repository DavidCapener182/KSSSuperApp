"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const supabase = createBrowserSupabase();
type EntryState = "checking" | "unauthenticated" | "no_enterprise_access" | "unavailable";

export function SignInEntry({ returnTarget }: { returnTarget: string }) {
  const [state, setState] = useState<EntryState>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const inspectAccess = useCallback(async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) { setState("unauthenticated"); return; }
    try {
      const response = await fetch("/api/me", { cache: "no-store" });
      if (response.ok) { window.location.replace(returnTarget); return; }
      setState(response.status === 403 ? "no_enterprise_access" : response.status === 401 ? "unauthenticated" : "unavailable");
    } catch { setState("unavailable"); }
  }, [returnTarget]);

  useEffect(() => { void supabase.auth.getUser().then(() => inspectAccess()); }, [inspectAccess]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setPassword("");
    if (error) { setState("unauthenticated"); setMessage("Sign-in failed. Check the development account details."); }
    else await inspectAccess();
    setBusy(false);
  }

  async function signOut() {
    setBusy(true); setMessage("");
    const { error } = await supabase.auth.signOut();
    if (error) { setMessage("Sign-out failed. Please try again."); setBusy(false); return; }
    setEmail(""); setPassword(""); setState("unauthenticated"); setBusy(false);
  }

  return <main className="shell">
    <header className="shell-header" aria-label="KSS Enterprise Platform">
      <div className="identity"><span className="identity-mark" aria-hidden="true">K</span><span className="identity-name">KSS <span>Enterprise Platform</span></span></div>
      <span className="phase-label">Development</span>
    </header>
    <section className="welcome" aria-labelledby="welcome-title">
      <p className="eyebrow">KSS Enterprise</p>
      <h1 id="welcome-title">A secure place to start.</h1>
      <p className="lead">Sign in to your development workspace. Operational systems and live staff data are not connected.</p>
      <div className="notice"><span className="notice-dot" aria-hidden="true" /><div><strong>Development accounts only</strong><p>Use synthetic test accounts. This is not an operational dashboard.</p></div></div>
      {message && <p className="access-status" role="alert">{message}</p>}
      {state === "checking" && <p className="access-status" role="status">Checking your sign-in…</p>}
      {state === "unauthenticated" && <form className="access-panel" onSubmit={signIn}>
        <h2>Sign in</h2>
        <label>Email<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in to development"}</button>
      </form>}
      {state === "no_enterprise_access" && <div className="access-panel" role="status">
        <h2>No Enterprise access</h2>
        <p>Your account is signed in, but it does not currently have access to KSS Enterprise.</p>
        <button type="button" onClick={() => void signOut()} disabled={busy}>{busy ? "Signing out…" : "Sign out"}</button>
      </div>}
      {state === "unavailable" && <div className="access-panel" role="status"><h2>Access check unavailable</h2><p>We could not confirm your Enterprise access. Please retry.</p><button type="button" onClick={() => void inspectAccess()}>Retry access check</button></div>}
    </section>
    <footer className="shell-footer"><span>KSS Enterprise Platform</span><span>Synthetic development data only</span></footer>
  </main>;
}
