const ALLOWED_PATHS = new Set(["/app", "/sites", "/profile", "/documents"]);

/** Accept only a known local application route and its optional query string. */
export function safeReturnTarget(value: unknown): string | null {
  if (typeof value !== "string" || !value || value.length > 2048 || value.trim() !== value) return null;
  if (!value.startsWith("/") || value.startsWith("//") || /[\\#\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value, "https://kss.invalid");
    if (url.origin !== "https://kss.invalid" ||
      !(ALLOWED_PATHS.has(url.pathname) || /^\/documents\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(url.pathname))) return null;
    if (!value.startsWith(url.pathname) || (value.length > url.pathname.length && value[url.pathname.length] !== "?")) return null;
    return url.pathname + url.search;
  } catch {
    return null;
  }
}
