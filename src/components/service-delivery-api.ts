export async function serviceRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Service Delivery request denied");
  return body;
}
export function london(instant: string | null | undefined) {
  return instant ? new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" }).format(new Date(instant)) : "None scheduled";
}
