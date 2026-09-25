"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { BriefcaseBusiness, Building2, BookOpenText, ClipboardList, FileText, House, MapPin, MoreHorizontal, UserRound, UsersRound, HeartHandshake, CalendarDays, Bell, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { NavigationItem } from "@/lib/auth/capabilities";
import type { RoleCode } from "@/lib/auth/principal";
import { environmentLabel } from "@/lib/environment-label";

const supabase = createBrowserSupabase();

type Props = Readonly<{
  person: { id: string; name: string };
  roles: RoleCode[];
  incidentReviewer: boolean;
  navigation: NavigationItem[];
  children: React.ReactNode;
}>;

export function EnterpriseShell({ person, roles, incidentReviewer, navigation, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const isStaff = roles.length === 1 && roles[0] === "SECURITY_STAFF";
  const bookNavigation = roles.some((role) => role === "SECURITY_STAFF" || role === "OPERATIONS" || role === "SUPER_ADMIN")
    ? [{ href: "/site-book", label: "Site Book" }] : [];
  const bookAccessNavigation = roles.some((role) => role === "OFFICE_ADMIN" || role === "SUPER_ADMIN")
    ? [{ href: "/site-book/access", label: "Site Book access" }] : [];
  const destinations = [...navigation, ...bookNavigation, ...bookAccessNavigation];
  const primaryDestinations = isStaff ? ["/app", "/incidents", "/my-schedule", "/action-centre"]
    : ["/app", "/incidents", "/onboarding", "/work"];
  const mobilePrimary = destinations.filter((item) => primaryDestinations.includes(item.href));
  const mobileSecondary = destinations.filter((item) => !primaryDestinations.includes(item.href));
  const current = (href: string) => pathname === href || (href === "/site-book" && pathname === "/site-book/access" ? false : href !== "/app" && pathname.startsWith(`${href}/`));
  const iconFor = (href: string) => {
    const Icon = href === "/app" ? House : href.startsWith("/site-book") ? BookOpenText : href === "/incidents" ? Siren : href === "/onboarding" ? ClipboardList : ["/documents", "/operational-documents"].includes(href)
      ? FileText : href === "/action-centre" ? Bell : ["/my-schedule", "/my-deployments", "/my-availability", "/events", "/workforce"].includes(href) ? CalendarDays : href === "/work" ? BriefcaseBusiness : href === "/people" ? UsersRound : href === "/hr" ? HeartHandshake : href === "/crm" ? Building2 : href === "/sites" ? MapPin : UserRound;
    return <Icon size={19} strokeWidth={1.9} aria-hidden="true" />;
  };

  const refreshAuthority = useCallback(async () => {
    try {
      const response = await fetch("/api/me", { cache: "no-store" });
      if (!response.ok) {
        window.location.replace(`/?next=${encodeURIComponent(pathname)}`);
        return;
      }
      const current = await response.json();
      if (current.person?.id !== person.id || JSON.stringify(current.roles) !== JSON.stringify(roles) || current.incidentReviewer !== incidentReviewer) router.refresh();
    } catch {
      // A later protected route/API request still fails closed on the server.
    }
  }, [pathname, person.id, roles, incidentReviewer, router]);

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
        <span className="enterprise-environment">{environmentLabel}</span>
      </div>
      <div className="enterprise-user-row">
        <div className="enterprise-user"><strong>{person.name}</strong><span>{roles.map((role) => role.replaceAll("_", " ")).join(" · ")}</span></div>
        <Button className="enterprise-sign-out" variant="ghost" onClick={() => void signOut()} disabled={busy}>{busy ? "Signing out…" : "Sign out"}</Button>
      </div>
      {signOutError && <p className="enterprise-error" role="alert">{signOutError}</p>}
      <nav className="enterprise-nav" aria-label="Primary navigation">
        {destinations.map((item) => <Link key={item.href} href={item.href} aria-current={current(item.href) ? "page" : undefined}>{iconFor(item.href)}{item.label}</Link>)}
      </nav>
    </header>
    {children}
    <nav className="enterprise-mobile-nav" aria-label="Mobile navigation">
      {mobilePrimary.map((item) => <Link key={item.href} href={item.href} aria-current={current(item.href) ? "page" : undefined}>
        {iconFor(item.href)}<span>{item.href === "/my-deployments" ? "Deployments" : item.label === "My Onboarding" ? "Onboarding" : item.label}</span>
      </Link>)}
      <Sheet><SheetTrigger asChild><button type="button" className="enterprise-mobile-more"><MoreHorizontal size={20} aria-hidden="true" /><span>More</span></button></SheetTrigger>
        <SheetContent side="bottom" className="enterprise-mobile-sheet">
          <SheetHeader><SheetTitle>More destinations</SheetTitle><SheetDescription>Signed in as {person.name} · Synthetic development data</SheetDescription></SheetHeader>
          <div className="enterprise-mobile-sheet-links">{mobileSecondary.map((item) => <Link key={item.href} href={item.href}>{iconFor(item.href)}{item.label}</Link>)}</div>
          <Button variant="outline" onClick={() => void signOut()} disabled={busy}>{busy ? "Signing out…" : "Sign out"}</Button>
        </SheetContent>
      </Sheet>
    </nav>
    <footer className="enterprise-footer">KSS Enterprise Platform · Synthetic development data only</footer>
  </div>;
}
