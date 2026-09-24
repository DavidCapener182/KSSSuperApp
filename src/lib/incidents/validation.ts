const relationships = new Set(["MEMBER_OF_PUBLIC", "CLIENT_REPRESENTATIVE", "CONTRACTOR", "WITNESS", "OTHER"]);
export function isNeutralExternalDescriptor(value: unknown): value is string {
  if (typeof value !== "string" || value.trim().length < 2 || value.trim().length > 120 || /[\x00-\x1f\x7f]/.test(value)) return false;
  const text = value.trim();
  return !/(@|https?:\/\/|www\.|\+?[0-9][0-9 ()-]{6,})/i.test(text)
    && !/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(text)
    && !/\b\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}\b/.test(text)
    && !/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i.test(text)
    && !/\b\d{1,5}\s+(?:[a-z]+\s+)*(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|close|crescent|court|way|terrace)\b/i.test(text);
}
export function isExternalPartyList(value: unknown): value is { relationship: string; descriptor: string }[] {
  return Array.isArray(value) && value.length <= 3 && value.every((party) => party && typeof party === "object"
    && Object.keys(party).length === 2 && relationships.has(party.relationship)
    && isNeutralExternalDescriptor(party.descriptor));
}
