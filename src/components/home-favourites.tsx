"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { allowedFavourites, favouriteModules, favouritesKey, readFavourites, type FavouriteModule } from "@/lib/home-favourites";
import styles from "./home-favourites.module.css";

type Selection = { account: string; paths: string[]; ready: boolean; persistent: boolean };

export function HomeFavourites({ accountId, entries }: { accountId: string; entries: FavouriteModule[] }) {
  const modules = favouriteModules(entries);
  const [selection, setSelection] = useState<Selection>({ account: accountId, paths: [], ready: false, persistent: false });
  const owned = selection.account === accountId;
  const paths = owned ? allowedFavourites(selection.paths, modules) : [];
  const ready = owned && selection.ready;
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const key = favouritesKey(accountId);
    const load = () => {
      let saved: string[] = []; let persistent = false;
      if (key) {
        try {
          const raw = window.localStorage.getItem(key);
          saved = readFavourites(raw, entries);
          // Prune removed modules so a later role change cannot restore stale choices.
          if (raw !== null && raw !== JSON.stringify(saved)) window.localStorage.setItem(key, JSON.stringify(saved));
          persistent = true;
        } catch { /* The picker remains usable for this visit. */ }
      }
      setSelection({ account: accountId, paths: saved, ready: true, persistent });
      setNotice("");
    };
    const frame = window.requestAnimationFrame(load);
    const onStorage = (event: StorageEvent) => { if (event.key === key || event.key === null) load(); };
    window.addEventListener("storage", onStorage);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("storage", onStorage); };
  }, [accountId, entries]);

  function update(next: string[], message: string) {
    const clean = allowedFavourites(next, modules);
    let persistent = false;
    const key = favouritesKey(accountId);
    if (key) {
      try { window.localStorage.setItem(key, JSON.stringify(clean)); persistent = true; } catch { /* Retain this visit's selection. */ }
    }
    setSelection({ account: accountId, paths: clean, ready: true, persistent });
    setNotice(message);
  }

  return <section className={styles.section} aria-labelledby="home-favourites-heading">
    <div className={styles.heading}><h2 id="home-favourites-heading">Favourites</h2>
      <button type="button" disabled={!ready || !paths.length} onClick={() => update([], "Favourites cleared.")}>Clear favourites</button>
    </div>
    <p className={styles.hint}>Module shortcuts for your account in this browser. They do not sync to other browsers.</p>
    {!ready ? <p>Loading favourites…</p> : paths.length ? <ul className={styles.list}>{modules.filter(entry => paths.includes(entry.href)).map(entry => <li key={entry.href}>
      <Link href={entry.href}>{entry.label}<span aria-hidden="true">↗</span></Link>
      <button type="button" aria-label={`Remove ${entry.label} from favourites`} onClick={() => update(paths.filter(path => path !== entry.href), `${entry.label} removed from favourites.`)}>Remove</button>
    </li>)}</ul> : <p>No favourites yet. Choose the modules you use most.</p>}
    <details className={styles.picker}><summary>Choose favourites</summary>
      <fieldset disabled={!ready}><legend>Available modules</legend>
        {modules.length ? <div className={styles.choices}>{modules.map(entry => <label key={entry.href}>
          <input type="checkbox" checked={paths.includes(entry.href)} onChange={event => update(event.target.checked ? [...paths, entry.href] : paths.filter(path => path !== entry.href), `${entry.label} ${event.target.checked ? "added to" : "removed from"} favourites.`)} />{entry.label}
        </label>)}</div> : <p>No modules are available to favourite.</p>}
      </fieldset>
    </details>
    <p role="status" className={styles.status}>{owned ? notice : ""}{ready && !selection.persistent ? `${notice ? " " : ""}Browser storage is unavailable. Changes last only for this visit.` : ""}</p>
  </section>;
}
