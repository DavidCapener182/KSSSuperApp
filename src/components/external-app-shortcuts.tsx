import { ArrowUpRight, ClipboardCheck, GraduationCap, ShieldCheck } from "lucide-react";
import { externalAppShortcutsForRoles } from "@/lib/external-apps";
import type { RoleCode } from "@/lib/auth/principal";
import styles from "./external-app-shortcuts.module.css";

const ICONS = {
  magsecure: ShieldCheck,
  "footasylum-audits": ClipboardCheck,
  training: GraduationCap,
} as const;

type Props = Readonly<{ roles: readonly RoleCode[] }>;

export function ExternalAppShortcuts({ roles }: Props) {
  const shortcuts = externalAppShortcutsForRoles(roles);
  if (shortcuts.length === 0) return null;

  return <section className={styles.section} aria-labelledby="external-apps-heading">
    <div className={styles.headingRow}>
      <div>
        <p className={styles.eyebrow}>Separate sign-in may be required</p>
        <h2 id="external-apps-heading" className={styles.heading}>External apps</h2>
      </div>
      <p className={styles.note}>These apps manage their own access.</p>
    </div>
    <div className={styles.grid}>
      {shortcuts.map((shortcut) => {
        const Icon = ICONS[shortcut.id];
        const content = <>
          <span className={styles.cardTop}>
            <span className={styles.iconWrap}><Icon size={20} strokeWidth={1.8} aria-hidden="true" /></span>
            {shortcut.href
              ? <span className={styles.externalCue}>Opens in a new tab <ArrowUpRight size={16} aria-hidden="true" /></span>
              : <span className={styles.status}>Link not configured</span>}
          </span>
          <span className={styles.name}>{shortcut.name}</span>
          {shortcut.href
            ? <span className={styles.description}>Open {shortcut.name} in a separate app.</span>
            : <span className={styles.description} role="status">Ask your KSS administrator for the confirmed destination.</span>}
        </>;

        return shortcut.href
          ? <a className={styles.card} href={shortcut.href} target="_blank" rel="noopener noreferrer" key={shortcut.id} aria-label={`Open ${shortcut.name} in a new tab`}>
              {content}
            </a>
          : <div className={`${styles.card} ${styles.unavailable}`} key={shortcut.id}>
              {content}
            </div>;
      })}
    </div>
  </section>;
}
