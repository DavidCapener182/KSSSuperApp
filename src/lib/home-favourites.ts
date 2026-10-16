export type FavouriteModule = { href: string; label: string };
export const MAX_FAVOURITES = 64;
const modulePath = /^\/[a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)*$/;

export function favouriteModules(entries: readonly FavouriteModule[]): FavouriteModule[] {
  const seen = new Set<string>();
  return entries.filter(({ href }) => href !== "/app" && modulePath.test(href) && !seen.has(href) && Boolean(seen.add(href))).slice(0, MAX_FAVOURITES);
}

export function favouritesKey(accountId: string): string | null {
  return /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(accountId)
    ? `kss-home-favourites:v1:${accountId.toLowerCase()}` : null;
}

export function allowedFavourites(value: unknown, entries: readonly FavouriteModule[]): string[] {
  if (!Array.isArray(value) || value.length > MAX_FAVOURITES) return [];
  const allowed = new Set(favouriteModules(entries).map(entry => entry.href));
  return [...new Set(value.filter((href): href is string => typeof href === "string" && allowed.has(href)))];
}

export function readFavourites(raw: string | null, entries: readonly FavouriteModule[]): string[] {
  if (!raw || raw.length > 8192) return [];
  try { return allowedFavourites(JSON.parse(raw), entries); } catch { return []; }
}
