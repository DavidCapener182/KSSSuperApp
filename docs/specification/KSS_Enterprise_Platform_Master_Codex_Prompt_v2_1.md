# KSS Enterprise Platform — Full Master Codex Specification

**Version:** 2.1 — original baseline, research requirements and phased Codex delivery policy  
**Updated:** 22 September 2026  
**Status:** Living planning specification; no claim of implemented or production-ready functionality  
**Owner:** KSS / David Capener  
**Companion research:** `KSS_Enterprise_Platform_Competitor_Research_2026-09-22.md`

**Delivery update:** Part E adds the phased build and economical agent policy. Use the separate phase/task prompts; do not execute this whole file as a one-shot build. Product suggestions retain their existing decision status.

## Read this before designing or coding

This file contains the whole existing Markdown plan, followed by the detailed improvements produced by the module-by-module product review. It is not a short index pointing to missing sections. Read Parts A, B and C together.

**Part A — Preserved planning baseline:** The previous full Markdown export is retained below. It records the working concept; it does not mean every suggested feature, provider or policy was individually signed off.

**Part B — Research-led proposals:** Thirty individually researched capability areas, with requirement IDs, acceptance outcomes and the next action. These refine the concept but are **proposed**, not automatically authorised for the first release. Their source references refer to Part D.

**Part C — Consolidated design:** Proposed navigation, role matrix, business file architecture, developer source structure, cross-module records and workflows, integration boundaries, release sequencing, test scenarios and Codex instructions.

**Part D — Sources:** The official pages used as design references. The companion research explains the observed features separately from the proposed KSS design. No vendor has been selected by including it here.

### Change-control rules

Preserve explicit user requirements: role-appropriate access for all staff; central client/contact/site/person records; access to Footasylum Audits and MagSecure; task boards; onboarding; in-app training through the existing platform where technically supported; staff documents, expenses and questions; finance/CRM/operations modules; full file, admin-rights and navigation planning; and phased delivery through production.

Do not silently treat a research proposal as an approved purchase, legal policy or production change. Record decisions as Proposed, Accepted, Deferred or Rejected, with owner, date and rationale. Mark integrations as Unverified, Feasibility Confirmed, Sandbox Tested, Pilot Proven or Production Approved. Software delivery has its own status; a researched feature is not a completed feature.

Where older broad language conflicts with a stricter proposed safeguard, surface the decision rather than quietly weakening it. In particular, a mandatory legal eligibility blocker must never become overridable merely because a previous paragraph mentioned possible overrides. Confirm applicable requirements and the authorised policy owner.

### Research limitations

Reviewed official public product/help/technical pages on 22 September 2026; no hands-on vendor trial, pricing exercise or end-to-end KSS integration test was performed. Product plans and capabilities need confirmation. Do not claim UK compliance, operational safety or payroll correctness from a general product description.

### Original-section coverage

| Original master section | Individually researched areas |
|---|---|
| 1. Product principles | R01 shared platform and records |
| 2. Users, admin rights and permissions | R02; reporting/AI implications R23–R24, R28 |
| 3. Navigation and dashboards | R03, R07, R24 |
| 4. File and document system | R04, R20, R25, R29 |
| 5. People, recruitment and onboarding | R05; new joiner–mover–leaver lifecycle |
| 6. Training and competency | R06, R13 |
| 7. Employee profile / self-service | R07, R08, R21 |
| 8. CRM, clients, contacts and mobilisation | R09, R10, R11 |
| 9. Sites, events, workforce and hours | R11, R12, R13, R14, R16 |
| 10. Tasks, live operations and assets | R15, R17, R18, R19 |
| 11. Finance, payroll and invoicing | R14, R21, R22 |
| 12. Compliance, reporting, client portal and knowledge | R20, R23, R24, R25 |
| 13. Existing apps, automation and AI | R26, R27, R28 |
| 14. Core data model and architecture | R01, R02, R26, R29, R30; Master Part C |
| 15. Delivery roadmap | R30; Master C8 |
| 16. Definition of Done | Acceptance tests in every R section; Master C9 |
| 17. Codex implementation instruction | R30; Master C10 |


---

# Part A — Complete preserved planning baseline


## KSS Enterprise Platform

### Master Codex Build Specification --- Living Draft

**Purpose:** Build a secure, mobile-first enterprise platform that
becomes the single operational source of truth for running KSS. This is
not merely a dashboard or link hub. It is an integrated Security
Operations ERP / CRM / workforce / HR / compliance / document / finance
/ reporting platform.

The current problem is fragmentation across SharePoint, folders,
onboarding records, training systems, Footasylum Audits, MagSecure and
other administrative processes. The new platform should connect the full
company lifecycle and remove duplicate entry.

**Core rule: one record, used everywhere.** A staff member, client,
contact, site, venue or event is created once. Shifts, training,
documents, incidents, tasks, assets, expenses, hours, payroll and
invoices link back to those master records.

The platform must support static guarding, retail security,
football/stadium operations, festivals, concerts/live events and
temporary deployments. Requirements must be configurable by client,
site, event, service and role.

### 1. Product principles

-   Mobile-first for frontline staff and fully capable on desktop for
    office users.
-   Least-privilege access and complete auditability.
-   Structured records rather than recreating a SharePoint folder maze.
-   Strong search, filters, quick actions, clear status, ownership,
    deadlines and blockers.
-   Automation without bypassing required human approval.
-   Reusable templates and workflows.
-   Integrate specialist applications where sensible.
-   Avoid duplicate sources of truth.
-   Design permissions and the data model before building large amounts
    of UI.

### 2. Users, Admin Rights and Permissions

Support at least Super Admin / Platform Owner, Admin, Operations, Office
/ HR, Finance / Payroll, Compliance, Operational Manager / Supervisor,
frontline Security Staff / Steward and restricted Client User. Allow
custom roles later.

Permissions must use **role + module + action + scope**. Actions include
view, create, edit, archive/delete, approve, assign, export, manage
users, manage permissions and configure workflows. Scope can be own
record, team, department, assigned client, site, event or company-wide.

Sensitive information requires tighter controls: staff pay rates, client
charge rates, payroll, banking/payment information, expenses, HR data,
Right to Work, screening/vetting, disciplinary/investigation information
and commercially sensitive finance.

The Admin console should manage users, activation/suspension, role
templates, custom permissions, teams, client/site/event assignments,
integrations, workflow rules, notifications, system configuration and
audit history. Privileged changes must record who changed what, when,
and old/new values.

Permissions must be enforced server-side/API-side. Hiding navigation is
not security and changing a URL must never expose an unauthorised
record.

### 3. Navigation and Dashboards

Proposed full-office navigation:

-   Home / Dashboard
-   My Work / Tasks
-   People
-   Clients / CRM
-   Sites
-   Events / Operations
-   Reports / Incidents
-   Documents
-   Training / Compliance
-   Finance
-   Assets
-   Analytics
-   Admin

Frontline staff should receive a simplified interface centred on Home,
My Shifts / Work, Tasks, Training, Documents, Expenses, Questions /
Messages and My Profile. Client users see only authorised client/site
information.

Provide global search, quick-create actions, breadcrumbs, deep links,
recent records and contextual navigation. Examples: Client → Sites →
Events → Contacts → Documents → Reports → Finance; Staff → Training →
Documents → Shifts → Expenses → Compliance; Event → Staffing → Briefings
→ Assets → Incidents → Hours → Invoice.

Dashboards should be role-specific and prioritise actionable exceptions:
today's operations, staffing shortages, onboarding blockers, expiring
SIA/training, incidents requiring action, overdue tasks, expenses/hours
awaiting approval, payroll exceptions, uninvoiced work and documents
approaching review.

Key flows: 1. Lead → Opportunity → Client → Contract → Site/Event →
Mobilisation → Go Live. 2. Applicant → Approved → Onboarding → Documents
→ RTW/SIA/Screening → Training → Deployable. 3. Event → Staffing →
Confirmation → Delivery → Actual Hours → Approval → Payroll / Invoice.
4. Incident → Escalation → Investigation → Actions → Closure. 5. Expense
→ Receipt → Submission → Approval/Query → Payment. 6. Document → Draft →
Review → Approval → Published → Review → Superseded/Archived.

### 4. File and Document System

Do not simply recreate nested SharePoint folders. Documents should be
managed records linked to relevant entities while still providing a
familiar Files/Documents browser.

Logical areas include Company/Governance, Clients, Sites/Venues, Events,
People/Personnel, Onboarding, Training, Compliance, Incidents/Reports,
Finance, Assets and Projects. A document may appear in several
authorised contextual views without duplicate copies.

Metadata should include title, type/category, owner, linked records,
status, version, creator/modifier, dates, approval state, effective
date, review/expiry date, confidentiality/access classification, tags
and retention/archive state.

Support upload, download, preview where practical, search, filters,
recent/favourites, version history, replacement/superseding,
approval/publish workflow, review/expiry reminders, archive and
retention. Clearly identify the current approved version and never
silently overwrite controlled documents.

Plan migration from SharePoint/folders: inventory, map old locations to
records/metadata, identify duplicates/obsolete versions, preserve useful
history, validate permissions, migrate and retain an auditable migration
record.

### 5. People, Recruitment and Onboarding

Maintain one central person record from applicant through active staff
and eventually former staff. Do not create disconnected applicant,
onboarding and employee records.

Potential staff information includes contact details, worker/employment
information, roles, SIA, RTW, screening/vetting, qualifications,
competencies, training, certificates, documents, availability,
assignments, client/site approvals, compliance, expenses and relevant
operational history.

Onboarding flow: Application received → review/approval → onboarding
created by Office → staff account/invite → personal information →
documents → RTW → SIA → screening/vetting → contracts/forms → policy
acknowledgements → training → office review → deployable.

Show completion percentage and exact blockers. Requirements must be
configurable by role, worker type, client, site, event and service type.
Automatically assign the required forms, checks, documents,
acknowledgements and training.

### 6. Training and Competency

Integrate the existing training platform through API, SSO, deep links
and/or status synchronisation where technically supported. Training
should feel part of the main employee experience.

Track course/module, requirement source, assignment, completion, result,
certificate, completion date, expiry and refresher date. Automatically
assign training by role/client/site/event.

Create a searchable competency matrix. Operations should be able to
identify available staff who meet SIA, training, qualifications,
client/site approval and competency requirements.

Deployment should warn or block where mandatory licence, RTW, training
or competency is absent/expired. Any authorised override requires
permission, reason and audit history.

### 7. Employee Profile / Self-Service Portal

Every staff member gets a secure personal portal, not merely a read-only
HR record.

Show personal information, roles, SIA/licences, qualifications,
certificates, onboarding/compliance status, training, upcoming/past
shifts, tasks, announcements and relevant company/client/site documents.

Staff can upload requested documents, replace documents, complete forms,
acknowledge policies, access authorised employment/compliance documents
and see expiry warnings. Office can request a particular
missing/replacement item and track the response.

#### Expenses

Staff can submit category, related shift/event/site/client where
relevant, date, amount, description and receipt/evidence. Workflow:
Draft → Submitted → Queried → Approved/Rejected → Sent for Payment →
Paid. Staff see status/comments; Finance receives an approval queue.
Attempt duplicate detection where practical.

#### Questions / Messages

Staff can raise logged queries to Office/HR/Operations/Finance.
Categories can include Pay, Shift, Expense, Training, Document, HR,
Operations and General. Preserve thread/history, owner, status,
timestamps, notifications and resolution.

### 8. CRM, Clients, Contacts and Mobilisation

Create a shared CRM covering prospects, leads, opportunities, contacts,
notes/activity, quotes, tenders, contracts and account history.

Lead/opportunity data may include source, owner, stage, requirements,
contacts, proposal/tender, expected/actual value, next action and
documents. A won opportunity should become the client record without
re-entry.

Client records link contacts, contracts, charge rates, sites, events,
documents, incidents, tasks, reports, invoices and account history.

Contacts store organisation, role/job title, contact methods,
responsibilities and primary/preferred status, with important
communications/decisions recorded where appropriate.

Winning a client triggers template-driven mobilisation covering
contracts, contacts, service specification, site information, staffing,
rates, SOP/RAMS, emergency information, equipment, training, reporting,
patrol requirements, finance setup, PO details, portal setup and go-live
approval. Show progress, owners, outstanding tasks and blockers.

### 9. Sites, Events, Workforce and Hours

A site/venue record may contain client, location, contacts, service
type/status, operating hours, staffing model, SOPs, RAMS, emergency
information, maps/access, keys, alarms/CCTV where appropriate, fire
information, patrol/checkpoint requirements, assets, training
requirements, reports, incidents, audits and documents.

Event records may contain client, venue, event type, dates/times,
attendance where relevant, contacts/command structure, staffing
request/revisions, roles/positions, deployment plan, accreditation,
briefings, transport, radios/assets, incidents, hours, debrief and
commercial/invoice linkage. Support templates for repeated events.

Workforce planning tracks availability, role, SIA, competencies,
training, client/site approval, allocation, call time, confirmation,
cancellation, lateness/no-show, check-in/out and actual/approved hours.
Show requested vs filled vs confirmed vs attended, shortages and
qualification mix.

Keep scheduled hours, actual/check-in-out hours, submitted hours,
approved payable hours and approved billable hours separate. Adjustments
require reason, actor and timestamp. Approved data flows to payroll and
invoicing.

### 10. Tasks, Live Operations and Assets

Build Trello-style work management with boards/lists/stages,
tasks/cards, owners, assignees, priority, due date, status,
checklists/subtasks, comments, attachments, activity history and links
to platform records. Provide My Tasks and team/department views.

Other modules should automatically create tasks for mobilisation,
onboarding blockers, licence/training expiry, document review, staffing
deadlines, incident follow-up, missing approvals, payroll exceptions and
invoice blockers.

Create time-stamped operational/control-room logs for incidents,
welfare, medical, ejections, refusals, missing persons, safeguarding,
radio/control activity and configurable categories. Incident records
include category, site/event/location, reporter, people involved,
narrative/actions, attachments, severity, status, escalation, owner,
handover and closure. Sensitive safeguarding/HR/investigation data needs
tighter access.

Asset management covers radios, bodycams, vehicles, keys, NFC tags,
uniforms and other equipment. Track identifier, type, condition/status,
location, assigned person/site/event, issue/return, maintenance,
loss/damage and history.

### 11. Finance, Payroll and Invoicing

Finance must connect directly to operations.

Store controlled client charge rates and staff pay rates by
role/service/client/site/event/effective date as required. Restrict
visibility and preserve rate-change history.

Payroll consumes approved payable hours rather than manual re-entry.
Provide approval states, exceptions and pay-run/export/integration
status.

Invoicing uses approved billable hours/services and client rates. Link
purchase orders, create invoice-ready batches and track Draft → Approved
→ Sent → Paid / Queried / Credited.

Commercial reporting, subject to permission, should show revenue, labour
cost, expenses, estimated/actual margin, delivered but uninvoiced work,
missing PO/rate/hour blockers and payroll exceptions. Individual pay
information must never be exposed without explicit permission.

### 12. Compliance, Reporting, Client Portal and Knowledge

Track SIA, RTW, screening/vetting, training, certificates, policy
acknowledgements, audits, insurance, licences, ACS evidence and
controlled document reviews. Use configurable warning windows and create
tasks/notifications before expiry.

Reporting/BI should cover incidents by client/site/event/type, staffing
fulfilment, shortages, lateness/no-shows, overtime, compliance/training,
audit performance, patrol compliance, hours, revenue, labour cost,
expenses and margin. Include filters, drill-down and permission-aware
export. Prioritise actionable exceptions over vanity metrics.

Client accounts must be strictly scoped. Potential content includes
operational reports, appropriate incidents, audits, patrol compliance,
approved documents, KPIs and permitted invoice/commercial information.
Never expose internal notes, individual pay, HR or unrelated clients.

Create a searchable knowledge base for company procedures, FAQs, site
guidance, operational instructions and support/training material,
surfaced contextually where useful.

### 13. Existing Apps, Automation and AI

Initially provide authorised launch points for Footasylum Audits and
MagSecure. Where APIs/authentication permit, progressively integrate
identity, client/site references and useful status/data so information
is not maintained twice.

Integrate the training platform into onboarding and staff profiles.

The workflow engine should support triggers, conditions and actions for
onboarding, mobilisation, expiries, document review, staffing,
incidents, expenses, approvals, payroll and invoicing. Notifications
should feed a targeted in-app work/notification queue without causing
alert fatigue.

AI must operate only over data the current user is authorised to access.
Example questions/actions: What needs my attention today? Show
compliance blockers. Prepare staffing. Summarise a client's month.
Summarise incidents. Identify missing documents. Which delivered work
has not been invoiced? Why can this person not be deployed? Why is this
invoice blocked?

AI can draft, summarise and recommend next steps, but consequential
writes/approvals remain explicit and auditable. AI must never bypass
permissions, fabricate facts or silently alter payroll, compliance or
incident records.

### 14. Core Data Model and Architecture

Core entities should include User, Role, Permission,
Person/Applicant/Staff, Client, Contact, Site/Venue, Event/Deployment,
Shift, Position, Allocation, Training Course/Assignment/Completion,
Compliance Requirement/Check, Document/Version, Task/Workflow, Incident,
Asset/Issue, Expense, Rate, Timesheet/Hours Approval, Payroll
Batch/Item, Purchase Order, Invoice and Notification/Message.

Use stable IDs and explicit relationships. Keep master data separate
from transactional history. Support effective-dated rates/requirements
and strong audit history. Do not store critical state only in free text.

Define frontend, backend/API, relational database, object/file storage,
authentication, authorisation, background jobs/queues, notifications,
integrations, observability, staging/production environments, CI/CD and
secrets management. Prefer maintainable mainstream technology.

Security baseline: secure authentication, appropriate MFA/admin
protection, session controls, server-side authorisation, encryption in
transit/at rest, secure file access, file validation where appropriate,
secrets isolation, audit logs, rate limiting, input validation,
dependency management, backups and tested recovery.

GDPR/privacy: data minimisation, visibility controls,
retention/archive/deletion rules, appropriate export/subject-access
capability, careful handling of sensitive personnel information and
clear separation between internal, staff-visible and client-visible
data.

Non-functional requirements: responsive/mobile-first UI,
accessibility/readability, acceptable mobile-network performance,
graceful failure/retry, reliable uploads, scalable search/filtering,
monitoring/error logging, backups/recovery and no production dependency
on one administrator's local machine.

### 15. Delivery Roadmap

Do not build the final platform as one enormous unverified Codex change.

1.  **Ideas / Brainstorm:** continue capturing requirements and
    operational problems.
2.  **Discovery:** map Lead → Client → Mobilisation →
    Recruitment/Onboarding → Deployment → Service Delivery → Reporting →
    Hours → Payroll/Invoicing → Review. Inventory current systems/data.
3.  **Architecture:** finalise permission matrix, data model,
    navigation, workflows, migration approach, integrations and
    non-functional requirements.
4.  **UX / Prototype:** prototype role dashboards and core journeys;
    test mobile usability/accessibility.
5.  **MVP:** authentication, permissions/audit, people,
    clients/contacts/sites, documents, onboarding/training status,
    employee portal, tasks/workflows and role dashboards.
6.  **Operational depth:** events/workforce, incidents/control room,
    assets, compliance automation, rates/hours,
    payroll/invoicing/expenses, reporting/client portal, integrations,
    automation and AI.
7.  **Testing/UAT:** functional, regression, direct URL/API permission
    tests, document/version tests, finance calculations,
    mobile/accessibility, backup/restore, security/privacy and realistic
    KSS scenarios.
8.  **Pilot:** controlled users/sites, pilot migration, training,
    defects/usability review and explicit go-live decision.
9.  **Production:** validated migration, user training, support route,
    monitoring, backups, recovery, release/rollback process and named
    ownership.
10. **Continuous improvement:** expand based on live feedback without
    weakening the data or permission model.

### 16. Definition of Done

A feature is complete only when: - requirements and acceptance criteria
are met; - correct permissions are enforced; - audit history exists
where required; - mobile/responsive UX is usable; - validation and error
states exist; - search/filtering is available where appropriate; -
relevant tests pass; - documentation/help is updated; - no duplicate
source of truth is introduced; - related Trello tasks and this master
specification are updated.

### 17. Codex Implementation Instruction

Treat this document as a **living target architecture**, not permission
to implement everything in one pass. Before each build phase, translate
the relevant section into detailed user stories, acceptance criteria,
data entities/relationships, permissions, screens, API contracts,
workflows, automations, migrations and tests.

Preserve the overall architecture while implementing in controlled
increments. Do not make an isolated feature decision that undermines the
single-source-of-truth model, permission model, auditability, document
controls or later integration between operations and finance.

When a new requirement is agreed during brainstorming, incorporate it
into this master specification as well as the actionable project backlog
so the master prompt remains the complete current plan.


---

# Part B — Research-led proposed module requirements

All R01–R30 items are proposed refinements pending prioritisation. They use the same underlying platform and should not become 30 isolated systems. Sources document the inspiration, not a guarantee of technical compatibility.

## R01. Platform structure and shared records
**Status:** Proposed. **Research references:** [S01] [S14]

- **R01.1:** Create stable central identities for a person, client organisation, contact, site, event and contract. Separate a person from their login and assignments, so rehires and multiple roles do not create duplicates.
- **R01.2:** Give each record a consistent overview, relevant relationships, activity, documents and actions. A client change should propagate through authorised views without manual re-entry.
- **R01.3:** Use a staged integration approach: links first where appropriate, verified identity/data exchange next. Record which system owns every data field before enabling two-way synchronisation.
- **R01.4:** Keep user-interface modules distinct but reuse permission, document, approval, task and notification services. Start with a modular application rather than introducing distributed services before there is a demonstrated need.

**Acceptance outcome:** Create one client with two sites and one event. Its contacts, documents and work are visible in the appropriate views using the same IDs; a contact edit appears consistently and cannot leak to an unrelated client.

**Build/integrate/phase recommendation:** Foundation: build the KSS domain model; integrate specialist engines. Preserve the existing applications until replacement workflows are proven.

**Do not:** Copying the appearance of an ERP while leaving every module with its own employee or client table; importing vendor product claims as measured KSS benefits.

**Next decision/task:** Inventory existing records and decide the authoritative system for each entity and field before designing imports.

## R02. Roles, administration and sensitive access
**Status:** Proposed. **Research references:** [S04] [S37]

- **R02.1:** Model permission as action plus resource type plus scope, with separate grants for sensitive fields and exports. Default to no access. Team membership or a familiar URL must never grant access by itself.
- **R02.2:** Keep the platform-owner capability requested by David, but make sensitive HR, safeguarding, payroll and bulk-export access explicit and logged. Require a reason and expiry for temporary elevation.
- **R02.3:** Add an access-review screen showing who can access each client, site, event and sensitive category, why they have access, and when assignments expire.
- **R02.4:** Revoke access and active sessions when someone leaves or changes roles. Test authorisation on API endpoints, object downloads, search, reports, notifications and AI, not only menus.

**Acceptance outcome:** A supervisor assigned to Site A is denied Site B through the UI, API, exported report and document URL. A temporary finance grant expires and subsequent requests fail. The audit history identifies the granting user and reason.

**Build/integrate/phase recommendation:** Foundation: build resource-level authorisation; integrate identity/MFA with a suitable provider. Evaluate advanced time-limited privileges in the security design.

**Do not:** A single broad Office/Admin role becoming a route to every private staff record; assuming identity-provider login handles application-level client isolation.

**Next decision/task:** Produce a permission matrix using actual KSS job responsibilities and name the authorised approvers for privilege changes.

## R03. Navigation, dashboards and the daily work area
**Status:** Proposed. **Research references:** [S03] [S15]

- **R03.1:** Provide three distinct entry experiences: employee My Work, office/operations workspace and client workspace. Keep a clear current site/event context where users hold several assignments.
- **R03.2:** Prioritise actionable cards: unfilled post, missing compliance, pending approval, unresolved incident and uninvoiced work. Every number must drill into the relevant records and show freshness.
- **R03.3:** Use one consistent record header: name, status, owner, operational context and permitted actions. Preserve breadcrumbs, browser back behaviour and deep links after login.
- **R03.4:** Keep mobile navigation short and put shifts, report issue, training, expenses, documents and questions within an obvious route. Avoid a horizontally overflowing desktop sidebar on a phone.

**Acceptance outcome:** A guard reaches their next shift, correct current site briefing and expense form without accessing office navigation. A manager opens a staffing-gap number and sees exactly the shifts contributing to it.

**Build/integrate/phase recommendation:** Foundation: build a shared navigation shell and role-specific work queues before adding decorative dashboards.

**Do not:** An attractive homepage with unactionable totals; separate navigation rules that disagree with server permissions; endless confirmation pop-ups obscuring urgent tasks.

**Next decision/task:** Prototype guard, office, supervisor and client journeys with realistic records and agree the first five actions each role needs.

## R04. File architecture, controlled documents and migration
**Status:** Proposed. **Research references:** [S05] [S06]

- **R04.1:** Present record-linked document areas for company, people, clients, sites, events, compliance, incidents, finance and assets. Separate logical folders from binary storage and from the developer source-code structure.
- **R04.2:** Store Document and DocumentVersion separately, with classification, owner, linked records, review date, current approved version and external source identity where retained in SharePoint.
- **R04.3:** Record acknowledgements against the exact approved version. A replacement creates a new version and, where required, a new acknowledgement request. Never overwrite an approved file silently.
- **R04.4:** Linking a document to another record must not widen its access. Preserve restrictive classification and explicitly allowed audiences; do not union all parent permissions.
- **R04.5:** Assess keeping SharePoint as initial storage. Migrate in controlled batches with duplicate review, file checksums, counts, source-path mapping and rollback; copying bytes alone is not a completed migration.

**Acceptance outcome:** Publish SOP version 2 after version 1 is acknowledged. Staff see version 2 as current and version 1 acknowledgement remains historically correct. An HR attachment linked to a site stays private.

**Build/integrate/phase recommendation:** Foundation: build metadata, context and permissions. Decide retain/integrate/migrate storage after inspecting the current configuration.

**Do not:** An unnecessary wholesale SharePoint replacement; copied certificates treated as new inspection observations; editing a live document while claiming the prior approval still applies.

**Next decision/task:** Choose pilot document types and agree ownership, approval audiences, retention decisions and the source-of-truth boundary.

## R05. Recruitment, onboarding and the joiner–mover–leaver lifecycle
**Status:** Proposed. **Research references:** [S07]

- **R05.1:** Use one person record through applicant, onboarding, active, suspended and former-worker states. Track rehire history without restoring old access automatically.
- **R05.2:** Generate versioned onboarding requirements by role and work context. Distinguish requested, supplied, under review, rejected and verified evidence; show who owns each blocker.
- **R05.3:** Keep staff-submitted facts separate from office verification. An uploaded document or ticked task does not certify Right to Work, SIA status or screening completion.
- **R05.4:** Add role/site-change workflows that reassess required training and access. Add offboarding for future shifts, account/session revocation, kit return, open claims and retained records.
- **R05.5:** Integrate an appropriate signing mechanism where needed and retain signatory, timestamp, document version and signing evidence. Do not claim a checkbox is equivalent to every required signature.

**Acceptance outcome:** An applicant completes all uploads but remains non-deployable until required reviews are verified. A leaver loses access while their approved past hours and evidence remain available to authorised staff.

**Build/integrate/phase recommendation:** Foundation: build lifecycle and requirement orchestration; integrate identity checks or signing where justified. No automated employment decisions.

**Do not:** Importing US onboarding checks into a UK workflow; blanket deletion of leavers; treating 100% checklist completion as legal compliance.

**Next decision/task:** Confirm actual KSS onboarding documents, verification responsibilities, signing needs and leaver/rehire process.

## R06. Training integration and competency management
**Status:** Proposed. **Research references:** [S08] [S09]

- **R06.1:** Keep the existing training platform as the initial candidate source of learning results. Discover its name, export/API, SSO, launch options and content rights before selecting an integration.
- **R06.2:** Create CourseRequirement, Assignment, Completion and Certification records with the provider identity, completion source, result, validity dates and renewal rule.
- **R06.3:** Assign role-, client-, site- and event-specific packages. Show the employee what to do next and show Operations the exact missing requirement, not simply a red percentage.
- **R06.4:** Assess eligibility for the actual shift period. Separate non-overridable legally required blockers, contractual requirements and advisory business warnings; authorised exceptions apply only to rules explicitly classified as overridable.
- **R06.5:** Use webhook or scheduled reconciliation where supported. Mark stale/unconfirmed synchronisation visibly rather than silently treating old training data as current.

**Acceptance outcome:** A supervisor qualification expiring before a proposed shift ends produces the defined blocker. A repeated completion callback creates one result. Removing an assignment does not erase the historic certificate.

**Build/integrate/phase recommendation:** Foundation: build requirement/status views; integrate the LMS. Defer building a course authoring and assessment engine.

**Do not:** Promising an embedded course player before confirming provider support; allowing an administrator to waive a mandatory legal requirement by adding a note.

**Next decision/task:** Run one test user through assignment, launch, completion, expiry and reconciliation using the actual existing LMS.

## R07. Employee portal, announcements and leave
**Status:** Proposed. **Research references:** [S10] [S11]

- **R07.1:** Show next shift, open tasks, missing documents, training, claim status and replies in My Work. The office profile and staff-facing profile use the same underlying records but different permissions.
- **R07.2:** Target announcements by role and current assignment. Record delivery, viewed and acknowledged separately; acknowledgement is not proof of understanding.
- **R07.3:** Add availability, leave and absence requests with status and roster-conflict handling. Do not remove a scheduled post silently when a leave request is submitted.
- **R07.4:** Staff can propose changes to personal details. Route sensitive changes, especially payment details, through a verified approval process and retain change history.
- **R07.5:** Offer sensible notification settings and reminders. Keep urgent operational actions accessible even when routine policy acknowledgements are outstanding.

**Acceptance outcome:** An employee submits leave affecting a booked shift. The responsible planner receives an actionable conflict and the employee can track the decision. A targeted announcement is not shown to unrelated staff.

**Build/integrate/phase recommendation:** Foundation for profile and self-service; operational release for leave/absence integration. Build the interface around core records.

**Do not:** An employee portal that is just a document directory; coercive pop-ups blocking reporting; broad publication of directory or private HR information.

**Next decision/task:** Agree staff-facing tabs and which updates staff can make directly versus request for review.

## R08. Staff questions and internal service desk
**Status:** Proposed. **Research references:** [S12] [S13]

- **R08.1:** Create a Request/Case record with requester, category, linked shift/person/expense, owner team, status, priority and response target. Use plain-language categories such as pay query or missing training.
- **R08.2:** Separate private internal notes from staff-visible replies. Restrict HR and safeguarding cases to explicitly authorised teams, including notification previews.
- **R08.3:** Provide New, Assigned, Awaiting Staff, Awaiting Internal Action, Resolved and Closed states; retain the reason for pauses and reopening.
- **R08.4:** Convert a question into linked operational work without duplicating the conversation. Support attachments and owner reassignment with history.
- **R08.5:** Begin with an in-app form; add email ingestion only after identity matching, deduplication and private-reply handling have been tested.

**Acceptance outcome:** A pay query links to the employee’s shift and approved hours. A finance internal note is absent from the staff view and email notification. Reopening the case preserves its original history.

**Build/integrate/phase recommendation:** Foundation: build a small service-desk workflow using shared requests, tasks and permissions; do not build a Slack replacement.

**Do not:** Questions vanishing into a message feed; confidential replies exposed by forwarding; turning every message into a new duplicate task.

**Next decision/task:** Define request categories, receiving teams, public/private fields and realistic response targets.

## R09. CRM, contacts, opportunities and account history
**Status:** Proposed. **Research references:** [S14] [S15]

- **R09.1:** Use one organisation record from prospect to client and one contact record with explicit relationship labels: billing, contract owner, emergency, site and event responsibilities.
- **R09.2:** Track opportunity stage, service requirements, owner, next action, expected value, quotes, decision history and close reason. A won deal creates linked mobilisation, not a new disconnected customer.
- **R09.3:** Flag potential duplicates for reviewed merging. Preserve external references, history and ownership when a merge is approved.
- **R09.4:** Record contact consent/preferences and appropriate visibility. Attach only relevant business communications, rather than indiscriminately ingesting whole personal mailboxes.
- **R09.5:** Add contract renewal and follow-up dates as linked tasks, with clear ownership. Separate speculative opportunity value from contracted and invoiced revenue.

**Acceptance outcome:** A contact linked to two authorised sites remains a single record. Converting an opportunity retains quote history and opens the right mobilisation template without re-entering names and addresses.

**Build/integrate/phase recommendation:** Foundation: build lightweight shared CRM; integrate messaging selectively. Defer extensive marketing automation.

**Do not:** A sales pipeline isolated from delivery; ambiguous primary-contact fields; counting open opportunity values as secured revenue.

**Next decision/task:** Agree relationship labels, conversion rules and a duplicate-merge process before importing contact lists.

## R10. Client requests, approvals and contract changes
**Status:** Proposed. **Research references:** [S12] [S13] [S14]

- **R10.1:** Create client request types for extra cover, staffing amendments, documents, service issues and complaints. Link each request to the authorised client/site/event and one accountable owner.
- **R10.2:** For a staffing increase, capture requested hours/roles, effective date, availability check, proposed charge basis and any required purchase order or approval.
- **R10.3:** Save the approved service variation as an effective-dated record. Update deployment requirements and invoice preparation from the same authorised change.
- **R10.4:** Keep request handling status, client approval, operational acceptance and invoice status separate. Preserve urgent exceptions for later review without inventing client consent.
- **R10.5:** Provide a client-visible history with deliberately published replies and decisions. Internal cost, staff pay and private notes remain inaccessible.

**Acceptance outcome:** A client requests two additional posts. Approval updates the staffing requirement and chargeable work exactly once, while the original contract and its earlier values remain reproducible.

**Build/integrate/phase recommendation:** Operational release: build on the shared Request and Approval models. Integrate communication channels only after permissions are proven.

**Do not:** Delivering extra work without a traceable change record; presenting a sent quote as accepted; exposing internal cost calculations to clients.

**Next decision/task:** Define which variations require client sign-off, a purchase order or senior commercial approval.

## R11. Site records and mobilisation readiness
**Status:** Proposed. **Research references:** [S02] [S16]

- **R11.1:** Create a site operational pack containing approved instructions, contacts, access arrangements, emergency information, post requirements, patrol definitions and reporting expectations.
- **R11.2:** Use versioned mobilisation templates based on service type, with tasks scheduled relative to go-live, dependencies and an owner role resolved to a named person.
- **R11.3:** Distinguish readiness gates from ordinary tasks: approved contract, verified contact chain, staffing, rates, site induction, documents, equipment and reporting configuration.
- **R11.4:** Record a go-live decision and any outstanding accepted business risks. A completed task does not automatically prove operational readiness.
- **R11.5:** Link site changes to affected staff, post orders and induction requirements, with version-specific acknowledgements where required.

**Acceptance outcome:** Moving a proposed go-live date recalculates only eligible incomplete tasks. Completed work retains its historical dates. A missing required site induction remains visible as a deployment blocker.

**Build/integrate/phase recommendation:** Foundation: site records and basic mobilisation templates. Operational release: fuller live-readiness controls.

**Do not:** Rebuilding a mobilisation checklist for every site; fixed due dates going stale; copying old task completion into a new deployment.

**Next decision/task:** Choose one static site and one event mobilisation as templates and identify genuine stop/go gates.

## R12. Events, accreditation and logistics
**Status:** Proposed. **Research references:** [S18] [S19]

- **R12.1:** Keep event planning and live delivery in the same event record. Version staffing plans, locations, command contacts, briefings and operational runsheets.
- **R12.2:** Distinguish employment eligibility, confirmed deployment and accreditation/access permission. A person must not gain every event zone merely because they have a valid staff account.
- **R12.3:** Add pass requirements, zone permissions, approval and issue history. Support a controlled export to the organiser’s accreditation system rather than assuming KSS owns the event gate system.
- **R12.4:** Capture transport and equipment requirements as linked tasks or resources. Add catering/accommodation only where a real KSS process justifies them.
- **R12.5:** Provide event-template reuse without carrying forward old staff confirmations, incidents, pass assignments or completion evidence.

**Acceptance outcome:** A confirmed member of staff whose zone authorisation is missing is shown as deployed but not access-ready. Reusing an event template creates new operational records and no historic attendance.

**Build/integrate/phase recommendation:** Operational release: build event records, versioned deployment and readiness. Integrate accreditation; defer public ticketing and unnecessary event-sales functionality.

**Do not:** Equating SIA validity with site/zone authorisation; creating a full public ticketing platform unrelated to KSS delivery.

**Next decision/task:** Map one festival’s organiser accreditation hand-off and one football fixture’s briefing, attendance and post-event approval chain.

## R13. Rostering, suitability and deployment decisions
**Status:** Proposed. **Research references:** [S20] [S08]

- **R13.1:** Make availability and compliance hard inputs to a suitability check. Evaluate the whole shift interval, required role, client/site induction and overlapping assignments.
- **R13.2:** Keep mandatory blockers separate from preferences such as travel practicality, continuity and equitable workload. Never optimise only for the lowest staff cost.
- **R13.3:** Return an explainable result for every proposed assignment: eligible, blocked or review required, with reason, evidence freshness and evaluated requirement version.
- **R13.4:** Use applicable, verified working-pattern rules; do not hard-code legal thresholds from a generic scheduling vendor page. Store the configured rule owner and effective date.
- **R13.5:** Require a planner to confirm published allocations. Recheck eligibility after material changes and before deployment; record warnings and permitted business exceptions.

**Acceptance outcome:** Two overlapping assignments are flagged. A qualification valid today but expired during next week’s shift blocks that proposed assignment under the configured requirement. The planner can see the reason without viewing private screening documents.

**Build/integrate/phase recommendation:** Operational release: integrate existing rostering initially where practical; build KSS eligibility and exception views. Defer unsupervised AI allocation.

**Do not:** Automated preference scores being mistaken for objective staff quality; exposing private HR material as the reason for rejection.

**Next decision/task:** Document mandatory qualifications and client/site requirements, then test actual rostering export/API capability.

## R14. Attendance, timesheets and pay/charge rules
**Status:** Proposed. **Research references:** [S21] [S30]

- **R14.1:** Preserve scheduled, observed, submitted, approved payable and approved billable hours as separate values. Record corrections with reason, author and history.
- **R14.2:** Use effective-dated pay and charge rules with explicit precedence. Store the selected rule/version and calculate a reproducible snapshot at approval or financial cut-off.
- **R14.3:** Handle overnight shifts, breaks, partial attendance, role changes within a shift, time-zone changes and daylight-saving transitions using agreed policies.
- **R14.4:** Lock posted periods. Later changes create controlled adjustment entries instead of rewriting the amounts behind an issued invoice or completed pay run.
- **R14.5:** Route missing rates, disputed hours, absent POs and duplicate submissions to an exception queue. Never substitute a zero rate silently.

**Acceptance outcome:** Approve a night shift, close its pay/invoice period, then change next month’s rate. Historic amounts remain unchanged and reproducible. A missing charge rule blocks invoice preparation instead of generating a zero-valued line.

**Build/integrate/phase recommendation:** Operational release: integrate attendance where supported, build approval and financial evidence controls. Payroll processing remains with the selected payroll system.

**Do not:** Checking in being treated as client-approved billable work; retroactive rate changes silently altering closed history; copying obsolete wage examples from vendor help.

**Next decision/task:** Create test examples for KSS pay/charge combinations, overnight shifts, breaks and disputed hours, with Finance-approved expected results.

## R15. Tasks, projects and reusable work templates
**Status:** Proposed. **Research references:** [S16] [S17]

- **R15.1:** Build a single Task record with owner, due date, estimate, priority, state, dependencies and linked records. Show it on personal, client, event or department views without duplicating it.
- **R15.2:** Provide a board and list view, then a calendar view where useful. Use named owners resolved from role templates rather than unassigned generic Office tasks.
- **R15.3:** Separate Not Started, In Progress, Blocked, Awaiting Approval and Done. A checklist tick is not automatically an approval or deployment decision.
- **R15.4:** Anchor repeatable event tasks to key dates: staffing request before event, briefing before arrival, hours approval afterwards and finance after the prerequisite is satisfied.
- **R15.5:** When dates move, show the effect before changing incomplete dependent tasks. Preserve completion history and prevent duplicate automated tasks using a source-event key.

**Acceptance outcome:** A fixture date changes. Its outstanding staffing and briefing deadlines move appropriately, while completed tasks and post-match approval history remain intact. The same task appears consistently in My Work and the event.

**Build/integrate/phase recommendation:** Foundation: build a focused task system; keep Trello as the development backlog until replacement use is deliberate.

**Do not:** Trying to reproduce every project-management feature; making all finance tasks due on event day; treating board-column movement as proof that work occurred.

**Next decision/task:** Agree task states and turn one recurring operational workflow into a tested relative-date template.

## R16. Patrols, checkpoints and site instructions
**Status:** Proposed. **Research references:** [S02]

- **R16.1:** Retain MagSecure as the initial patrol application and provide authorised site-aware launch links. Discover its data/export interfaces before replacing it.
- **R16.2:** Model a patrol as a scheduled requirement, a route or checkpoint set, actual observations and exceptions. Store the checkpoint ID independently of its displayed name or physical tag.
- **R16.3:** Support current approved instructions at a checkpoint and a structured defect/report action. A tag tap may open the correct checkpoint but must not by itself claim that the required inspection has been performed.
- **R16.4:** Record event time, server receipt time, device/source and user. Distinguish scheduled, started, partly completed, completed, missed and excused with reasons.
- **R16.5:** Use configurable reminders for missed patrols and faults; connect follow-up to the site/task record rather than leaving defects inside a patrol export.

**Acceptance outcome:** A staff member opens a checkpoint by NFC, records a defect and submits once. The patrol observation and a linked follow-up task appear against the correct site. A replayed request does not create duplicate observations.

**Build/integrate/phase recommendation:** Initial release: app hub and source mapping. Operational release: integrated status and follow-up; replace the patrol engine only after a demonstrated need.

**Do not:** Claiming a tag scan proves a full patrol or prevents all spoofing; migrating an operational app before staff can complete and reconcile real patrols.

**Next decision/task:** Test a real MagSecure checkpoint link, export format and staff authorisation flow, including failed connectivity.

## R17. Live incidents, command and handover
**Status:** Proposed. **Research references:** [S22] [S23]

- **R17.1:** Keep an original report with occurred-at and reported-at times, reporter, location, narrative and attachments. Triage it into an incident or link it to an existing case without destroying the original.
- **R17.2:** Add command owner, current situation, severity, assigned teams, outstanding actions and a chronological decision/activity log. Keep amendments attributable.
- **R17.3:** Use reusable incident playbooks with role-assigned actions. Escalation should require acknowledgement and a clear handover route, not just a notification being sent.
- **R17.4:** Provide a structured shift/command handover: open incidents, outstanding welfare concerns, equipment faults, staffing gaps and who has accepted responsibility.
- **R17.5:** Create separate restricted medical/safeguarding details and a deliberately approved operational or client summary. Never auto-publish a raw incident log to a client.

**Acceptance outcome:** Two reports about the same incident can be linked while retaining both originals. A handover records the accepting manager. A restricted safeguarding attachment is absent from the general status board and client export.

**Build/integrate/phase recommendation:** Operational release: build case linkage and handover using shared records; evaluate specialist incident tooling for complex command needs.

**Do not:** An editable free-text log with no correction history; claiming the app replaces radios, emergency services or trained incident command.

**Next decision/task:** Define incident categories, escalation responsibilities, minimum information and the separation between internal and shareable records.

## R18. Lone-worker welfare and escalation
**Status:** Proposed. **Research references:** [S02] [S36] [S41]

- **R18.1:** Add a separately assessed welfare/check-call requirement for relevant duties. Define expected check-in, grace period, escalation contact, acknowledgement and backup communication.
- **R18.2:** Show device/local status separately from server-accepted and responder-acknowledged alerts. Never display a successful SOS merely because it was saved on the phone.
- **R18.3:** Assess an established specialist service before relying on a newly built welfare engine. Document coverage limits, connectivity assumptions, failure response and test responsibilities.
- **R18.4:** Limit location collection to a justified operational purpose and scope. Complete the required privacy and employment review before adding tracking; do not add continuous off-duty tracking by default.

**Acceptance outcome:** In a supervised test, disable connectivity during an alert. The device states it has not been transmitted and provides the agreed fallback. A transmitted alert that nobody acknowledges is visibly escalated under the approved protocol.

**Build/integrate/phase recommendation:** Safety-gated workstream: integrate or pilot only after operational and privacy assessment; never make the MVP the sole emergency channel.

**Do not:** Treating a missed scan as automatic proof a guard is unsafe; false assurance from an offline panic button; unapproved employee surveillance.

**Next decision/task:** Confirm whether KSS needs a welfare service, who monitors it and what approved response/fallback must happen out of hours.

## R19. Assets, keys, equipment kits and visitor access
**Status:** Proposed. **Research references:** [S24] [S02]

- **R19.1:** Distinguish serialised assets, pooled accessories and consumables. Keep condition, availability, custodian, location and expected return against the correct item or quantity.
- **R19.2:** Create reusable kits for deployments, with issue/return acknowledgement, missing components, faults and maintenance tasks. Link each transaction to staff, site or event.
- **R19.3:** Give keys a restricted custody trail. A key record does not automatically grant access to all site instructions or alarm information.
- **R19.4:** Where a site requires it, add visitor/contractor preregistration, host/approval, sign-in/out and a current attendance list. Keep this separate from employee time recording.
- **R19.5:** Keep bodycam equipment inventory separate from video evidence access. Retain links to authorised evidence systems rather than assuming all footage belongs in general document storage.

**Acceptance outcome:** Issue a radio kit and return it with one damaged component. The kit is not shown as fully available and a maintenance action is opened. Key custody is traceable without exposing unrelated site access data.

**Build/integrate/phase recommendation:** Operational release for equipment; optional later visitor/contractor workflow based on actual site need. Evaluate integration with existing asset/evidence systems.

**Do not:** One spreadsheet row for a whole kit with no components; exposing security-sensitive keys or video to general office users.

**Next decision/task:** Define KSS asset classes and pilot a kit issue/return at one event and one permanent site.

## R20. Audits, compliance evidence and corrective actions
**Status:** Proposed. **Research references:** [S25] [S26] [S42]

- **R20.1:** Create versioned audit templates separate from inspection instances. A new inspection starts with unanswered observations and no carried-over photos, answers, signatures or completion claims.
- **R20.2:** Link each evidence item to the question/requirement it supports, its source, applicable site and period. Distinguish a reusable current certificate from a new observation photograph.
- **R20.3:** Require comments and evidence that match the specific question. A screenshot of a document index is not the certificate it lists; a generic weekly-check cover page is not evidence of the requested check.
- **R20.4:** Turn deficiencies into owned corrective actions with due date, evidence of correction and verification. Link an existing unresolved action rather than opening another copy at each audit.
- **R20.5:** Add a hazard/near-miss route and allow recurring issues to propose a briefing or training improvement. A responsible reviewer approves changed safety instructions or competency rules.

**Acceptance outcome:** Duplicate an audit template for a different store. No prior photographs or answers appear. A PAT evidence requirement opens the actual relevant certificate, and an unresolved action can be linked without duplication.

**Build/integrate/phase recommendation:** Foundation: evidence classification and action records. Operational release: richer audit workflow; integrate the existing Footasylum audit application first.

**Do not:** Pre-filling Yes as if a new check were completed; old images being passed off as current; software status being presented as certification of legal compliance.

**Next decision/task:** Test an actual Footasylum-style audit with certificate, question-specific weekly-check evidence and a repeat corrective action.

## R21. Expenses, receipts and reimbursement approval
**Status:** Proposed. **Research references:** [S27] [S28]

- **R21.1:** Use mobile receipt capture, expense category, amount/currency, date, business reason and linked assignment. Extracted receipt fields remain editable suggestions requiring staff confirmation.
- **R21.2:** Configure evidence and approval requirements by category and amount. Separate manager/business approval, finance validation and payment confirmation.
- **R21.3:** Prevent claimants approving their own claims; define a genuine alternative approver. Require a reason and audit event for permitted delegation or exceptional handling.
- **R21.4:** Flag possible duplicate claims for review, using available matching signals. Do not label a match as fraud automatically.
- **R21.5:** Keep draft, submitted, queried, approved, exported and paid states. After approval, material edits invalidate or restart the affected approval. Mark paid only from reconciled finance confirmation.

**Acceptance outcome:** A manager submits their own expense; it routes to another approver. A possible duplicate is flagged without an accusation. The employee sees approved but not paid until the payment reference is confirmed.

**Build/integrate/phase recommendation:** Early self-service release: build capture and status. Operational/finance release: integrate reimbursement processing and reconciliation.

**Do not:** Auto-paying an extracted receipt; an approval tick presented as a bank transfer; taking card or banking product availability for granted.

**Next decision/task:** Agree categories, evidence requirements, approval thresholds, payment confirmation source and treatment of mileage.

## R22. Payroll, accounting and invoicing
**Status:** Proposed. **Research references:** [S29] [S30] [S21]

- **R22.1:** Build invoice/payroll preparation around approved hours, contractual rates, approved expenses, purchase orders and effective-dated variations. Keep pay and billable lines separate.
- **R22.2:** Identify the existing accountant-approved systems before selecting connectors. Map staff/client IDs, account codes, tax handling, rounding, currency and financial period rules explicitly.
- **R22.3:** Send idempotent batches with source IDs, an approval snapshot and reconciliation. Distinguish queued, sent, accepted, rejected, posted and reconciled, retaining external references.
- **R22.4:** Handle partial rejection, corrections and credits through controlled workflows. Replaying a failed batch must not duplicate payroll items or invoices.
- **R22.5:** Show margins as estimates or actuals with their included/excluded costs. Do not call revenue less hourly pay true profit when employer costs or other expenses are missing.

**Acceptance outcome:** Export a batch, simulate partial failure, and retry. Only missing items are created; accepted records retain stable references. A payroll acknowledgement does not set employee reimbursement to paid.

**Build/integrate/phase recommendation:** Integrate statutory payroll, accounting, tax and payments. Build KSS-specific operational preparation, approvals, exceptions and commercial visibility.

**Do not:** A new in-house PAYE/tax/banking engine in the MVP; assuming Xero is KSS’s current provider; silent duplication after connector retries.

**Next decision/task:** Confirm payroll/accounting provider, supported interfaces, finance mapping and a sandbox reconciliation test with Finance.

## R23. Client portal and controlled publication
**Status:** Proposed. **Research references:** [S12] [S31]

- **R23.1:** Provide client-authorised requests, approved reports, selected KPIs, current service documents and relevant commercial status. Filter by explicitly assigned organisation and site.
- **R23.2:** Create a publishable report or approved snapshot rather than exposing a live internal record wholesale. Mark revision and reporting period clearly.
- **R23.3:** Keep client membership/roles separate from KSS staff roles and test contacts who represent more than one organisation.
- **R23.4:** Recheck permission when generating and retrieving exports. Use protected links with suitable expiry and audit download/share actions.
- **R23.5:** When using external BI, validate the embedded identity and role configuration; do not assume the report’s visual filters are a security control.

**Acceptance outcome:** A client user changes an invoice/report identifier and receives no other client’s data. A raw safeguarding incident remains hidden while its approved service summary can be published to the intended audience.

**Build/integrate/phase recommendation:** Later operational release after internal data and publication rules are proven. Integrate external analytics cautiously.

**Do not:** A client toggle that reveals raw incident tabs; giving clients administrative or contributor permissions in an analytics workspace.

**Next decision/task:** Agree a publish/share matrix with separate rules for incident summaries, audits, financial records and operational documents.

## R24. Reporting, business intelligence and operational measures
**Status:** Proposed. **Research references:** [S31]

- **R24.1:** Define a metric dictionary: owner, numerator, denominator, included records, exclusion rules, time window, freshness and classification. Example: covered post-hours must not be confused with the percentage of staff who responded.
- **R24.2:** Provide drill-through from every operational total to authorised source records and show missing or stale data distinctly from zero.
- **R24.3:** Distinguish scheduled, attended and approved hours; requested, filled and confirmed posts; submitted and verified compliance; estimated and reconciled financial results.
- **R24.4:** Use agreed contextual measures rather than unexplained staff performance rankings. Record why a KPI changed after late approvals or corrections.
- **R24.5:** Keep operational dashboards native where action is needed; evaluate external BI for cross-period analysis with separately tested permissions and export controls.

**Acceptance outcome:** A manager opens an unfilled-hours metric and reconciles it to its shifts. The same dashboard for a client excludes other sites and private cost fields. Missing patrol data reads unknown, not fully compliant.

**Build/integrate/phase recommendation:** Foundation for a few defined exception metrics; later analytics once source data reconciles.

**Do not:** Charts before definitions; client-side filters as isolation; confident percentages calculated from incomplete integration data.

**Next decision/task:** Agree the initial metric dictionary and validate each number against a small manually checked pilot dataset.

## R25. Knowledge base, trusted search and procedural guidance
**Status:** Proposed. **Research references:** [S32] [S06]

- **R25.1:** Use shared DocumentVersion records for policies and SOPs. Knowledge articles may explain procedures, but must link to the applicable controlled instruction rather than maintaining a second contradictory copy.
- **R25.2:** Give each article an owner, audience, reviewed date and review trigger. Mark expired verification or superseded instructions visibly.
- **R25.3:** Search across permitted records using context such as current site, role and event. Sensitive documents must not leak their titles or snippets through search results.
- **R25.4:** Capture unhelpful or unanswered searches as requests for the content owner. Keep staff questions and authoritative procedures distinct.
- **R25.5:** Expose the exact source version/date when presenting procedural guidance, especially when reused by the AI assistant.

**Acceptance outcome:** A superseded procedure no longer appears as the current answer. A person without HR access cannot discover a private article through search snippets, suggestions or AI citations.

**Build/integrate/phase recommendation:** Foundation: structured guidance and search. Later: richer verification and learning from unanswered questions.

**Do not:** A second folder of unofficial SOP copies; a permanent verified badge on an out-of-date procedure.

**Next decision/task:** Choose content owners and map the most common staff questions to approved procedures with review dates.

## R26. Existing app hub and integration management
**Status:** Proposed. **Research references:** [S01] [S29]

- **R26.1:** For each existing app define four possible levels: authorised launch, SSO, read-only data integration and controlled write-back. Do not promise a higher level before verifying it.
- **R26.2:** Register provider, owner, credentials scope, supported resources, external IDs, data direction, webhook/export availability, reconciliation interval and rate/plan limits.
- **R26.3:** Map Footasylum Audits, MagSecure, the unnamed training platform, SharePoint, rostering and finance individually. A launcher link is not data synchronisation.
- **R26.4:** Provide connection status, last successful sync, stale records, failed jobs and a retry/reconciliation queue. Keep secrets server-side and never put them in a client browser or prompt file.
- **R26.5:** Maintain one authoritative source for each field. Resolve conflicts and deletions deliberately; do not run ungoverned two-way sync between two employee masters.

**Acceptance outcome:** A connector is unavailable. The dashboard shows its last confirmed state and a visible stale warning, while the approved alternative workflow remains accessible. Retrying a sync does not duplicate staff.

**Build/integrate/phase recommendation:** Foundation for app hub and external-ID mapping; integrate progressively after capability tests.

**Do not:** Buying an integration platform before knowing the actual API needs; assuming SSO automatically enforces target-app permissions or record scopes.

**Next decision/task:** Complete a capability and ownership matrix for every named KSS system, including licence tiers and a sandbox test.

## R27. Shared approvals and workflow automation
**Status:** Proposed. **Research references:** [S33] [S34]

- **R27.1:** Build reusable ApprovalRequest, ApprovalStep and WorkflowRun models with the submitted record version, approver rules, due date, decision, reason and audit trail.
- **R27.2:** Preserve domain meaning: approving an expense is different from verifying a licence or posting payroll. A generic checkbox may drive a task but must not stand in for each domain decision.
- **R27.3:** Use retry-safe events and idempotency keys. Record workflow started, awaiting approval, failed, retried, cancelled and completed states with visible error ownership.
- **R27.4:** Use versioned templates, escalation and delegation. A material change to the underlying request invalidates the appropriate old approval rather than silently keeping it valid.
- **R27.5:** Expose a rule-explanation view so office staff can understand why a task or notification was generated. Critical approvals must not depend on a single person’s personal automation account.

**Acceptance outcome:** The same expense submission event is received twice and creates one approval request. Changing its amount after approval triggers the configured reapproval. A failed notification is visible and retryable without approving the expense.

**Build/integrate/phase recommendation:** Foundation for typed shared approvals and simple triggers; operational release for a broader rule engine. Integrate automation tooling where maintainable.

**Do not:** An undocumented chain of scripts; a workflow marked complete because an email was sent; using a task tick to certify a legal check.

**Next decision/task:** Choose initial triggers and approval routes, then specify retries, timeouts, fallback ownership and audit events.

## R28. Permission-aware AI assistance
**Status:** Proposed. **Research references:** [S35] [S37]

- **R28.1:** Retrieve only records the current user is allowed to access, including field-level and document-version restrictions. Filter before retrieval and again when returning actions or exports.
- **R28.2:** Return operational answers with their sources, dates and freshness. Say when evidence is missing; do not infer completed checks, approved hours or received payments from conversational hints.
- **R28.3:** Treat retrieved emails, reports and uploaded documents as untrusted content, not instructions to change permissions or perform actions.
- **R28.4:** Support summaries, drafts, missing-information explanations and proposed task lists first. For consequential actions show a preview, require authorised human confirmation and keep a full action log.
- **R28.5:** Prohibit autonomous disciplinary decisions, fabricated incident detail, waiving non-overridable compliance, publishing confidential reports or silently changing payroll. Avoid opaque staff suitability scores.

**Acceptance outcome:** A malicious instruction embedded in an uploaded document cannot cause data export or permission changes. A supervisor’s AI answer contains no private payroll fields. An unsupported financial question produces a stated information gap.

**Build/integrate/phase recommendation:** Later release after permissions, evidence quality and records are reliable. Build a narrow, audited assistant, not a parallel ungoverned workflow engine.

**Do not:** Adding a chatbot to messy overshared data and calling it secure; allowing AI-created summaries to become the original incident record.

**Next decision/task:** Create a test set of useful KSS questions, forbidden disclosures, stale-data cases and action-confirmation scenarios.

## R29. Mobile usability, offline work and synchronisation
**Status:** Proposed. **Research references:** [S36]

- **R29.1:** Classify each action as online-only, cached read, queued draft or safely replayable write. Publish an explicit capability matrix to developers and operational users.
- **R29.2:** Cache only the minimum necessary approved site instructions and records, subject to an agreed validity period and device controls. Sensitive content requires an explicit storage decision.
- **R29.3:** Show Saved on Device, Pending Upload, Server Accepted and Failed as different states. Preserve event timestamps, server receipt times and source IDs for conflict resolution.
- **R29.4:** Test attachment uploads, retries, duplicate submissions, expired sessions, account revocation, app backgrounding and device changes. Do not promise instant remote revocation on a disconnected device.
- **R29.5:** Keep emergency communication outside an unproven offline queue. Provide accessible layouts with no page-wide horizontal overflow and clear non-colour status cues.

**Acceptance outcome:** A guard captures an observation and photo without signal. They see pending upload, not submitted. Reconnecting uploads once and preserves the original observation time. An unsent emergency action clearly remains unsent.

**Build/integrate/phase recommendation:** Foundation for resilient forms and clear state; richer offline capture after a field pilot and storage/privacy decision.

**Do not:** A blanket works-offline claim; silent data loss or duplicate invoices after retries; storing unrestricted HR records in browser caches.

**Next decision/task:** Agree the smallest offline pilot and test it on actual iOS/Android devices under poor connectivity.

## R30. Engineering, Codex delivery, testing and production gates
**Status:** Proposed. **Research references:** [S37] [S38] [S39] [S40]

- **R30.1:** Turn every accepted feature into requirement IDs, explicit data/permission changes and executable acceptance tests. Keep an implementation ledger linking requirement, test, migration, code change and release evidence.
- **R30.2:** Use a modular source tree and documented architecture decisions. Separate domain logic, permission checks, integrations, UI, migrations and tests; do not let each module invent its own approval or document system.
- **R30.3:** Put project-specific instructions in AGENTS.md, including supported setup/test commands, protected data rules and a requirement not to claim tests were run when they were not.
- **R30.4:** Use development, test/pilot and production environments with protected credentials. Require review and a rollback plan for production changes, verifying that selected hosting/repository plans support the chosen controls.
- **R30.5:** Run role/client isolation, finance arithmetic, expiry, offline replay, document version and restore tests. Pilot with representative office and frontline users; go-live requires accountable operational sign-off.

**Acceptance outcome:** A release cannot be presented as ready without recorded test outputs, permission checks, migration/rollback procedure and an approved pilot decision. A restore test demonstrates that evidence links and authorisation still work.

**Build/integrate/phase recommendation:** Foundation across every phase. Tool choice and hosting remain to be confirmed from repository, skills, costs and data requirements.

**Do not:** One giant Codex instruction followed by an untested deployment; fake test results; production credentials or real sensitive staff files in prompts and fixtures.

**Next decision/task:** Create the repository delivery standard and choose one end-to-end pilot slice before estimating the rest of the build.

---

# Part C — Consolidated design and implementation instructions

Everything in this part is a **research-developed proposal**, unless it directly restates the existing planning baseline. It does not establish that a provider has been selected, an integration is available, a policy is legally sufficient, or a feature has been built.

## C1. Decisions that must not be silently conflated

A useful design must distinguish these states throughout the database, interface, reports and AI:

| Action or state | Does not, by itself, establish |
|---|---|
| Staff uploaded a document | An authorised person verified its validity |
| Staff completed an onboarding task | The person meets every deployment requirement |
| A course was assigned | It was completed and remains valid |
| A policy was acknowledged | The person understood it or holds the competency |
| A person is eligible for work | They are booked, confirmed or accredited for a particular zone |
| A guard tapped a checkpoint tag | They completed the required checks |
| A device saved a report locally | The server or control room received it |
| An alert was transmitted | A responsible person acknowledged and acted on it |
| Hours were recorded | They are approved for pay and/or client billing |
| An expense was approved | The claimant has been paid |
| An invoice batch was exported | The receiving finance system accepted it |
| A task checklist is complete | The service is safe to go live |
| Code was generated | Tests passed or production release is approved |

Use separate domain states, permissions and evidence for these differences. Do not solve them with ambiguous labels such as Complete or Approved everywhere.

## C2. Proposed navigation and record page conventions

### Office and Operations workspace

Retain all planned modules but group the navigation to avoid a long, unstructured sidebar:

```text
Home / My Work
    Priorities · My tasks · Approvals · Requests · Notifications
People
    Directory · Recruitment · Onboarding · Training · Leave/absence · Leavers
Clients and Growth
    Organisations · Contacts · Opportunities/tenders · Contracts · Client requests
Operations
    Sites · Events · Staffing · Attendance · Patrols · Incidents · Handover
Assurance
    Audits · Hazards/near misses · Corrective actions · Compliance
Resources
    Documents · Knowledge · Assets/kits · Keys · Approved app links
Finance
    Pay/charge rules · Hours approval · Expenses · Payroll preparation · Invoicing
Reporting
    Operational exceptions · Defined KPIs · Commercial analysis
Administration
    Users/access · Roles/scopes · Templates · Integrations · Audit · System settings
```

These are proposed navigation groups, not separate databases. Links and actions appear only when permitted. Financial, HR and safeguarding fields have their own controls even inside an otherwise accessible module.

### Employee workspace

Use a small mobile navigation: Home, Work, Inbox, Documents and Profile. Prominent shortcuts on Home expose Expenses, Training and Ask a Question. Work includes shifts, availability, tasks and site instructions. Inbox contains replies, requests for information and relevant announcements. Profile contains personal details, training, claims, leave and document status. Do not hide frequently used expenses or questions several screens deep simply to achieve five tabs.

### Client workspace

Use Overview, Sites/Events, Service Reports, Requests and Documents; show authorised financial information only to the appropriate client role. Keep internal incident investigation, raw personnel files, individual pay and cost/margin calculations outside this boundary.

### Common record design

Each record has a stable header, status, owner, authorised quick actions, contextual relationships and an activity timeline. Use separate tabs for Overview, Work/Actions, Documents, Related Records and History where applicable. A staff page additionally offers onboarding, training, shifts, claims and issued equipment, filtered to the viewer. Do not show inaccessible tabs with revealing counts.

Global search, dashboard cards, previews, notifications and exported reports must use the same access evaluation as the record itself. Support breadcrumbs, clear site/event context and return-to-record behaviour after opening a task.

## C3. Proposed access matrix

This is a starting matrix for review, not an approved KSS policy. A person may hold multiple time-limited assignments. Explicit denials and sensitive-data rules take precedence over broad scope grants.

| Role template | Normal scope | Typical capability | Important boundary |
|---|---|---|---|
| Platform Owner / Super Admin | Platform | Configure systems, appoint administrators, controlled emergency recovery | Sensitive data access and bulk exports remain explicit, attributable and reviewed |
| Admin | Authorised organisational configuration | User lifecycle, role templates, settings and integration administration | Not automatically a payroll approver, HR investigator or payment authoriser |
| Senior Operations / Operations | Assigned operations or company-wide operational scope | Mobilisation, staffing, incidents, service delivery and operational approvals | No default access to private HR, bank details or all individual pay rates |
| Office / HR / Recruitment | Assigned people and HR processes | Applications, checks, documents, onboarding, staff changes and leavers | Screening evidence and disciplinary cases are separately controlled |
| Finance / Payroll | Assigned financial records | Rates, hours validation, claims, payroll/invoice preparation and reconciliation | No self-approval of claims; payment authority distinguished from preparation |
| Compliance | Assigned requirements and assurance records | Verify evidence, manage review dates and corrective actions | Can see eligibility reason/status without unrestricted private case access |
| Event/Site Manager / Supervisor | Assigned sites, events and duty periods | Delivery, briefings, attendance, incident follow-up and kit | Does not inherit unrelated sites, client-wide finances or private staff records |
| Security Officer / Steward | Self and currently authorised assignments | Shifts, documents, training, claims, questions and operational reporting | Own files only, with limited assignment-specific operational content |
| Client User | Explicitly assigned client and sites | Published reports/documents, requests and permitted commercial status | No internal notes, other clients, employee payroll or raw safeguarding evidence |

For each module define the actions: view, create, amend, submit, verify, approve, publish, export, archive, restore and administer. Deletion is a separate governed operation, not a routine substitute for archive. Record which reason and approval are required for each consequential action.

A permission grant should record resource scope, assigning authority, effective dates and reason. Access review must explain why a user has access, including inherited and temporary grants. An effective-permission preview should not require impersonating a staff account or exposing its private data.

## C4. Proposed business file and evidence architecture

The visible structure is a logical browsing system over record-linked files:

```text
Company
    Governance / Policies / Insurance / Templates / Company guidance
People/{person-id}
    Application / Onboarding / Verified checks / Employment documents
    Training certificates / Staff-visible documents / Expense receipts
    Restricted HR cases / Issued-equipment acknowledgements
Clients/{client-id}
    Contracts / Variations / Approved reports / Shared documents
    Sites/{site-id}
        Site pack / SOPs and RAMS / Maps / Inductions / Audits / Service records
    Events/{event-id}
        Plans / Deployment versions / Briefings / Accreditation hand-offs / Debriefs
Operations
    Incidents/{incident-id} / Patrols/{patrol-id} / Handovers/{handover-id}
Assurance
    Templates / Inspection evidence / Certificates / Corrective-action evidence
Finance
    Purchase orders / Payroll preparation / Invoice evidence / Reconciliation
Assets
    Issue-return evidence / Maintenance / Key custody
Knowledge
    Articles and links to the applicable approved document version
```

A document can be discoverable from several authorised records without its binary being copied. The folder label does not define access. Linking a private HR file to an operational record must not widen its audience.

**Suggested metadata:** document ID, version ID, title, type, classification, owner, source system and external ID, related records, approval/publication state, effective date, review date, retention decision, content hash, MIME type, size, creator and timestamps. Use a separate audience/publication record for staff/client disclosure where helpful.

**Proposed lifecycle:** upload initiated → quarantined/validated → draft → review → approved → published → superseded or withdrawn → archived/retained. An uploaded file does not become approved simply because an administrator uploaded it. Preserve a historical version referenced by a signed contract, acknowledgement, investigation or financial record.

**Evidence distinctions:** a current certificate may be linked into multiple applicable inspections with its original provenance; a new observation must not inherit an old photograph, answer or sign-off. Label the evidence role explicitly. Capture the covered site and time period rather than treating any document of the right name as adequate proof.

**Storage and delivery:** use non-guessable object identifiers and server-authorised retrieval. Avoid unnecessary personal names in storage keys. If SharePoint remains the authoritative document source, preserve external IDs and do not create an uncontrolled second master. Validate uploads and protect pending files before they are published. Specify permitted offline caching and its expiry separately.

**Migration:** inventory → source mapping → classification review → duplicate/version review → trial import → counts/checksums and sample validation → permission tests → signed-off cutover → rollback/retention plan. Preserve the old source read-only for the agreed period where justified. Do not destroy the previous store merely because an upload job completed.

## C5. Proposed developer source structure

This is a framework-neutral organisational proposal, not a selection of language, hosting platform or database provider. First inspect any existing repository. Preserve working code and adopt its conventions where suitable.

```text
AGENTS.md
README.md
docs/
    master-specification.md
    research-and-sources.md
    decisions/                 # accepted architecture and scope decisions
    permission-matrix.md
    integration-register.md
    operational-runbooks/
src/
    platform/
        identity/
        authorisation/
        audit/
        documents/
        requests-and-approvals/
        tasks-and-workflows/
        notifications/
        search/
    modules/
        people/
        training/
        clients-and-contracts/
        sites-and-events/
        workforce/
        patrols/
        incidents-and-handover/
        assurance/
        assets/
        expenses/
        finance-preparation/
        reporting/
    integrations/
        documents-provider/
        training-provider/
        rostering-provider/
        audit-and-patrol-providers/
        accounting-and-payroll/
    interfaces/
        office/
        employee/
        client/
db/
    migrations/
    non-sensitive-test-fixtures/
tests/
    unit/
    integration/
    authorisation/
    end-to-end/
    finance-reconciliation/
    offline-and-retry/
    restore-and-migration/
```

Do not generate empty modules merely to make this tree look complete. Implement a verified vertical slice. Keep business logic out of duplicated page components; provider-specific API logic belongs in adapters. Treat storage keys, user-facing folders and source-code folders as three different design concerns.

## C6. Additional domain records and relationships

Extend, rather than replace, the original planned entities.

- **Person** is separate from **UserAccount**, **Employment/Engagement**, **RoleAssignment** and **Site/EventAssignment**. One person may have several dated engagements or roles. Avoid copying sensitive employee data into every shift record.
- **RequirementDefinition**, **RequirementVersion**, **VerificationEvidence** and **EligibilityAssessment** explain eligibility at a particular point in time. The assessment records applicable rules, evaluated dates, data freshness, blockers and authorised exceptions.
- **Request/Case** supports staff queries, client service requests and approved variations with distinct visibility. **ConversationEntry** distinguishes internal from requester-facing messages.
- **ApprovalRequest** references the submitted version and approval type. **ApprovalStep/Decision** records approver, authority, outcome, reason and date. Approval requirements can be sequential without every module inventing its own engine.
- **ContractVariation** stores proposed and approved scope/rates/effective dates and links to deployment requirements and invoice preparation. A request is not an approved variation until its decision is recorded.
- **Document**, **DocumentVersion**, **EvidenceLink**, **Acknowledgement** and **Publication** distinguish stored material, exact version, purpose of evidence, user acknowledgement and intended audience.
- **Shift**, **Assignment**, **AttendanceObservation**, **HoursSubmission**, **HoursApproval**, **RateVersion** and **FinancialSnapshot** separate operational facts from approved commercial treatment.
- **PatrolRequirement**, **Checkpoint**, **PatrolRun** and **CheckpointObservation** separate what was required from what was recorded. A physical NFC tag points to a checkpoint; it is not the observation itself.
- **Report**, **Incident**, **IncidentAction**, **DecisionLog** and **HandoverAcceptance** preserve originals and accountable operational decisions.
- **Asset**, **KitDefinition**, **AssetIssue**, **Return/ConditionRecord** and **MaintenanceTask** support custody and component availability.
- **ExpenseClaim**, **ExpenseLine**, **ReceiptEvidence**, **FinanceBatch**, **ExternalPosting** and **Reconciliation** retain approval, export and payment distinctions.
- **DomainEvent**, **WorkflowRun**, **IntegrationJob**, **ExternalRecordMapping** and **NotificationDelivery** make retries, failures and delayed confirmations visible.

Use relational constraints and stable IDs where appropriate. Define required audit events and retention rules by domain. Do not log passwords, access tokens, complete bank details or unrestricted copies of sensitive attachments in generic logs.

## C7. Integration decisions and boundaries

No API compatibility has been established by this research. The vendor references illustrate useful patterns; they do not prove the existing KSS apps can expose those functions.

| Current/planned area | Initial safe approach | Evidence needed before deeper integration |
|---|---|---|
| Footasylum Audits | Authorised launch and shared site references where possible | Owner, authentication, record IDs, evidence export, API/webhooks and write permissions |
| MagSecure | Site/checkpoint-aware links; preserve working patrol process | Identity handling, checkpoint link format, observations/export, offline/retry behaviour |
| Training platform | Retain as course/result source | Actual provider, launch/SSO support, completion export/API, renewal fields and content rights |
| SharePoint | Assess as retained controlled document store | Libraries/metadata, versions, permissions, service identity and source-of-truth decision |
| Rostering / PARiM where applicable | Integrate approved data before considering replacement | Actual configuration, fields, exports/API, rule versions and ownership of shift changes |
| Payroll/accounting | Keep the finance-approved engine | Provider, UK configuration, import/API, sandbox, mapping, idempotency and reconciliation |
| Email/calendar/messaging | Add narrowly scoped notifications or requests later | Approved business account access, identity matching, privacy and ownership |
| Bodycam/evidence platform | Link through authorised metadata | Evidence retention/access/export rules; never assume raw footage should be copied |

For every connector record the owner, access approval, permitted data, source of truth, stable identifiers, sync direction, failure queue, reconciliation method and supported licence tier. Never store credentials in this prompt, a Trello card or a front-end bundle.

## C8. Prioritised delivery proposal

There are no invented deadlines, budgets or staffing estimates in this proposal. Priorities are based on dependencies and the ability to validate the workflow safely; confirm them with David before authorising implementation scope.

**Gate 0 — Discovery and decisions.** Confirm system inventory, ownership, permission matrix, minimum pilot, document types, workflow responsibilities, data-handling requirements and the actual integrations. Record architecture decisions rather than letting Codex silently choose unverified dependencies.

**Release 1 — Shared foundation and a usable hub.** Build identity/permissions, people/client/site records, contextual navigation, approved app links, documents, simple tasks and a work queue. Use synthetic data first. Prove direct-API and document isolation before loading sensitive records.

**Release 2 — Complete staff self-service slice.** Office starts onboarding → staff supplies documents → authorised reviews → training status → eligibility. Add expenses and questions with tracked ownership/status; include the leaver/access-revocation path. Prove one complete workflow rather than shallow screens for every module.

**Release 3 — Operational pilot.** Add site/event mobilisation, versioned briefings, staffing, attendance, patrol status, incidents, handover, audits and equipment custody around a controlled site/event. Integrate existing working systems instead of switching everything off.

**Release 4 — Commercial traceability.** Validate pay/charge rules, payable/billable hours, variations, expense approvals, invoice/payroll preparation, exports, partial rejection and reconciliation. Finance signs off calculations using known test examples.

**Release 5 — Client service and analytics.** Add controlled client publication, client requests and reconciled metrics only after internal source data and permission rules are reliable.

**Release 6 — Advanced automation and AI.** Add cross-module rules and a narrow source-cited assistant after access controls, knowledge versions and evidence quality pass adversarial tests. Advanced scheduling optimisation, public event ticketing and extensive marketing tools remain optional backlog items.

**Separate safety gate.** Lone-worker/SOS capabilities require an approved response model, communications fallback, realistic testing and an explicit operational decision. They must not become the sole emergency process by accident during a software pilot.

## C9. Test scenarios to put into the Codex backlog

| Test ID | Scenario and required result |
|---|---|
| QA01 | User assigned to Site A directly requests Site B via API, search and download: denied without revealing sensitive content |
| QA02 | Role expires or employment ends: connected sessions lose access; historical approved records remain correctly retained |
| QA03 | A private HR document is linked to a site: it does not inherit the general site audience |
| QA04 | New SOP published: current view changes, prior acknowledgements retain the original version and required re-acknowledgement is generated |
| QA05 | All documents uploaded but one check not verified: onboarding remains blocked with an owned reason |
| QA06 | Qualification expires within a future shift: eligibility uses the full applicable period and the configured mandatory rule |
| QA07 | Leave request conflicts with a booked post: planner sees the conflict; the post does not silently disappear |
| QA08 | Staff pay query has internal finance notes: the employee and notifications show only permitted replies |
| QA09 | Client requests extra cover: only an approved variation changes chargeable requirements; repeat callbacks do not duplicate the change |
| QA10 | Event date moves: appropriate incomplete relative tasks reschedule; completed task history is not rewritten |
| QA11 | NFC link opens a checkpoint: the patrol is not complete until the required observation is submitted |
| QA12 | Device saves a patrol report offline: status remains local/pending; reconnecting creates one server observation with both event and receipt times |
| QA13 | A reported incident is corrected: original and attributed amendment remain; handover acceptance is auditable |
| QA14 | New audit from a template: no previous answers, images or signatures; a still-open corrective action can be linked |
| QA15 | Expense claimant is the normal manager: alternative approval is required; paid status waits for reconciliation |
| QA16 | A closed financial period is followed by a rate change: previous approved values remain reproducible; corrections use an adjustment |
| QA17 | Finance export partially fails then retries: no duplicated external invoice/payroll items and unresolved errors remain owned |
| QA18 | Client report identifiers are altered: no cross-client disclosure; reports contain only deliberately published records |
| QA19 | Integration feed stops: dashboards show stale/unknown rather than asserting current compliance |
| QA20 | Malicious instructions appear in a document retrieved by AI: no unauthorised action or disclosure occurs |
| QA21 | A restored backup is used in a test environment: linked documents, original versions and permissions reconcile to the expected records |
| QA22 | Mobile viewport and keyboard reduce available space: no page-wide overflow; required controls remain usable and state is not colour-only |
| QA23 | Welfare alert cannot transmit: clear unsent status and approved fallback; no false confirmation of responder acknowledgement |
| QA24 | User approval is followed by a material record amendment: the relevant approval is invalidated or repeated under the correct rule |

Tests require fixtures, assertions and recorded execution. Merely listing a test or generating a test file does not mean it passed.

## C10. Instructions for the next Codex build task

Read this full specification, the research register and the accepted decision log. Inspect the existing repository and explain the current implementation, if any, before proposing changes. Do not create an unrelated new app or replace the stack without a recorded reason.

Treat the original planning baseline as the target concept, not proof that each feature has final requirements. Treat R01–R30 and Part C as proposals until their scope and relevant assumptions are approved. Select a small coherent release slice and list the decisions necessary for it. Keep unresolved future features in the backlog without blocking unrelated safe progress.

For the selected slice produce a requirement-to-test map; required schema changes; authorisation rules; UI routes and error states; integrations with confirmed capabilities; migration and rollback instructions; and a verification plan. Implement in reviewable increments. Reuse the shared document, approval, request, task and audit models.

Use only non-sensitive fixtures unless explicitly authorised otherwise. Never insert production tokens, banking data, screening documents or confidential case material into the repository, test artefacts or agent prompts. Ask for approved access only when required, not as a pretext to stop unrelated design work.

Report exact files changed, migrations and tests actually executed, results, remaining failures, assumptions and next decisions. Do not mark a Trello feature complete, a production gate passed or a financial integration reconciled without evidence. Production release remains a separately authorised action with operational ownership, backups and rollback.


---

# Part D — Research references

## Reference register

Official product/help/reference pages retrieved for this review on 22 September 2026. URLs are provided for verification. Feature availability can depend on product edition, region, contract and configuration. No vendor performance or ROI claims have been adopted as measured facts.

## S01 — Trackforce / TrackTik — integrated security operations
`https://www.trackforce.com/products/tracktik/`

## S02 — Trackforce / TrackTik — guard management
`https://www.trackforce.com/products/tracktik/guard-management/`

## S03 — TrackTik Help — Operation Tools
`https://support.tracktik.com/hc/en-us/articles/360060062994-Operation-Tools`

## S04 — Microsoft Entra — Privileged Identity Management
`https://learn.microsoft.com/en-us/entra/id-governance/privileged-identity-management/pim-configure`

## S05 — SharePoint — require content approval
`https://support.microsoft.com/en-us/sharepoint/lists/documents-and-library/require-approval-of-items-in-a-list-or-library`

## S06 — SharePoint — how versioning works
`https://support.microsoft.com/en-us/sharepoint/lists/documents-and-library/how-versioning-works-in-lists-and-libraries`

## S07 — BambooHR UK — onboarding and offboarding
`https://www.bamboohr.com/uk/platform/onboarding/`

## S08 — Moodle Workplace — compliance training automation
`https://moodle.com/news/simplify-automate-and-track-compliance-training-with-moodle-workplace/`

## S09 — Moodle Workplace — dynamic training rules
`https://moodle.com/news/make-mandatory-staff-training-stress-free-with-moodle-workplace/`

## S10 — Connecteam — pop-up updates
`https://help.connecteam.com/en/articles/6510543-pop-up-updates`

## S11 — Connecteam — time-off requests
`https://help.connecteam.com/en/articles/6451954-how-do-i-approve-time-off-requests`

## S12 — Jira Service Management — request channels
`https://support.atlassian.com/jira-service-management-cloud/docs/what-are-request-channels/`

## S13 — Jira Service Management — request types and work types
`https://support.atlassian.com/jira-service-management-cloud/docs/whats-the-difference-between-request-types-and-issue-types/`

## S14 — HubSpot — record associations
`https://knowledge.hubspot.com/records/associate-records`

## S15 — HubSpot — record activity timelines
`https://knowledge.hubspot.com/records/filter-activities-on-a-record-timeline`

## S16 — Asana — project and task templates
`https://asana.com/features/workflow-automation/project-task-templates`

## S17 — Asana — deadline-bound and ongoing workflows
`https://help.asana.com/s/article/blueprints-for-deadline-bound-projects-and-ongoing-processes`

## S18 — Eventree — event advancing and accreditation
`https://eventree.co.uk/`

## S19 — Blerter — event operations capabilities
`https://www.blerter.com/pricing/`

## S20 — Deputy UK — auto-scheduling
`https://www.deputy.com/gb/features/auto-scheduling`

## S21 — PARiM — pay and charge rules
`https://support.parim.co/en/articles/3752018-pay-and-charge-rules`

## S22 — D4H — incident status boards
`https://www.d4h.com/features/status-boards`

## S23 — D4H — incident tasks and checklists
`https://www.d4h.com/features/incident-tasks-checklists`

## S24 — Snipe-IT — asset management features
`https://snipeitapp.com/product`

## S25 — SafetyCulture — preventing duplicated inspections
`https://help.safetyculture.com/004827`

## S26 — SafetyCulture — linking existing inspection actions
`https://help.safetyculture.com/002685`

## S27 — Ramp — review policies and separation of duties
`https://support.ramp.com/setting-up-expense-review-policies-for-transactions-and-reimbursements/`

## S28 — Ramp — conditional expense submission policies
`https://support.ramp.com/submission-policies/`

## S29 — Xero UK — time-tracking integration patterns
`https://apps.xero.com/uk/function/time-tracking`

## S30 — Xero UK Payroll API — types and status codes
`https://developer.xero.com/documentation/api/payrolluk/typesandcodes`

## S31 — Power BI — row-level security and workspace role limitations
`https://learn.microsoft.com/power-bi/enterprise/service-admin-rls`

## S32 — Notion — wikis, owners and verified pages
`https://www.notion.com/en-gb/help/wikis-and-verified-pages`

## S33 — Power Automate — approvals
`https://learn.microsoft.com/en-us/power-automate/get-started-approvals`

## S34 — Power Automate — error handling
`https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/error-handling`

## S35 — Microsoft 365 Copilot — data and security
`https://learn.microsoft.com/en-us/microsoft-365/copilot/security-microsoft-365-copilot`

## S36 — SafetyCulture — supported offline features and limitations
`https://help.safetyculture.com/002907`

## S37 — OWASP — Application Security Verification Standard
`https://owasp.org/projects/asvs`

## S38 — Playwright — test projects
`https://playwright.dev/docs/test-projects`

## S39 — GitHub — deployment environments and protection rules
`https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments`

## S40 — OpenAI — how OpenAI uses Codex
`https://openai.com/business/guides-and-resources/how-openai-uses-codex/`

## S41 — ICO — monitoring workers
`https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/employment/monitoring-workers/data-protection-and-monitoring-workers/?search=example`

## S42 — Blerter — hazards in event operations
`https://support.blerter.com/en/articles/2268788-about-hazards`


# Revision record

- **v1:** Original brainstorming export retained in Part A.
- **v2 — 22 September 2026:** Added 30 separately researched capability areas; proposed improvements, safeguards, decision status, file/navigation/access detail, integration boundaries, test scenarios and phased implementation guidance. No claim that these features have been built.


# Part E — Bounded build execution and economical agents

The following delivery policy elaborates the earlier high-level roadmap. It does not approve every proposed feature or authorise a production build.

# KSS — Codex Build Playbook and Cost-Controlled Agent Policy

**Version:** 1.0, 22 September 2026  
**Related master:** v2.1 (v2 requirements preserved; this delivery policy added)  
**Status:** Proposed delivery sequence and ready-to-use task instructions. No KSS code has been built, no live client configuration has been inspected, and no model settings have been activated by this pack.

## The decision

Give Codex access to the whole plan, but authorise only a small current task. Do not say “build the entire enterprise application”. Use an economical lead, specialised workers only when useful and stronger review where mistakes would be expensive.

## How to use the files without feeding everything into every task

The master is the destination and invariant reference. The phase prompt is the current work boundary. A small task packet is the actual implementation instruction. `STATUS.md` is the handover between sessions. Repository instructions state the working rules, not the entire product specification.

Place the master and research in `docs/specification/` and `docs/research/`. Keep `AGENTS.md` short, with pointers, security invariants and scope/agent policy. Do not paste the whole master into it. Codex automatically reads repository instructions and applies an instruction-size limit; this is a reason to keep operational rules concise and load specification sections deliberately. [O4]

In Phase 00 the lead reads the full master once and creates a requirement map. For later tasks, it reads the map, relevant specification sections, recorded decisions and the current code. Workers get the relevant subset and cross-cutting rules. A fresh session should use `STATUS.md` and evidence files, not rely on remembered chat. If an indexed requirement changed, reload and reconcile it rather than trusting an old summary.

### One working loop

**Choose a phase → choose one bounded task → inspect dependencies → implement → run tests → review risk → demonstrate → record evidence → stop.**

A phase is not one enormous generation. Split it into small pieces such as `03B — upload, review and verify one required document`. The phase prompt provides that split. By default execute only the first ready bounded piece, not the whole phase and never the next phase. David may authorise a specific batch of named tasks, but that does not authorise later product scope, paid providers or production.

For each piece, deliver functioning UI + server/domain handling + persistence + authorisation + relevant tests. Do not build twenty mock screens before one end-to-end journey works. Where a provider is unknown, use a clearly labelled development adapter behind a contract; distinguish a local demonstration from a verified integration. Do not invent financial, employment or operational policies to unblock production.

### Ready before implementation

The task records its user outcome, applicable requirements, dependencies, scope and exclusions, agreed sensitive rules, affected schema/files, interfaces, test cases and stopping point. A single task should have one coherent outcome and a reviewable change. Do not use arbitrary line limits to force unsafe designs. Needed upstream changes must be identified and completed/reviewed before parallel downstream writers start.

### Finished before another phase

Keep separate statuses: Planned; Ready; In Progress; Implemented; Locally Verified; Human Acceptance Pending; Accepted for Next Phase; Approved for Pilot; Production Approved. A checked Trello item or a generated test does not move software through these stages automatically.

A completion report contains actual changed files, migrations, test commands and outputs, failed/not-run checks, screenshots/demo steps where available, security/data impacts, remaining blockers, model use and the next recommended task. The lead integrates worker changes and reruns affected end-to-end tests. A reviewer returns findings with file references, not a broad "looks good".

David approves moving to the next phase after the agreed demonstrations. Routine file edits inside the authorised piece should not produce constant permission questions, but new spend, destructive migration, sensitive data use and release remain separate decisions.

### First useful release

Aim first for Phases 01–04: secure login/shared records, controlled documents/tasks, onboarding/training and the employee portal. This yields a usable office-to-employee journey with expenses and questions, before full operations and finance are rebuilt. Existing apps remain available through authorised links or verified adapters.

Apply the Phase 11 **release gate to that limited scope** before any live pilot. Phase 11 is not permission to postpone security or testing until the end, nor a requirement to finish every optional future module before releasing a safe small pilot. Later phases extend the product incrementally.

### Change control and real-world dependencies

The user has approved preparing this delivery policy, not every research suggestion or implementation. R01–R30 stay Proposed unless the decision log records acceptance. Resolve current-task essentials; defer unrelated unknowns without blocking all development. Never silently remove a difficult requirement or describe its adapter as complete when only test data exist.

Integrations are checked with the phase that first needs them. Payroll accounting and course delivery remain specialist-engine candidates; this plan is not a decision to replace PARiM, SharePoint, MagSecure, Footasylum Audits or the unnamed LMS. Data migrations, privacy/retention, hiring decisions, payroll rules and emergency processes require the appropriate KSS owner.


## Recommended build sequence

The numbers below are implementation phases, distinct from the board’s general Ideas → Design → Build → Test → Live status lists. Each phase card/task can move through those lists. Do not treat a list named Production as proof the feature is deployed.

| Phase | Deliverable | Visible proof |
|---|---|---|
| 00 | Inspect, plan and prepare the build | A repository-aware build plan, verified capability/model map and first implementation task ready for David to approve. No application build is claimed. |
| 01 | Secure foundation and shared records | An office user and a test employee sign in, see different permitted workspaces and access the same underlying records only within their scopes. |
| 02 | Controlled documents, tasks and basic approvals | The office publishes a site instruction, the right employee acknowledges that exact version, and an assigned task is tracked to completion. |
| 03 | Onboarding, verification and training status | Office creates one new starter; the employee uploads evidence; an authorised reviewer verifies it; training evidence produces an explained eligibility result. |
| 04 | Employee portal, questions, expenses and lifecycle | A test employee finds documents/training, asks a pay question, submits an expense and tracks the response without seeing internal notes or approving their own claim. |
| 05 | CRM, client requests and mobilisation | A prospect becomes a client without duplicate records, launches a site mobilisation and records an authorised request for additional cover. |
| 06 | Events, staffing, attendance and approved hours | Create one event or recurring site shift, allocate an eligible test worker, record attendance and separately approve payable and billable hours. |
| 07 | Operational delivery, evidence and equipment | A checkpoint observation or audit defect becomes an owned action; a supervisor can hand over an incident and track equipment without losing original evidence. |
| 08 | Finance preparation and specialist integration | Approved test work produces a reproducible pay/invoice preparation batch that survives a partial export failure and reconciles without duplication. |
| 09 | Client portal, controlled reports and analytics | An authorised client sees an approved report for its site; its totals reconcile to permitted source work and no other client/private staff data is exposed. |
| 10 | Broader automation and permission-aware AI | A user gets a cited explanation of a missing requirement or uninvoiced work and can explicitly approve a permitted suggested action. |
| 11 | Pilot and production readiness — reusable release gate | An accountable owner can approve a defined release using executed test evidence, migration/restore results, monitoring, support and rollback instructions. |


Each phase has its own file in `prompts/`, with scope, exclusions, suggested small tasks, model allocation and acceptance checks. There are twelve phase files (00–11). This is a sequence, not a promise of twelve single-session builds. Not every future feature must be included in the first release.

## Cost-aware lead and agent policy

This is a proposed **development workflow**, separate from the AI assistant that might later run inside the KSS product.

| Work | Proposed starting model | Reasoning starting point |
|---|---|---|
| Routine lead work and bounded feature implementation | `gpt-5.6-terra` | Medium |
| Specific read-only file lookup, test fixtures, documentation, repeatable small UI tasks | `gpt-5.6-luna` | Low/Medium according to the task |
| Architecture decisions, complex debugging, permission/financial/evidence review | `gpt-5.6-sol` | Medium; High for a justified difficult review |
| Hard unresolved cross-system problem after cheaper approaches have been assessed | `gpt-6-astra` | Explicit user approval; choose effort for the specific problem |

These starting choices are not a benchmark guarantee. The lead can recommend a different available model by stating the task, risk and reason. Measure cost to obtain a **passing, reviewed result**, including rework, not just unit token price. For a difficult sensitive change, starting at Sol can be cheaper than repeatedly failing at Luna. Conversely, do not make Sol or Astra review every label change.

Use Terra as the ordinary lead after initial architecture preparation. Use Sol for the bounded Phase 00 architecture review and for high-risk approval/security/finance work. Use Luna only when the expected output is explicit and readily checkable. A model called "reviewer" is not an independent professional security assessment.

### Rules to put into the project instructions

1. Delegate only where a separate task adds value. Prefer one agent for a small serial change. Permit **at most two concurrent subagents in addition to the lead**; default to one. Do not create one agent per future module.
2. No nested delegation. Use at most four subagent launches per bounded task without returning a new plan to David. These are project policy limits; the concurrency setting alone does not enforce a total spending ceiling.
3. Set the intended model and effort explicitly. Record the actual observed model/effort where the runtime exposes them. If not observable, say so. Never claim that writing a model name into a prompt has switched a running agent.
4. Every delegate receives a small task packet: objective, applicable requirement IDs, invariants, precise files/context, ownership, acceptance tests, model/effort, stopping point and return format. It may request missing context from the lead rather than guessing. Do not send the entire master and chat history to each worker.
5. Assign exclusive write ownership. Independent readers/tests can run concurrently; writers must not race on shared schema, permission policy, dependencies, lockfiles or route registries. Isolated worktrees/branches help only when supported and understood; they do not remove merge conflicts. The lead owns integration.
6. Perform one implementation attempt and at most two focused repair cycles on the same failure. Then narrow the task, escalate to an appropriate permitted model or report the precise blocker. Do not loop indefinitely or rewrite unrelated modules.
7. Luna → Terra → Sol escalation may be selected within an already authorised task for a recorded reason. Astra, more concurrency, added paid services or a new billing/authentication route require separate approval. Repeated Sol use is not a substitute for returning to scope when stuck.
8. Use normal/Standard speed and modest effort by default. Do not enable Fast, Max or Ultra merely to make every task "better". Verify supported settings; do not invent a configuration key.
9. Keep a per-task usage ledger. Record model, role, launches, attempts, tests and actual usage/credits/cost only when reported by the runtime or dashboard. Mark unknown metrics as not available; do not estimate an exact bill from elapsed time or text length.
10. Never bypass workspace restrictions, approval policy or sandbox rules to spawn a worker, switch model or run a test. Read-only role settings are defaults subject to the effective runtime policy, not a guarantee against every interactive override.

### What model configuration can and cannot do

Codex documentation supports model-specific subagents and configurable defaults. Defaults/custom-agent settings matter because unspecified workers may inherit the parent; custom-agent files can take precedence over requested defaults. Account/client availability and managed configuration still apply. Verify the effective settings rather than assuming a prompt is enforcement. [O1–O3, O6]

A lead cannot be assumed to reconfigure its own active model mid-turn. Select the lead model using the supported app/CLI controls; project defaults apply as supported for new sessions. The templates here are deliberately **inactive** until checked and merged. If this client cannot choose worker models, use one agent at the selected economical model or report the supported fallback; do not fake a multi-model team.

### Billing interpretation

With included ChatGPT/Codex usage, this policy aims to make the allowance last longer; it does not lower the fixed subscription fee. Purchased credits and API billing are different charging routes. Exact consumption depends on the route and work performed. Subagent work is additional usage, not free parallel capacity. A written spending instruction is a behavioural limit, not a provider-enforced hard financial cap. [O2, O5]

Do not switch to API billing, buy credits or enable paid tools automatically. Before an externally metered batch, agree a budget and use whatever actual metering/enforcement the provider offers; stop when the agreed threshold can be observed. When it cannot be observed, use bounded task/attempt limits and return for review, without claiming a guaranteed cash ceiling.


## Initial model configuration

`configuration-templates/` contains a small project configuration and four named worker definitions. Keep them inactive until Codex checks installed-client compatibility, available models and existing configuration. Merge selectively into `.codex/config.toml` and `.codex/agents/`; never replace global settings, change billing or weaken permissions.

The proposed parent/default lead is Terra Medium. The fallback subagent default is Luna Medium, so a strong parent does not silently make every child equally expensive. The normal implementation worker explicitly uses Terra; the risk reviewer explicitly uses Sol. Parent and worker settings are different controls. Defaults are not an unbreakable model allow-list. [O1–O3]

For Phase 00, select Sol Medium for the initial architecture work when available; ordinary follow-on work returns to Terra. Astra is an approved escalation, not the default parent or worker. Verify actual runtime settings on new sessions and after changes. No model is automatically switched by this downloadable document.

## Progress and evidence files

Use `docs/delivery/STATUS.md`, `DECISIONS.md`, `MODEL_ROUTING.md` and `USAGE_LEDGER.md`. Store individual task plans, reports and executed-test evidence under a small delivery subfolder created as needed. Keep them factual and short; do not dump private logs, secret credentials, entire repository contents or hidden reasoning into the ledger.

Create requirement-to-task/test coverage from R01–R30 and QA01–QA24. Do not mark the entire phase complete while provider work or security verification remains unresolved. Trello mirrors accepted decisions and verified status; it does not replace the Git change/test evidence.

## Practical continuation instructions

To continue within a phase: “Read STATUS.md and execute the next ready bounded task in Phase 03 only. Apply the model policy, test and report. Stop before another phase.”

To approve a phase transition: “I accept the demonstrated Phase 03 outcomes. Start the first ready bounded task in Phase 04, without production deployment.”

To resolve a review: “Fix the demonstrated findings in this task only. Preserve unrelated changes and rerun the affected tests. Do not use Astra or increase concurrency without approval.”

## Important boundaries

No token or credit saving has been measured yet for KSS. No provider purchase, new paid service, live payroll, client email, production import or deployment is authorised by these files. AI reviewers do not replace accountable human review where operational, financial or privacy risk requires it. The early pilot needs the same appropriate safeguards as a later release.

## Official reference notes — checked 22 September 2026

These sources verify Codex behaviour, not the quality, completion or cost of this KSS implementation. The phase order, concurrency limit, attempt limit and role policy are project recommendations.

- **O1 — Codex models:** `https://developers.openai.com/codex/models` (redirects to `https://learn.chatgpt.com/docs/models`). Current model identifiers, account/client availability and model controls.
- **O2 — Subagents:** `https://developers.openai.com/codex/subagents` (redirects to `https://learn.chatgpt.com/docs/agent-configuration/subagents`). Model inheritance, per-agent configuration and delegation.
- **O3 — Configuration reference:** `https://developers.openai.com/codex/config-reference`. Keys for default subagent model/effort and concurrency.
- **O4 — AGENTS.md:** `https://developers.openai.com/codex/guides/agents-md`. Repository instructions and their discovery/size limits.
- **O5 — Codex pricing/usage:** `https://developers.openai.com/codex/pricing`. Included usage, credits, API distinction and usage visibility.
- **O6 — ChatGPT sign-in:** `https://help.openai.com/en/articles/11369540`. Account/client availability and managed controls.

Recheck model availability and configuration compatibility in the actual installed client before activating templates. No numeric saving or total build price is promised. Older master product-research citations are preserved as supplied, not all re-researched for this delivery-policy update.



## v2.1 revision note

22 September 2026: Added phased task execution, model-routing policy, delegation/attempt limits, first-useful-release scope, verified configuration references and observable progress/usage reporting. No application code, agent installation or production work was performed.
