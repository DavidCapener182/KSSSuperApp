const ALLOWED_PATHS = new Set(["/app", "/work", "/sites", "/events", "/workforce", "/my-schedule", "/my-deployments", "/my-work-time", "/my-attendance", "/my-availability", "/action-centre", "/profile", "/documents", "/onboarding", "/people", "/incidents", "/access/incident-reviewers", "/site-book", "/site-book/access"]);

/** Accept only a known local application route and its optional query string. */
export function safeReturnTarget(value: unknown): string | null {
  if (typeof value !== "string" || !value || value.length > 2048 || value.trim() !== value) return null;
  if (!value.startsWith("/") || value.startsWith("//") || /[\\#\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value, "https://kss.invalid");
    if (url.origin !== "https://kss.invalid" ||
      !(ALLOWED_PATHS.has(url.pathname) || /^\/(documents|work|onboarding|people|events|incidents|site-book)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(url.pathname) || /^\/events\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(attendance|work-time)$/i.test(url.pathname))) return null;
    if (!value.startsWith(url.pathname) || (value.length > url.pathname.length && value[url.pathname.length] !== "?")) return null;
    return url.pathname + url.search;
  } catch {
    return null;
  }
}
