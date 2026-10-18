import { notFound } from "next/navigation";
import Link from "next/link";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { IncidentReviewerAdmin } from "@/components/incident-reviewer-admin";
import styles from "@/components/reviewer-admin.module.css";
export const dynamic="force-dynamic";
export default async function IncidentReviewersPage(){const p=await getPrincipal(await createServerSupabase());if(!p?.roles.includes("SUPER_ADMIN"))notFound();return <main className={`enterprise-main ${styles.page}`}><header className={styles.pageHeader}><p className={styles.eyebrow}>Super Admin · Synthetic development</p><h1>Incident reviewer grants</h1><p>Incident review requires an active Operations role and a separate, time-bounded reviewer grant.</p><p><Link href="/access">Access administration</Link></p></header><IncidentReviewerAdmin /></main>}
