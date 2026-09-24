import type { RoleCode } from "@/lib/auth/principal";

const HOST_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

const APPS = [
  {
    id: "magsecure",
    name: "MagSecure",
    roles: ["SUPER_ADMIN", "OFFICE_ADMIN", "OPERATIONS", "SECURITY_STAFF"],
    urlVariable: "KSS_MAGSECURE_URL",
  },
  {
    id: "footasylum-audits",
    name: "Footasylum Audits",
    roles: ["SUPER_ADMIN", "OFFICE_ADMIN", "OPERATIONS"],
    urlVariable: "KSS_FOOTASYLUM_AUDITS_URL",
  },
  {
    id: "training",
    name: "Training",
    roles: ["SUPER_ADMIN", "OFFICE_ADMIN", "OPERATIONS", "SECURITY_STAFF"],
    urlVariable: "KSS_TRAINING_URL",
  },
] as const satisfies readonly { id: string; name: string; roles: readonly RoleCode[]; urlVariable: string }[];

export type ExternalAppShortcut = Readonly<{
  id: (typeof APPS)[number]["id"];
  name: string;
  href: string | null;
}>;

type ExternalAppEnvironment = Readonly<Record<string, string | undefined>>;

function configuredHref(value: string | undefined): string | null {
  if (!value || value !== value.trim()) return null;
  if (value.includes("?") || value.includes("#")) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.port) return null;
    if (!HOST_PATTERN.test(url.hostname) || url.search || url.hash) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function externalAppShortcutsForRoles(
  roles: readonly RoleCode[],
  environment: ExternalAppEnvironment = process.env,
): ExternalAppShortcut[] {
  const activeRoles = new Set(roles);
  return APPS.filter((app) => app.roles.some((role) => activeRoles.has(role))).map((app) => ({
    id: app.id,
    name: app.name,
    href: configuredHref(environment[app.urlVariable]),
  }));
}
