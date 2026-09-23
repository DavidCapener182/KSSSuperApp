import type { Principal, RoleCode } from "./principal";

export const CAPABILITIES = ["HOME", "PROFILE_SELF", "SITES_VIEW", "ACCESS_API_ADMIN", "DOCUMENT_REQUEST_CREATE", "DOCUMENT_SELF_READ", "DOCUMENT_SELF_SUBMIT", "DOCUMENT_OFFICE_REVIEW", "DOCUMENT_EVIDENCE_REVIEW", "TASK_SELF_READ", "ONBOARDING_SELF_READ", "ONBOARDING_OFFICE_READ"] as const;
export type Capability = (typeof CAPABILITIES)[number];

const ROLE_CAPABILITIES: Record<RoleCode, readonly Capability[]> = {
  SUPER_ADMIN: ["HOME", "PROFILE_SELF", "SITES_VIEW", "ACCESS_API_ADMIN", "DOCUMENT_REQUEST_CREATE", "DOCUMENT_OFFICE_REVIEW", "DOCUMENT_EVIDENCE_REVIEW", "TASK_SELF_READ", "ONBOARDING_OFFICE_READ"],
  OFFICE_ADMIN: ["HOME", "PROFILE_SELF", "SITES_VIEW", "DOCUMENT_REQUEST_CREATE", "DOCUMENT_OFFICE_REVIEW", "DOCUMENT_EVIDENCE_REVIEW", "TASK_SELF_READ", "ONBOARDING_OFFICE_READ"],
  OPERATIONS: ["HOME", "PROFILE_SELF"],
  SECURITY_STAFF: ["HOME", "PROFILE_SELF", "SITES_VIEW", "DOCUMENT_SELF_READ", "DOCUMENT_SELF_SUBMIT", "ONBOARDING_SELF_READ"],
};

export function capabilitiesFor(principal: Principal): Set<Capability> {
  return new Set(principal.roles.flatMap((role) => ROLE_CAPABILITIES[role]));
}

export function hasCapability(principal: Principal, capability: Capability): boolean {
  return capabilitiesFor(principal).has(capability);
}

export type NavigationItem = { href: "/app" | "/work" | "/sites" | "/documents" | "/onboarding" | "/profile"; label: string };

export function navigationFor(principal: Principal): NavigationItem[] {
  const allowed = capabilitiesFor(principal);
  const staffOnly = principal.roles.length === 1 && principal.roles[0] === "SECURITY_STAFF";
  return [
    { href: "/app" as const, label: staffOnly ? "My Work" : "Home", capability: "HOME" as const },
    { href: "/work" as const, label: "My Work", capability: "TASK_SELF_READ" as const },
    { href: "/sites" as const, label: "Sites", capability: "SITES_VIEW" as const },
    { href: "/documents" as const, label: "Documents", capability: "DOCUMENT_SELF_READ" as const },
    { href: "/onboarding" as const, label: staffOnly ? "My Onboarding" : "Onboarding", capability: staffOnly ? "ONBOARDING_SELF_READ" as const : "ONBOARDING_OFFICE_READ" as const },
    { href: "/profile" as const, label: "Profile", capability: "PROFILE_SELF" as const },
  ].filter((item) => item.href === "/documents"
    ? allowed.has("DOCUMENT_SELF_READ") || allowed.has("DOCUMENT_OFFICE_REVIEW")
    : allowed.has(item.capability)).map(({ href, label }) => ({ href, label }));
}
