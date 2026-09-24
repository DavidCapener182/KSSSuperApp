# KSS Enterprise environment baseline — proposed

Date: 25 September 2026. Review state: **proposed for David/ChatGPT review; no deployment or database change authorised by this document.**

## Current environment

- **Database:** Supabase project `dnfhkmmnlbiabqypclqg` in eu-west-1.
- **Purpose:** Synthetic Development and Hosted Development Preview share this one database.
- **Data rule:** Synthetic data only. No real KSS data or production use is authorised here.
- **Preview rule:** The protected hosted preview is not an independent staging environment. A Development database write can be visible there immediately, even when hosted source is behind.
- **Former staging:** `kwpgjbxepxuhwxxydaca` was deleted. Historical reports retain its actual identifier, but it is not a deployment target.
- **Separate project:** `fwnzpafwfaiynrclwtnh` is KSS Platforms and outside this Enterprise baseline.

## Migration and evidence rule

Every proposed new migration must first reconcile its descriptive name, SQL, objects and dependencies with [SUPABASE-CANONICAL-BASELINE.md](SUPABASE-CANONICAL-BASELINE.md). Record the **actual remote version** after application. Timestamp equality alone is insufficient. The source manifest now resolves the former 13 SQL divergences and branch source gaps; a clean database replay has **not** been run. New synthetic migrations remain paused pending David/ChatGPT review of the source close-out.

Historical delivery reports retain their original project IDs and migration versions exactly as observed. Do not rewrite those reports to match a new canonical filename. A local save, a remote migration ledger row and a tested clean replay are separate forms of evidence.

## Future live environment

Before real KSS data, a separate production/environment decision must establish access, isolation, migration and deployment gates. This document does not authorise a production environment, live data import, new paid service or deployment.
