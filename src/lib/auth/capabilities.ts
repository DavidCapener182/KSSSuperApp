import type { Principal, RoleCode } from "./principal";

export const CAPABILITIES = ["HOME", "PROFILE_SELF", "PEOPLE_DIRECTORY", "CRM_USE", "SITES_VIEW", "EVENTS_USE", "WORKFORCE_USE", "CONTROL_ROOM_USE", "MOBILISATIONS_USE", "ASSETS_USE", "MY_EQUIPMENT_SELF_READ", "DEPLOYMENTS_SELF_READ", "ACTION_CENTRE_SELF_READ", "AVAILABILITY_SELF_READ", "SCHEDULE_SELF_READ", "ACCESS_API_ADMIN", "DOCUMENT_REQUEST_CREATE", "DOCUMENT_SELF_READ", "DOCUMENT_SELF_SUBMIT", "DOCUMENT_OFFICE_REVIEW", "DOCUMENT_EVIDENCE_REVIEW", "TASK_SELF_READ", "ONBOARDING_SELF_READ", "ONBOARDING_OFFICE_READ"] as const;
export type Capability = (typeof CAPABILITIES)[number];

const ROLE_CAPABILITIES: Record<RoleCode, readonly Capability[]> = {
  SUPER_ADMIN: ["HOME", "PROFILE_SELF", "PEOPLE_DIRECTORY", "CRM_USE", "SITES_VIEW", "EVENTS_USE", "WORKFORCE_USE", "CONTROL_ROOM_USE", "MOBILISATIONS_USE", "ASSETS_USE", "ACCESS_API_ADMIN", "DOCUMENT_REQUEST_CREATE", "DOCUMENT_OFFICE_REVIEW", "DOCUMENT_EVIDENCE_REVIEW", "TASK_SELF_READ", "ONBOARDING_OFFICE_READ"],
  OFFICE_ADMIN: ["HOME", "PROFILE_SELF", "PEOPLE_DIRECTORY", "CRM_USE", "SITES_VIEW", "EVENTS_USE", "WORKFORCE_USE", "CONTROL_ROOM_USE", "MOBILISATIONS_USE", "ASSETS_USE", "DOCUMENT_REQUEST_CREATE", "DOCUMENT_OFFICE_REVIEW", "DOCUMENT_EVIDENCE_REVIEW", "TASK_SELF_READ", "ONBOARDING_OFFICE_READ"],
  OPERATIONS: ["HOME", "PROFILE_SELF", "PEOPLE_DIRECTORY", "SITES_VIEW", "EVENTS_USE", "WORKFORCE_USE", "CONTROL_ROOM_USE", "ASSETS_USE"],
  SECURITY_STAFF: ["HOME", "PROFILE_SELF", "SITES_VIEW", "DOCUMENT_SELF_READ", "DOCUMENT_SELF_SUBMIT", "ONBOARDING_SELF_READ", "DEPLOYMENTS_SELF_READ", "MY_EQUIPMENT_SELF_READ", "ACTION_CENTRE_SELF_READ", "AVAILABILITY_SELF_READ", "SCHEDULE_SELF_READ"],
};

export function capabilitiesFor(principal: Principal): Set<Capability> {
  return new Set(principal.roles.flatMap((role) => ROLE_CAPABILITIES[role]));
}

export function hasCapability(principal: Principal, capability: Capability): boolean {
  return capabilitiesFor(principal).has(capability);
}

export type NavigationItem = { href: "/app" | "/work" | "/people" | "/crm" | "/sites" | "/events" | "/mobilisations" | "/workforce" | "/control-room" | "/assets" | "/my-equipment" | "/my-schedule" | "/my-deployments" | "/my-work-time" | "/action-centre" | "/my-availability" | "/documents" | "/onboarding" | "/profile" | "/incidents" | "/access/incident-reviewers"; label: string };

export function navigationFor(principal: Principal): NavigationItem[] {
  const allowed = capabilitiesFor(principal);
  const staffOnly = principal.roles.length === 1 && principal.roles[0] === "SECURITY_STAFF";
  const links: NavigationItem[] = [
    { href: "/app" as const, label: staffOnly ? "My Work" : "Home", capability: "HOME" as const },
    { href: "/work" as const, label: "My Work", capability: "TASK_SELF_READ" as const },
    { href: "/people" as const, label: "People", capability: "PEOPLE_DIRECTORY" as const },
    { href: "/crm" as const, label: "CRM", capability: "CRM_USE" as const },
    { href: "/sites" as const, label: "Sites", capability: "SITES_VIEW" as const },
    { href: "/events" as const, label: "Events", capability: "EVENTS_USE" as const },
    { href: "/mobilisations" as const, label: "Mobilisations", capability: "MOBILISATIONS_USE" as const },
    { href: "/workforce" as const, label: "Workforce", capability: "WORKFORCE_USE" as const },
    { href: "/control-room" as const, label: "Control Room", capability: "CONTROL_ROOM_USE" as const },
    { href: "/assets" as const, label: "Assets", capability: "ASSETS_USE" as const },
    { href: "/my-schedule" as const, label: "My Schedule", capability: "SCHEDULE_SELF_READ" as const },
    { href: "/my-deployments" as const, label: "My Deployments", capability: "DEPLOYMENTS_SELF_READ" as const },
    { href: "/my-equipment" as const, label: "My Equipment", capability: "MY_EQUIPMENT_SELF_READ" as const },
    { href: "/my-work-time" as const, label: "My Worked Time", capability: "DEPLOYMENTS_SELF_READ" as const },
    { href: "/action-centre" as const, label: "Action Centre", capability: "ACTION_CENTRE_SELF_READ" as const },
    { href: "/my-availability" as const, label: "My Availability", capability: "AVAILABILITY_SELF_READ" as const },
    { href: "/documents" as const, label: "Documents", capability: "DOCUMENT_SELF_READ" as const },
    { href: "/onboarding" as const, label: staffOnly ? "My Onboarding" : "Onboarding", capability: staffOnly ? "ONBOARDING_SELF_READ" as const : "ONBOARDING_OFFICE_READ" as const },
    { href: "/profile" as const, label: "Profile", capability: "PROFILE_SELF" as const },
  ].filter((item) => item.href === "/documents"
    ? allowed.has("DOCUMENT_SELF_READ") || allowed.has("DOCUMENT_OFFICE_REVIEW")
    : allowed.has(item.capability)).map(({ href, label }) => ({ href, label }));
  if (principal.roles.includes("SECURITY_STAFF") || principal.incidentReviewer || principal.roles.includes("SUPER_ADMIN")) {
    links.push({ href: "/incidents", label: principal.roles.includes("SECURITY_STAFF") ? "Report incident" : "Incidents" });
  }
  if (principal.roles.includes("SUPER_ADMIN")) links.push({ href: "/access/incident-reviewers", label: "Incident reviewers" });
  return links;
}
