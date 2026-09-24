# TASK-22B — Operational Contacts Directory report

**State: ACCEPTED — SYNTHETIC DEV.** David formally accepted the recorded implementation and evidence on 24 September 2026. No staging, production, live contacts, integration work or TASK-22C work was performed.

## Scope delivered

- Routes are bound to exactly one Site, Site Service or Event. No Client-wide directory or context inheritance exists.
- The eight approved purposes, three source types, finite exact-context Contact Manager grants, explicit primary/backup priority, Europe/London applicability windows and controlled manual origin are enforced in guarded database functions. Manual Event routes expire; Site and Service manual routes require an effective period and review date.
- Publication requires a Staff-visible preview. Each correction creates a new immutable snapshot. Source changes and loss of source validity withhold current phone/email until deliberate review and republication. Typed append-only events preserve version references and controlled reasons.
- Staff current access resolves their own accepted Event or Site Shift allocation on every read, including the two-hour opening and closing margins. Operations sees only the accepted exact-context current projection. History is restricted to the exact Contact Manager grant or attributable Super Admin oversight and privileged reads are audited.
- Staff and Office pages show exact context, purpose, order, safe current values, state and review information. The Office flow supports preview, publication/correction, reorder, review, revoke, grant administration and restricted history. Staff `tel:` and `mailto:` actions hand off to the device application; KSS makes no delivery claim.
- The API returns `Cache-Control: private, no-store, max-age=0`. The Staff page clears its current values before revalidation and refreshes on focus, visibility and a 15-second visible-page interval. Database authority is recalculated for every request.

## Synthetic Dev and data boundary

The literal Supabase project ID was reconfirmed before applying each migration: **`dnfhkmmnlbiabqypclqg`**. Protected Staging **`kwpgjbxepxuhwxxydaca`** was not targeted. The TASK-22B migrations are `20260924235400` through `20260924235950` with the `operational_contact` / `operational_contacts` names, plus the labelled synthetic Person fixture `supabase/dev_only/20260924235800_task_22b_synthetic_person.sql`. An attempted first window-function migration failed before application and was corrected; an attempted fixture cleanup was rejected by an audit foreign key and was not applied. The dedicated synthetic Person remains in Dev so history retains its exact actor/source identity. Browser/test routes and grants were revoked; the cancelled allocations and test records remain as labelled synthetic history.

Direct authenticated read/write grants on contact tables are revoked and RLS is enabled with deny-all direct access. Guarded functions derive the actor from AuthIdentity and validate role, active grant, exact context and source. The published snapshot contains only approved display name, role/organisation, phone/email, purpose, priority, effective/applicability period, review date and provenance marker. Generic audit JSON did not contain the synthetic contact phone/email values in the inspected query; privileged history audit rows had actor, reason and time.

## Checks actually performed

| Check | Result |
| --- | --- |
| `node --env-file=.env.local --env-file=.env.test.local --test tests/access.test.mjs tests/crm.test.mjs tests/events.test.mjs tests/deployment.test.mjs tests/site-shifts.test.mjs tests/operational-contacts.test.mjs` | 7/7 passed: auth/RLS, 05A, 06A, 06C, 08A, TASK-22B. The 05A fixture assertion was adjusted to retain its original eight-person coverage after adding one labelled synthetic Person. |
| Owned-file ESLint | Passed. |
| `npm run build` | Passed with Next.js 16.3.6 Webpack and TypeScript. |
| Source/privacy negatives | Staff and Operations denied original CRM Contact table access; Operations denied private People profile access; Staff and Operations denied contact table/history writes and restricted history. Wrong Organisation/source context, guessed context, unaccepted allocation and Office without grant were denied. |
| Publication/version proof | Stale preview rejected; correction retained original version; typed review, reorder and revocation history linked exact old/new versions. Revoked values were withheld from normal management rows; audited Super Admin history retained the original. Forged publisher ID was ignored in favour of the database actor. |
| Priority/race | Sequential equal-priority overlap rejected; concurrent equal-priority publications produced one winner and one safe rejection. |
| Source health | CRM value change produced `REVIEW_REQUIRED` and null current methods; CRM deactivation and synthetic KSS Person role loss produced `SOURCE_UNAVAILABLE` and null methods. No automatic replacement or republishing occurred. |
| Allocation authority | Exact accepted Event and Site Shift checks passed at one microsecond before, at and after both ±2-hour boundaries. Cancelling accepted Event and Site Shift allocations denied the same allocation immediately. Site Service `ENDED` denied current contact while preserving restricted history. |
| Applicability | Europe/London spring-forward, repeated autumn hour and overnight-window cases passed against the shared database window function. API input requires an offset-bearing instant, avoiding ambiguous local-time input. |
| Manual expiry | An accepted current Event route became `EXPIRED` after its effective end; current phone was null, and an authorised expiry event retained its version reference. |
| Grant revocation | Exact Office grant revocation immediately denied management and historical reads. |
| Count isolation | Guessed/other-context current requests returned denial without another context's route count. |
| Browser cache/revocation | Authenticated Staff GET initially returned two exact contexts and private/no-store. After allocation cancellation and fixture cleanup, the same browser received 403 with private/no-store and no contact values; reload showed no `tel:`/`mailto:` links. |
| Authenticated browser layouts | Desktop and 390px Staff and Office views inspected. At 390px both pages had `scrollWidth=390`; Staff contact actions measured 44px, had accessible names and visible focus styling. `tel:`/`mailto:` contained only approved published values. Screenshots were inspected for blue/graphite/neutral styling with no green. |

Browser evidence: [Staff 390px](../../output/playwright/task-22b-staff-390.png), [Staff desktop](../../output/playwright/task-22b-staff-desktop.png), [Office 390px](../../output/playwright/task-22b-office-390.png), [Office desktop](../../output/playwright/task-22b-office-desktop.png), [Office publication preview](../../output/playwright/task-22b-office-preview-desktop.png). These were captured during an authenticated synthetic fixture, before its grant/routes were revoked.

Supabase security advisors were inspected. `rls_enabled_no_policy` on the six contact tables reflects deliberate deny-all direct access. The public `SECURITY DEFINER` RPC warning reflects the guarded, actor/context-checked access design; negative audience checks passed. Mutable helper search paths were fixed in the final migration. Advisor warnings outside TASK-22B were not changed.

## Formal acceptance and remaining boundary

David accepted the 7/7 focused/source regression result; auth/RLS and original CRM/People access denials; snapshot, version, source-health, priority race, Staff duty-window, cancellation, Service-end, DST, expiry, grant, count-isolation and authenticated browser revocation proofs; and the build, lint, desktop and 390px observations recorded above. The labelled synthetic Person remains in Dev as immutable synthetic evidence for attributable history.

Acceptance preserves exact Site, Site Service or Event context without inheritance; distinct CRM Contact, KSS Person and manual sources; explicit preview and immutable publication/correction; fail-closed source health; finite Contact Manager grants; Operations read-only scope; exact accepted Staff duty and two-hour margins; private/no-store, per-read authority and Staff-page revalidation; restricted historical values; and device-only `tel:`/`mailto:` hand-offs. It does not assert a call or email was sent, delivered, answered or actioned.

This is human acceptance of **synthetic Dev only**, not live privacy approval. Before real contacts are loaded, KSS still must decide the lawful/contractual publication basis, live contact owner, review frequency, retention/erasure and historical-access policy. CRM synchronisation, Client-wide directory, context inheritance, SMS, automated email/calling, push, receipts, break-glass, AI contact access, Control Room, Site Book, Service Delivery or SOP integration, staging, production and real KSS contact data remain excluded. Close this lane after the acceptance commit; TASK-22C and another implementation lane require separate authorisation.
