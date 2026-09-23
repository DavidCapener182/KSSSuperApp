"use client";

import { useState, type FormEvent } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const email = "kss-stage.staff@example.test";
const userId = "48c25c2a-d902-4ca9-bdfe-ffc1aaf01cb3";
const projectUrl = "https://kwpgjbxepxuhwxxydaca.supabase.co";
const supabase = createBrowserSupabase();

export default function StagingAccess() {
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    if (process.env.NEXT_PUBLIC_KSS_STAGE !== "staging" || process.env.NEXT_PUBLIC_SUPABASE_URL !== projectUrl) {
      setMessage("This handoff is available only in the dedicated staging environment."); setBusy(false); return;
    }
    const { data, error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: "recovery" });
    setCode("");
    if (error || data.user?.id !== userId || data.user?.email !== email) {
      await supabase.auth.signOut();
      setMessage("The one-time code could not be confirmed for the synthetic Staff staging account.");
    } else setVerified(true);
    setBusy(false);
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    if (newPassword.length < 12 || newPassword !== confirmPassword) {
      setMessage("Use at least 12 characters and enter the same password twice."); return;
    }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id !== userId || user.email !== email) {
      setVerified(false); setMessage("The Staff staging session is no longer valid. No password was changed."); setBusy(false); return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setNewPassword(""); setConfirmPassword("");
    if (error) setMessage(`Supabase rejected the password update: ${error.message}`);
    else {
      await supabase.auth.signOut(); setVerified(false);
      setMessage("Password changed for the synthetic Staff staging account. You can now sign in to the protected staging app from this phone.");
    }
    setBusy(false);
  }

  return <main style={{ maxWidth: 520, margin: "48px auto", padding: 24, fontFamily: "system-ui", lineHeight: 1.5 }}>
    <h1>Synthetic Staff staging access</h1>
    <p>This temporary page is for <strong>{email}</strong> in KSS Enterprise - Staging only. It does not accept real staff information.</p>
    <p>Enter the one-time recovery code, then choose a password yourself. The password goes directly to Supabase Auth and is not stored in the repository, Vercel settings or the delivery report.</p>
    {message && <p role="status">{message}</p>}
    {!verified ? <form onSubmit={verifyCode}>
      <label>One-time recovery code<br /><input type="text" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} required style={{ width: "100%", minHeight: 44 }} /></label>
      <p><button type="submit" disabled={busy} style={{ minHeight: 44 }}>{busy ? "Checking…" : "Confirm code"}</button></p>
    </form> : <form onSubmit={changePassword}>
      <p>The exact synthetic Staff account is confirmed. Enter your new password now.</p>
      <label>New password<br /><input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={12} style={{ width: "100%", minHeight: 44 }} /></label>
      <p><label>Confirm new password<br /><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={12} style={{ width: "100%", minHeight: 44 }} /></label></p>
      <button type="submit" disabled={busy} style={{ minHeight: 44 }}>{busy ? "Updating…" : "Change password"}</button>
    </form>}
  </main>;
}
