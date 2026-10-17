"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { environmentLabel, isStaging } from "@/lib/environment-label";

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

  return <main className="shell entry-shell">
    <header className="shell-header" aria-label="KSS Enterprise Platform">
      <div className="identity"><span className="identity-mark" aria-hidden="true">K</span><span className="identity-name">KSS <span>Enterprise Platform</span></span></div>
      <span className="phase-label">{environmentLabel}</span>
    </header>
    <section className="welcome" aria-labelledby="welcome-title">
      <div className="welcome-copy"><p className="eyebrow">KSS Enterprise</p>
        <h1 id="welcome-title">One workspace.<br/>Every operation.</h1>
        <p className="lead">The people, places and work behind KSS. Your authorised tools, together in one place.</p>
        <div className="entry-index" aria-label="Workspace overview"><p><span>01</span><strong>Plan the day<small>Workforce & duties</small></strong></p><p><span>02</span><strong>Move work forward<small>Tasks & operational records</small></strong></p><p><span>03</span><strong>Keep the context<small>People, clients & delivery</small></strong></p></div>
        <p className="entry-boundary">Access to records and actions is checked against your role. Each workflow shows its current integration status.</p>
      </div>
      <div className="welcome-access">
      <div className="entry-form-heading"><p className="eyebrow">Your KSS account</p><h2>Welcome back.</h2><p>Sign in to the {isStaging ? "staging" : "development"} workspace.</p></div>
      {message && state !== "unauthenticated" && <p className="access-status entry-message" role="alert">{message}</p>}
      {state === "checking" && <p className="access-status" role="status">Checking your sign-in…</p>}
      {state === "unauthenticated" && <form className="access-panel" onSubmit={signIn}>
        <h3>Sign in</h3>
        {message && <p id="sign-in-message" className="entry-message" role="alert">{message}</p>}
        <label>Email<Input aria-describedby={message ? "sign-in-message" : undefined} type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Password<Input aria-describedby={message ? "sign-in-message" : undefined} type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <p className="entry-form-note">Use your authorised account. Your password is cleared after each attempt.</p>
        <Button type="submit" disabled={busy}>{busy ? "Signing in…" : `Sign in to ${isStaging ? "staging" : "development"}`}</Button>
      </form>}
      {state === "no_enterprise_access" && <div className="access-panel" role="status">
        <h2>No Enterprise access</h2>
        <p>Your account is signed in, but it does not currently have access to KSS Enterprise.</p>
        <Button type="button" onClick={() => void signOut()} disabled={busy}>{busy ? "Signing out…" : "Sign out"}</Button>
      </div>}
      {state === "unavailable" && <div className="access-panel" role="status"><h2>Access check unavailable</h2><p>We could not confirm your Enterprise access. Please retry.</p><Button type="button" onClick={() => void inspectAccess()}>Retry access check</Button></div>}
      </div>
    </section>
    <footer className="shell-footer"><span>KSS Enterprise Platform</span><span>{environmentLabel} workspace</span></footer>
  </main>;
}
