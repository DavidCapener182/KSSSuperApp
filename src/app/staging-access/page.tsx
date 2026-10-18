"use client";

import { useState, type FormEvent } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import styles from "@/components/entry.module.css";

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
      setMessage("This handoff is available only in the dedicated recovery environment."); setBusy(false); return;
    }
    const { data, error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: "recovery" });
    setCode("");
    if (error || data.user?.id !== userId || data.user?.email !== email) {
      await supabase.auth.signOut();
      setMessage("The one-time code could not be confirmed for the synthetic Staff recovery account.");
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
      setVerified(false); setMessage("The Staff recovery session is no longer valid. No password was changed."); setBusy(false); return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setNewPassword(""); setConfirmPassword("");
    if (error) setMessage(`Supabase rejected the password update: ${error.message}`);
    else {
      await supabase.auth.signOut(); setVerified(false);
      setMessage("Password changed for the synthetic Staff recovery account. You can now sign in to the KSS app from this phone.");
    }
    setBusy(false);
  }

  return <main className={styles.utility}>
    <p className={styles.eyebrow}>Restricted account recovery</p>
    <h1>Synthetic Staff account recovery</h1>
    <p>This temporary page is for <strong>{email}</strong> in the dedicated synthetic recovery environment only. It does not accept real staff information.</p>
    <p>Enter the one-time recovery code, then choose a password yourself. The password goes directly to Supabase Auth and is not stored in the repository, Vercel settings or the delivery report.</p>
    {message && <p className={styles.feedback} role="status">{message}</p>}
    {!verified ? <form onSubmit={verifyCode}>
      <label>One-time recovery code<Input type="text" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} required /></label>
      <p><Button type="submit" disabled={busy}>{busy ? "Checking…" : "Confirm code"}</Button></p>
    </form> : <form onSubmit={changePassword}>
      <p>The exact synthetic Staff account is confirmed. Enter your new password now.</p>
      <label>New password<Input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={12} /></label>
      <p><label>Confirm new password<Input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={12} /></label></p>
      <Button type="submit" disabled={busy}>{busy ? "Updating…" : "Change password"}</Button>
    </form>}
  </main>;
}
