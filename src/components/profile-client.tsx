"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { FeedbackBanner, PageHeader } from "@/components/ui/workflow";
import { PROFILE_FIELDS, SIA_CATEGORIES, SIA_LABELS, type ProfileField, type SiaCategory } from "@/lib/profile/policy";

type ProfileValues = Record<ProfileField, string>;
type Credential = { category: SiaCategory; synthetic_reference: string | null; expires_on: string | null };
type Case = { id: string; templateVersion: number; state: string; requirements: { code: string; state: string; nextAction: string }[] };
const emptyProfile = Object.fromEntries(PROFILE_FIELDS.map((field) => [field, ""])) as ProfileValues;
const fieldLabels: Record<ProfileField, string> = {
  legal_first_name: "Legal first name", surname: "Surname", preferred_name: "Preferred name",
  contact_email: "Contact email", mobile: "Mobile number", address_line1: "Home address line 1",
  address_line2: "Address line 2", town_city: "Town or city", postcode: "Postcode",
};
const required = new Set<ProfileField>(["legal_first_name", "surname", "contact_email", "mobile", "address_line1", "town_city", "postcode"]);

export function ProfileClient() {
  const [values, setValues] = useState<ProfileValues>(emptyProfile);
  const [category, setCategory] = useState<SiaCategory>("SECURITY_GUARDING");
  const [reference, setReference] = useState("");
  const [expiry, setExpiry] = useState("");
  const [signInEmail, setSignInEmail] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [cases, setCases] = useState<{ id: string; templateVersion: number; state: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const [profileResponse, casesResponse] = await Promise.all([
        fetch("/api/profile", { cache: "no-store" }),
        fetch("/api/onboarding", { cache: "no-store" }),
      ]);
      if (!profileResponse.ok || !casesResponse.ok) throw new Error("Unavailable");
      const profileData = await profileResponse.json();
      const listing = await casesResponse.json();
      const available = listing.cases ?? [];
      setCases(available);
      setValues(Object.fromEntries(PROFILE_FIELDS.map((field) => [field, profileData.profile?.[field] ?? ""])) as ProfileValues);
      const credential = (profileData.credentials as Credential[]).find((item) => item.category === "SECURITY_GUARDING");
      if (credential) { setCategory(credential.category); setReference(credential.synthetic_reference ?? ""); setExpiry(credential.expires_on ?? ""); }
      setSignInEmail(profileData.signInEmail);
      const current = available.find((item: { templateVersion: number; state: string }) => item.templateVersion >= 2 && item.state === "IN_PROGRESS");
      if (current) {
        const response = await fetch(`/api/onboarding/${current.id}`, { cache: "no-store" });
        setSelectedCase(response.ok ? (await response.json()).case : null);
      } else setSelectedCase(null);
    } catch { setMessage("Profile could not be loaded. Refresh to try again."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void Promise.resolve().then(() => load()); }, [load]);

  async function saveProfile() {
    setBusy(true); setMessage(""); setErrors({});
    try {
      const response = await fetch("/api/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(values) });
      if (!response.ok) {
        const result = await response.json();
        setErrors(result.fields ?? {});
        throw new Error(result.error ?? "Save denied");
      }
      await load();
      setMessage("Personal Details draft saved. Submit them for the onboarding case when ready.");
      return true;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Save failed."); return false; }
    finally { setBusy(false); }
  }
  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCase || !(await saveProfile())) return;
    setBusy(true);
    try {
      const response = await fetch("/api/profile/submissions", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId: selectedCase.id, requestKey: crypto.randomUUID() }) });
      if (!response.ok) throw new Error("Complete every required field before submitting.");
      await load(); setMessage("Personal Details submitted for this case. This is self-submission, not identity verification.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Submission failed."); }
    finally { setBusy(false); }
  }
  async function saveSia() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/profile/sia", { method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ category, reference, expiresOn: expiry || null }) });
      if (!response.ok) throw new Error("Check the synthetic reference and expiry date.");
      await load(); setMessage("Synthetic SIA details saved as a draft.");
      return true;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Save failed."); return false; }
    finally { setBusy(false); }
  }
  async function submitSia(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (category !== "SECURITY_GUARDING") {
      setMessage("This pilot requires synthetic Security Guarding details. Other categories are not interchangeable.");
      return;
    }
    if (!selectedCase || !(await saveSia())) return;
    setBusy(true);
    try {
      const response = await fetch("/api/profile/sia/submissions", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId: selectedCase.id, category, requestKey: crypto.randomUUID() }) });
      if (!response.ok) throw new Error("A synthetic Security Guarding reference and future expiry are required.");
      await load(); setMessage("Synthetic SIA details submitted. Office must now request evidence and make a separate verification decision.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Submission failed."); }
    finally { setBusy(false); }
  }
  const profileState = selectedCase?.requirements.find((item) => item.code === "PERSONAL_DETAILS");
  const siaState = selectedCase?.requirements.find((item) => item.code === "SIA_LICENCE");
  return <main className="enterprise-main profile-main">
    <PageHeader eyebrow="Synthetic development onboarding" title="My Profile"
      description="Keep your Personal Details current and submit them for your onboarding case. Synthetic SIA details use a separate evidence workflow." />
    <FeedbackBanner>Contact email is separate from your sign-in account. Saving this form does not change your authentication email or verify your identity.</FeedbackBanner>
    {message && <FeedbackBanner tone={/failed|could not|denied|required|requires|not interchangeable|Check|Complete/.test(message) ? "error" : "success"}>{message}</FeedbackBanner>}
    {loading ? <p role="status">Loading Profile…</p> : <>
      <div className="profile-context">
        <span>Sign-in account: <strong>{signInEmail ?? "Not displayed"}</strong></span>
        {selectedCase ? <Link href={`/onboarding/${selectedCase.id}`}>Open Template V{selectedCase.templateVersion} onboarding</Link> :
          <span>No active Template V2 case. Drafts can be saved; submission requires an active case.</span>}
      </div>
      <div className="profile-grid">
        <section className="profile-card" aria-labelledby="details-title">
          <div className="profile-card-heading"><div><p className="eyebrow">Staff self-service</p><h2 id="details-title">Personal Details</h2></div>
            <span className="onboarding-state">{profileState?.state.replaceAll("_", " ").toLowerCase() ?? "Draft"}</span></div>
          <p>{profileState?.nextAction ?? "Save your details as a draft until a V2 case is available."}</p>
          <form className="profile-form" onSubmit={(event) => void submitProfile(event)}>
            {PROFILE_FIELDS.map((field) => <label key={field} className="ui-field">{fieldLabels[field]}{required.has(field) ? " *" : " (optional)"}
              <input value={values[field]} autoComplete={field === "contact_email" ? "email" : field === "mobile" ? "tel" : "off"}
                type={field === "contact_email" ? "email" : field === "mobile" ? "tel" : "text"}
                maxLength={field === "contact_email" ? 254 : field.startsWith("address") ? 160 : 100}
                onChange={(event) => setValues((previous) => ({ ...previous, [field]: event.target.value }))} aria-invalid={Boolean(errors[field])} />
              {errors[field] && <small className="profile-field-error">{errors[field]}</small>}</label>)}
            <div className="profile-actions"><button type="button" className="ui-action ui-action--secondary" disabled={busy} onClick={() => void saveProfile()}>Save draft</button>
              <button type="submit" className="ui-action" disabled={busy || !selectedCase}>Submit for onboarding</button></div>
          </form>
          <p className="ui-help">Complete means required data was self-submitted. It does not mean identity, email ownership or address was verified.</p>
        </section>
        <section className="profile-card" aria-labelledby="sia-title">
          <div className="profile-card-heading"><div><p className="eyebrow">Synthetic credential</p><h2 id="sia-title">SIA details</h2></div>
            <span className="onboarding-state">{siaState?.state.replaceAll("_", " ").toLowerCase() ?? "Draft"}</span></div>
          <p>{siaState?.nextAction ?? "Enter synthetic details for an active Template V2 case."}</p>
          <form className="profile-form" onSubmit={(event) => void submitSia(event)}>
            <label className="ui-field">Licence category
              <select value={category} onChange={(event) => setCategory(event.target.value as SiaCategory)}>
                {SIA_CATEGORIES.map((item) => <option key={item} value={item}>{SIA_LABELS[item]}</option>)}
              </select></label>
            <label className="ui-field">Clearly synthetic reference
              <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="SYN-SIA-03B-A" maxLength={48} /></label>
            <label className="ui-field">Synthetic expiry date
              <input type="date" value={expiry} onChange={(event) => setExpiry(event.target.value)} /></label>
            <p className="ui-help">This pilot expects Security Guarding. Other categories are controlled values for future use and do not imply equivalence. Expiry is current through the displayed Europe/London date.</p>
            <div className="profile-actions"><button type="button" className="ui-action ui-action--secondary" disabled={busy} onClick={() => void saveSia()}>Save draft</button>
              <button type="submit" className="ui-action" disabled={busy || !selectedCase || category !== "SECURITY_GUARDING"}>Submit synthetic details</button></div>
          </form>
          <p className="ui-help">Office requests private evidence and separately records a synthetic verification. No SIA register check or authenticity claim is made.</p>
        </section>
      </div>
      {cases.length > 1 && <p className="ui-help">Your historical cases remain separate. Open <Link href="/onboarding">My Onboarding</Link> to distinguish Template V1 and V2.</p>}
    </>}
  </main>;
}
