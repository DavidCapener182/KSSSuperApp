"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { NavigationItem } from "@/lib/auth/capabilities";
import type { RoleCode } from "@/lib/auth/principal";

const supabase = createBrowserSupabase();

type Props = Readonly<{
  person: { id: string; name: string };
  roles: RoleCode[];
  navigation: NavigationItem[];
  children: React.ReactNode;
}>;

export function EnterpriseShell({ person, roles, navigation, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  const refreshAuthority = useCallback(async () => {
    try {
      const response = await fetch("/api/me", { cache: "no-store" });
      if (!response.ok) {
        window.location.replace(`/?next=${encodeURIComponent(pathname)}`);
        return;
      }
      const current = await response.json();
      if (current.person?.id !== person.id || JSON.stringify(current.roles) !== JSON.stringify(roles)) router.refresh();
    } catch {
      // A later protected route/API request still fails closed on the server.
    }
  }, [pathname, person.id, roles, router]);

  useEffect(() => {
    void refreshAuthority();
  }, [refreshAuthority]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") void refreshAuthority(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshAuthority]);

  async function signOut() {
    setBusy(true); setSignOutError("");
    const { error } = await supabase.auth.signOut();
    if (error) { setSignOutError("Sign-out failed. Please try again."); setBusy(false); return; }
    window.location.replace("/");
  }

  return <div className="enterprise-shell">
    <header className="enterprise-header">
      <div className="enterprise-header-top">
        <Link className="enterprise-brand" href="/app"><span className="identity-mark" aria-hidden="true">K</span><span>KSS <span>Enterprise</span></span></Link>
        <span className="enterprise-environment">Development</span>
      </div>
      <div className="enterprise-user-row">
        <div className="enterprise-user"><strong>{person.name}</strong><span>{roles.map((role) => role.replaceAll("_", " ")).join(" · ")}</span></div>
        <button className="enterprise-sign-out" onClick={() => void signOut()} disabled={busy}>{busy ? "Signing out…" : "Sign out"}</button>
      </div>
      {signOutError && <p className="enterprise-error" role="alert">{signOutError}</p>}
      <nav className="enterprise-nav" aria-label="Primary navigation">
        {navigation.map((item) => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}>{item.label}</Link>)}
      </nav>
    </header>
    {children}
    <footer className="enterprise-footer">KSS Enterprise Platform · Synthetic development data only</footer>
  </div>;
}
