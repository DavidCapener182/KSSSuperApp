"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { environmentLabel } from "@/lib/environment-label";
import styles from "./entry.module.css";

const supabase = createBrowserSupabase();
type EntryState = "checking" | "unauthenticated" | "no_enterprise_access" | "unavailable";

export function SignInEntry({ returnTarget }: { returnTarget: string }) {
  const [state, setState] = useState<EntryState>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    if (error) { setState("unauthenticated"); setMessage("Sign-in failed. Check your account details."); }
    else await inspectAccess();
    setBusy(false);
  }

  async function signOut() {
    setBusy(true); setMessage("");
    const { error } = await supabase.auth.signOut();
    if (error) { setMessage("Sign-out failed. Please try again."); setBusy(false); return; }
    setEmail(""); setPassword(""); setState("unauthenticated"); setBusy(false);
  }

  return <main className={styles.page}>
    <header className={styles.header} aria-label="KSS Enterprise Platform">
      <div className={styles.identity}><span className="identity-mark" aria-hidden="true">K</span><span>KSS <span>Enterprise Platform</span></span></div>
      <span className={styles.environment}>{environmentLabel}</span>
    </header>
    <section className={styles.content} aria-labelledby="welcome-title">
      <div className={styles.copy}><p className={styles.eyebrow}>KSS Enterprise</p>
        <h1 id="welcome-title">Your KSS workspace.</h1>
        <p className={styles.lead}>Plan duties, continue assigned work and review operational records with the people and context you need.</p>
        <p className={styles.boundary}>Access to records and actions is checked against your role. Each workflow shows its current integration status.</p>
      </div>
      <div className={styles.access}>
      <div className={styles.heading}><h2>Sign in to KSS</h2><p>Your authorised KSS account.</p></div>
      {message && state !== "unauthenticated" && <p className={styles.feedback} role="alert">{message}</p>}
      {state === "checking" && <p className={styles.status} role="status">Checking your sign-in…</p>}
      {state === "unauthenticated" && <form className={styles.form} onSubmit={signIn}>
        <h3>Sign in</h3>
        {message && <p id="sign-in-message" className={styles.feedback} role="alert">{message}</p>}
        <label>Email<Input aria-describedby={message ? "sign-in-message" : undefined} type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <div><label htmlFor="sign-in-password">Password</label><div className={styles.password}><Input id="sign-in-password" aria-describedby={message ? "sign-in-message" : undefined} type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /><Button type="button" variant="outline" aria-pressed={showPassword} aria-controls="sign-in-password" onClick={() => setShowPassword(value => !value)}>{showPassword ? "Hide" : "Show"}<span className="sr-only"> password</span></Button></div></div>
        <p className={styles.note}>Use your authorised account. Your password is cleared after each attempt.</p>
        <Button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in to KSS"}</Button>
      </form>}
      {state === "no_enterprise_access" && <div className={styles.status} role="status">
        <h2>No Enterprise access</h2>
        <p>Your account is signed in, but it does not currently have access to KSS Enterprise.</p>
        <Button type="button" onClick={() => void signOut()} disabled={busy}>{busy ? "Signing out…" : "Sign out"}</Button>
      </div>}
      {state === "unavailable" && <div className={styles.status} role="status"><h2>Access check unavailable</h2><p>We could not confirm your Enterprise access. Please retry.</p><Button type="button" onClick={() => void inspectAccess()}>Retry access check</Button></div>}
      </div>
    </section>
    <footer className={styles.footer}><span>KSS Enterprise Platform</span><span>{environmentLabel} workspace</span></footer>
  </main>;
}
