type Row = Record<string, unknown>;
const row = (value: unknown): Row | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Row : null;
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const time = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));
const rows = (value: unknown) => Array.isArray(value) ? value.map(row).filter((item): item is Row => item !== null) : [];
export function trainingAdminShape(value: unknown): boolean {
  const data = row(value);
  return Boolean(data && ["requirements", "roles", "courses", "sites", "services", "grants"].every((key) => Array.isArray(data[key])) &&
    rows(data.requirements).length === (data.requirements as unknown[]).length && rows(data.requirements).every((item) => uuid(item.id) && typeof item.label === "string" &&
      Array.isArray(item.versions) && rows(item.versions).length === item.versions.length && rows(item.versions).every((version) => uuid(version.id) && Number.isInteger(version.number) &&
        ["DRAFT", "PUBLISHED", "ABANDONED"].includes(String(version.state)) && uuid(version.roleId) && uuid(version.courseVersionId) &&
        (version.siteId === null || uuid(version.siteId)) && (version.serviceId === null || uuid(version.serviceId)) && typeof version.effectiveFrom === "string") &&
      Array.isArray(item.events) && rows(item.events).length === item.events.length && rows(item.events).every((event) => uuid(event.versionId) && uuid(event.actorPersonId) &&
        typeof event.action === "string" && typeof event.reason === "string" && time(event.occurredAt))) &&
    ["roles", "courses", "sites", "services"].every((key) => rows(data[key]).length === (data[key] as unknown[]).length && rows(data[key]).every((choice) => uuid(choice.id))) &&
    rows(data.grants).length === (data.grants as unknown[]).length && rows(data.grants).every((grant) => uuid(grant.id) && uuid(grant.personId) &&
      ["AUTHOR", "PUBLISHER", "VIEWER"].includes(String(grant.capability)) && (grant.serviceId === null || uuid(grant.serviceId)) && time(grant.effectiveUntil) && (grant.revokedAt === null || time(grant.revokedAt))));
}
export function trainingActionAllowed(value: unknown, action: unknown): boolean {
  const rights = row(value);
  return Boolean(rights && ["author", "publisher", "viewer", "superAdmin", "staff"].every((key) => typeof rights[key] === "boolean") &&
    rights[action === "GRANT" || action === "REVOKE_GRANT" ? "superAdmin" : action === "PUBLISH" || action === "END" ? "publisher" : "author"] === true);
}
const contentKeys = ["roleId", "siteId", "serviceId", "courseVersionId", "priorEvidence", "effectiveFrom", "effectiveUntil"];
const same = (left: Row, right: Row, keys: string[]) => keys.every((key) => left[key] === right[key]);
export function trainingAdminReadback(beforeValue: unknown, afterValue: unknown, payload: Row, receipt: unknown): boolean {
  if (!trainingAdminShape(beforeValue) || !trainingAdminShape(afterValue)) return false;
  const before = row(beforeValue)!, after = row(afterValue)!, previousRequirements = rows(before.requirements), requirements = rows(after.requirements);
  if (payload.action === "GRANT" || payload.action === "REVOKE_GRANT") {
    const grant = rows(after.grants).find((item) => item.id === (payload.action === "GRANT" ? receipt : payload.grantId));
    if (!grant) return false;
    if (payload.action === "GRANT") return uuid(receipt) && !rows(before.grants).some((item) => item.id === receipt) && grant.personId === payload.personId &&
      grant.capability === payload.capability && grant.serviceId === payload.serviceId && grant.revokedAt === null &&
      time(payload.effectiveUntil) && Date.parse(String(grant.effectiveUntil)) === Date.parse(String(payload.effectiveUntil));
    const previous = rows(before.grants).find((item) => item.id === payload.grantId);
    return receipt === null && Boolean(previous && previous.revokedAt === null && time(grant.revokedAt) && same(previous, grant, ["personId", "capability", "serviceId", "effectiveUntil"]));
  }
  const previousRequirement = previousRequirements.find((item) => rows(item.versions).some((version) => version.id === (payload.previousVersionId ?? payload.versionId)));
  const previousVersion = rows(previousRequirement?.versions).find((version) => version.id === (payload.previousVersionId ?? payload.versionId));
  const requirement = requirements.find((item) => payload.action === "CREATE" ? item.id === receipt : item.id === previousRequirement?.id);
  if (!requirement) return false;
  const version = rows(requirement.versions).find((item) => item.id === (payload.action === "CREATE" ? rows(requirement.versions).find((entry) => entry.number === 1)?.id : payload.action === "REVISE" ? receipt : payload.versionId));
  if (!version) return false;
  const eventKind = payload.action === "PUBLISH" ? "PUBLISHED" : payload.action === "END" ? "ENDED" : "DRAFT_CREATED";
  const event = rows(requirement.events).find((item) => item.versionId === version.id && item.action === eventKind && item.reason === String(payload.reason).trim() &&
    !rows(previousRequirement?.events).some((old) => same(old, item, ["versionId", "action", "actorPersonId", "occurredAt", "reason"])));
  if (!event) return false;
  if (payload.action === "CREATE") return uuid(receipt) && !previousRequirements.some((item) => item.id === receipt) && requirement.label === String(payload.label).trim() &&
    version.number === 1 && version.state === "DRAFT" && same(version, payload, contentKeys);
  if (!previousVersion || requirement.label !== previousRequirement?.label) return false;
  if (payload.action === "REVISE") return uuid(receipt) && !rows(previousRequirement?.versions).some((item) => item.id === receipt) && previousVersion.state === "PUBLISHED" &&
    version.state === "DRAFT" && version.number === Math.max(...rows(previousRequirement?.versions).map((item) => Number(item.number))) + 1 &&
    same(version, previousVersion, ["roleId", "siteId", "serviceId"]) && same(version, payload, ["courseVersionId", "priorEvidence", "effectiveFrom", "effectiveUntil"]);
  if (payload.action === "PUBLISH") return receipt === payload.versionId && previousVersion.state === "DRAFT" && version.state === "PUBLISHED" &&
    same(version, previousVersion, ["number", ...contentKeys]) && typeof version.hash === "string" && /^[0-9a-f]{64}$/i.test(version.hash);
  return payload.action === "END" && receipt === null && previousVersion.state === "PUBLISHED" && !previousVersion.endedOn && version.state === "PUBLISHED" &&
    version.endedOn === payload.endOn && same(version, previousVersion, ["number", "hash", ...contentKeys]);
}
