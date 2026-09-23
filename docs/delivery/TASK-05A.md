# TASK-05A — CRM Foundation proposal

**Status:** Approved by David for implementation after TASK-04B at `9a63894`. Development implementation is recorded in `TASK-05A-REPORT.md`. Staging deployment and real-data import remain unapproved.

## Goal and boundary

Give Office a usable commercial chain: Organisation → Contact → Opportunity → Client relationship. A Lead is an Opportunity at its initial stage, not a duplicate company/contact. Winning an Opportunity changes the **same stable Organisation** from Prospect to Client; it does not create another Organisation or imply a signed contract, work order, invoice or deployability.

Later modules may reference the Organisation ID through Client → Site/Venue → Event/Contract → Staffing requirement → Deployment → Timesheet → Invoice. Existing `sites` have no commercial Organisation parent. Preserve them untouched in 05A; the later Client/Site task must define linkage and any migration.

## Records and fields

| Record | Minimum 05A model |
| --- | --- |
| Organisation | UUID; required name; optional trading name, website, general email and main phone; controlled relationship status `PROSPECT`, `CLIENT`, `FORMER_CLIENT`, `PARTNER`; optional current account owner (`people.id`); creator and database timestamps. No billing address or freeform notes yet. |
| Contact | UUID; exactly one Organisation FK for 05A; required first and last name; optional job title, business email, business phone/mobile; active/inactive; primary-contact flag; creator and timestamps. External business Contacts are separate from KSS `people` and `auth_identities`. |
| Opportunity | UUID; Organisation FK; required title; optional primary Contact constrained to that Organisation; controlled type `TENDER`, `DIRECT_ENQUIRY`, `EXISTING_CLIENT_EXPANSION`, `RENEWAL`, `PROSPECTING`; current owner (`people.id`); stage; optional estimated GBP value in minor units, expected decision date and short summary; Lost reason when applicable; creator and timestamps. Estimated value is not contracted revenue. |

An Organisation may have many Contacts and Opportunities. Exactly one active primary Contact is allowed per Organisation. A Contact linked to historical Opportunities may be deactivated but not deleted. Do not add a client-contact Auth identity, generic custom fields, import provenance or contact-consent claims without an approved source/rule.

Organisation names are not globally unique. A normalised non-empty business email must not be duplicated among active Contacts **within the same Organisation**. Without email, present a same-Organisation possible-name warning and require an explicit Office choice; never auto-merge or silently retarget IDs. Cross-Organisation email reuse does not establish that two Contact records are the same person. Multi-Organisation Contact relationships can be designed later if genuinely needed.

## Pipeline, ownership and Client transition

Stages: `NEW_LEAD`, `CONTACTED`, `QUALIFIED`, `PROPOSAL_TENDER`, `NEGOTIATION`, `WON`, `LOST`. Creation begins at New Lead. Authorised Office users may advance through open stages, including skipping forward without artificial intermediate clicks. Moving backwards requires a reason. Won and Lost are terminal in 05A; reopening/correcting a terminal decision needs a later approved workflow. Lost requires a reason. Won requires explicit confirmation.

The guarded Won transaction locks Opportunity and Organisation, records the stage transition, and promotes `PROSPECT → CLIENT` on the **same Organisation ID** with typed history. Already-Client stays Client. A Lost Opportunity never demotes a Client. Former Client/Partner conversions require a separate explicit rule and are not silently promoted. An existing Client may receive another Opportunity.

An Organisation may have an account owner and each Opportunity has one current owner. Ownership means accountability, **not exclusive CRM visibility**. Owner changes are attributable. Use immutable typed Opportunity events for stage, owner and material estimated-value changes, plus typed Organisation relationship events for Prospect → Client. Store old/new values, actor, reason where required and database time. Current values remain queryable on the core records. `audit_events` separately records meaningful create/update/transition actions using IDs and changed field names; do not put full Contact details, summaries or Lost-reason text into generic audit JSON. CRM UI shows curated business history, never raw audit payloads.

## Access and security

| Principal | 05A access |
| --- | --- |
| Active `SUPER_ADMIN` | Full CRM use and audited administration, without ability to fabricate another actor's history. |
| Active `OFFICE_ADMIN` | Organisation-wide CRM discovery, read and guarded create/edit/stage/owner actions. All active Office users may see CRM records; owner does not define a private partition. |
| `OPERATIONS` | No CRM workspace or Contact/pipeline data in 05A. A later Client/Site task can define a narrow operational Organisation projection against an actual use case. |
| `SECURITY_STAFF`, anonymous, unmapped | No CRM discovery, data or mutation. |

Business Contact email/phone remains controlled to CRM-authorised Office/Super users. People-directory visibility, SiteAssignment or a CRM relationship grants no Staff Profile, onboarding, Document, Storage or personnel-data access. Active role is checked in server actions and database policy for list, detail, search, count and mutation. Expiry removes access. No CRM export in 05A. Owner selection is limited to eligible active Office/Super People.

## Schema and guarded operations

One additive source-controlled migration set may define `crm_organisations`, `crm_contacts`, `crm_opportunities`, typed Opportunity change events and typed Organisation relationship events, with constraints, indexes, RLS and guarded functions. Use stable UUID FKs, length/format checks, non-negative estimated value, controlled stage/type/status values and database timestamps. A composite FK or database guard proves Opportunity primary Contact belongs to its Organisation. Organisation hard deletion is denied when related records exist; there is no hard-delete UI.

Server routes/actions resolve AuthIdentity to stable `people.id`, validate input, enforce action authority and invoke guarded database operations. Database guards independently reject direct table/RPC bypass, forged owner, cross-Organisation Contact, invalid transition and direct history/audit writes. Won and primary-Contact switches are atomic. History is immutable to ordinary clients. Owner display uses a safe Person label projection and never loads private Profile values.

Search and pagination are server-side and authorised **before** filtering/counting. Support Organisation name/trading name, Contact name/business email for authorised Office, Opportunity title, and filters for stage, type, relationship status and owner. Use bounded pages, deterministic order and identical scope predicates for list/count. Guessed IDs and errors must not serialise private rows.

## Product experience

Add authorised CRM navigation with Overview, Organisations, Contacts and Opportunities. Overview shows sourced Open Opportunities, New Leads, Proposal/Tender, Won and Lost counts; no invented target, win rate or forecast. Organisation list uses a desktop table and 390px cards with name, relationship state, primary Contact, open Opportunity count and account owner. Organisation detail composes Overview, Contacts and Opportunities; Sites/Venues, Events and Documents remain honest future states, without fake records. Its Activity section contains only safe typed 05A commercial events.

Contacts are managed from Organisation detail and browsable in a CRM-wide view. Opportunity list/detail shows Organisation, primary Contact, stage, type, owner, optional estimated value and decision date, summary and curated stage/owner/value history. Use explicit guarded stage controls, including Won/Lost confirmation. Kanban drag/drop, general CRM activities and CRM Task adapters belong to 05B. Do not create a meaningless Task for each record or an unbacked next-action promise.

Use the accepted iOS-inspired shadcn/ui blue/graphite/neutral system. **No green**, including Won status. Provide accessible forms, text status labels, focus, validation, loading/empty/error states. At 390px use cards/sheets and no horizontal overflow; desktop uses compact useful tables and bounded detail width.

## Acceptance proof

Positive proof, with synthetic data only:

1. Office creates one Organisation and two Contacts, selecting a primary Contact.
2. Office creates an Opportunity at New Lead and advances through authorised stages; stage/owner history remains attributable.
3. Office explicitly marks it Won. The same Organisation ID becomes Client atomically, with relationship history and no copy.
4. Office adds another Opportunity to that Organisation. Losing another Opportunity does not demote Client.
5. Search/filter/pagination locate Organisation, Contacts and Opportunities; counts match authorised lists.
6. Super Admin has audited oversight; Operations has no 05A CRM view; Staff/anonymous/unmapped are denied.
7. Desktop and 390px Office CRM are usable, accessible and free of green/overflow.

Negative tests: Staff/Operations/anonymous/expired-role denial; guessed IDs; direct table/RPC/history/audit writes; forged owner; invalid or terminal stage changes; Lost without reason; forged Client status; cross-Organisation Contact link; duplicate active primary or same-Organisation email; inactive Contact retaining history; unauthorised search/count; and CRM access failing to reveal private People/Profile/Document/Storage data.

Before claiming implementation, run clean install, lint, Webpack production build, smoke, CRM business/server/RLS tests, migration/object readback, relevant Phase 01–04B regressions, staged secret scan and desktop/390px browser checks. Report actual evidence and gaps. Development data stays synthetic; protected staging and the deferred Staff password handoff stay untouched.

## Deferred and stop

05B may add Kanban, CRM activities and an exact CRM Task source adapter. Later separately approved work defines Client/Site/Venue, Event, contracts, staffing and invoices. No real KSS records, tender portal integration, email automation, marketing, quote approval, client portal, production deployment or staging deployment in 05A. Use economical implementation routing; a bounded review of CRM access and Won integrity is appropriate. No GPT-6 Astra without explicit approval.

**Delivery boundary:** Do not change existing Sites, import real data, deploy to staging or start 05B.
