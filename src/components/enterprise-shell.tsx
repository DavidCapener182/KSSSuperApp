"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { BriefcaseBusiness, Building2, BookOpenText, ClipboardList, FileText, House, MapPin, Menu, PanelLeftClose, PanelLeftOpen, UserRound, UsersRound, CalendarDays, Bell, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "radix-ui";
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
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sidebarNavRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setCollapsed(window.localStorage.getItem("kss-sidebar-collapsed") === "true"));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const toggleCollapsed = () => setCollapsed((value) => {
    window.localStorage.setItem("kss-sidebar-collapsed", String(!value));
    return !value;
  });
  const bookNavigation = roles.some((role) => role === "SECURITY_STAFF" || role === "OPERATIONS" || role === "SUPER_ADMIN")
    ? [{ href: "/site-book", label: "Site Book" }] : [];
  const bookAccessNavigation = roles.some((role) => role === "OFFICE_ADMIN" || role === "SUPER_ADMIN")
    ? [{ href: "/site-book/access", label: "Site Book access" }] : [];
  const destinations = [...navigation, ...bookNavigation, ...bookAccessNavigation];
  const groupFor = (href: string) => {
    if (["/app", "/work", "/action-centre"].includes(href)) return "Overview";
    if (["/crm", "/sites", "/events", "/mobilisations", "/service-delivery", "/operational-contacts"].includes(href)) return "Clients & delivery";
    if (["/workforce", "/control-room", "/site-book", "/site-book/access", "/incidents", "/assets", "/management-reports"].includes(href)) return "Operations";
    if (["/people", "/onboarding", "/documents", "/time-away", "/access/incident-reviewers"].includes(href)) return "People & administration";
    if (href.startsWith("/my-") || href === "/profile") return "My account";
    return "Other";
  };
  const groups = ["Overview", "Clients & delivery", "Operations", "People & administration", "My account", "Other"]
    .map((label) => ({ label, items: destinations.filter((item) => groupFor(item.href) === label) }))
    .filter((group) => group.items.length > 0);
  const activeDestination = [...destinations].sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || (item.href !== "/app" && pathname.startsWith(`${item.href}/`)));
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      sidebarNavRef.current?.querySelector<HTMLElement>('a[aria-current="page"]')?.scrollIntoView({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, collapsed]);
  const current = (href: string) => pathname === href || (href === "/site-book" && pathname === "/site-book/access" ? false : href !== "/app" && pathname.startsWith(`${href}/`));
  const iconFor = (href: string) => {
    const Icon = href === "/app" ? House : href.startsWith("/site-book") ? BookOpenText : href === "/incidents" ? Siren : href === "/onboarding" ? ClipboardList : href === "/documents"
      ? FileText : href === "/action-centre" ? Bell : ["/my-schedule", "/my-deployments", "/my-availability", "/events", "/workforce"].includes(href) ? CalendarDays : href === "/work" ? BriefcaseBusiness : href === "/people" ? UsersRound : href === "/crm" ? Building2 : href === "/sites" ? MapPin : UserRound;
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

  const segments = pathname.split("/").filter(Boolean);
  const childContext = activeDestination && segments.length > activeDestination.href.split("/").filter(Boolean).length
    ? segments.slice(activeDestination.href.split("/").filter(Boolean).length) : [];
  const contextLabel = (segment: string) => segment === "id" ? "Record" : /^[0-9a-f]{8}-[0-9a-f-]{20,}$/i.test(segment) ? "Record" : segment.replaceAll("-", " ");

  return <div className={`enterprise-shell enterprise-shell-sidebar${collapsed ? " is-collapsed" : ""}`}>
    <a className="enterprise-skip-link" href="#enterprise-content">Skip to content</a>
    <aside className="enterprise-sidebar">
      <div className="enterprise-sidebar-brand"><Link className="enterprise-brand" href="/app"><span className="identity-mark" aria-hidden="true">K</span><span className="enterprise-brand-name">KSS <span>Enterprise</span></span></Link><button className="enterprise-collapse" type="button" onClick={toggleCollapsed} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} aria-expanded={!collapsed} title={collapsed ? "Expand navigation" : "Collapse navigation"}>{collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}</button></div>
      <Tooltip.Provider delayDuration={150}>
        <nav ref={sidebarNavRef} className="enterprise-nav" aria-label="Primary navigation">
          {groups.map((group) => <div className="enterprise-nav-group" role="group" aria-label={group.label} key={group.label}>
            <span className="enterprise-nav-group-label" aria-hidden="true">{group.label}</span>
            <div className="enterprise-nav-group-links">{group.items.map((item) => <Tooltip.Root key={item.href} open={collapsed ? undefined : false}>
              <Tooltip.Trigger asChild><Link href={item.href} aria-current={current(item.href) ? "page" : undefined} aria-label={collapsed ? item.label : undefined}>{iconFor(item.href)}<span className="enterprise-nav-label">{item.label}</span></Link></Tooltip.Trigger>
              <Tooltip.Portal><Tooltip.Content side="right" sideOffset={8} className="enterprise-nav-tooltip">{item.label}<Tooltip.Arrow className="enterprise-nav-tooltip-arrow" /></Tooltip.Content></Tooltip.Portal>
            </Tooltip.Root>)}</div>
          </div>)}
        </nav>
      </Tooltip.Provider>
      <div className="enterprise-sidebar-footer"><span>{environmentLabel}</span><span>Synthetic development data</span></div>
    </aside>
    <div className="enterprise-workspace">
    <header className="enterprise-header">
      <div className="enterprise-header-top">
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}><SheetTrigger asChild><button className="enterprise-drawer-trigger" type="button" aria-label="Open navigation"><Menu size={22} aria-hidden="true" /></button></SheetTrigger><SheetContent side="left" className="enterprise-mobile-sheet"><SheetHeader><SheetTitle>KSS Enterprise</SheetTitle><SheetDescription>{environmentLabel} · Synthetic development data</SheetDescription></SheetHeader><nav className="enterprise-mobile-sheet-links" aria-label="Mobile navigation">{groups.map((group) => <section key={group.label}><h3>{group.label}</h3>{group.items.map((item) => <Link key={item.href} href={item.href} onClick={() => setDrawerOpen(false)} aria-current={current(item.href) ? "page" : undefined}>{iconFor(item.href)}{item.label}</Link>)}</section>)}</nav><Button variant="outline" onClick={() => void signOut()} disabled={busy}>{busy ? "Signing out…" : "Sign out"}</Button></SheetContent></Sheet>
        <Link className="enterprise-brand enterprise-mobile-brand" href="/app"><span className="identity-mark" aria-hidden="true">K</span><span>KSS <span>Enterprise</span></span></Link>
        <span className="enterprise-environment">{environmentLabel}</span>
      </div>
      <div className="enterprise-user-row">
        <div className="enterprise-user"><strong>{person.name}</strong><span>{roles.map((role) => role.replaceAll("_", " ")).join(" · ")}</span></div>
        <Button className="enterprise-sign-out" variant="ghost" onClick={() => void signOut()} disabled={busy}>{busy ? "Signing out…" : "Sign out"}</Button>
      </div>
      {signOutError && <p className="enterprise-error" role="alert">{signOutError}</p>}
    </header>
    <div className="enterprise-context" aria-label="Page context"><Link href="/app">Home</Link>{activeDestination && activeDestination.href !== "/app" && <><span aria-hidden="true">/</span><Link href={activeDestination.href}>{activeDestination.label}</Link></>}{childContext.map((segment, index) => <span className="enterprise-context-segment" key={`${segment}-${index}`}><span aria-hidden="true">/</span><span>{contextLabel(segment)}</span></span>)}</div>
    <div id="enterprise-content" className="enterprise-content" tabIndex={-1}>{children}</div>
    <footer className="enterprise-footer">KSS Enterprise Platform · Synthetic development data only</footer>
    </div>
  </div>;
}
