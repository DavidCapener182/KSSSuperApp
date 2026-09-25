# PRODUCT-05 commercial workspace implementation review

Date: 25 September 2026. Branch: `product-05-handoff` in `/private/tmp/kss-product-05-handoff`, based on integrated Candidate 2 `e9963af`. The shared checkout and frozen Candidate 1 were not edited.

## Implemented for review

- CRM Overview gives due/overdue Opportunity follow-ups, approaching decisions, a clearly bounded recent sample without future follow-up, recent Won handoff links and active pipeline facts before historical inventory.
- Pipeline cards prioritise title, Organisation, estimate, Opportunity owner, expected decision and next Task; stage movement is secondary. The existing guarded transition remains authoritative. Mobile continues to select a stage before showing its cards.
- Organisation, Contact and Opportunity lists use distinct commercial rows. Organisation and Opportunity records put relationship, primary Contact, next action and Won handoff above secondary activity entry. Manual activity entry stays separate from existing factual history and correction.
- A guarded commercial handoff projection joins exact Organisation, Opportunity, Mobilisation, linked Site/Site Service/Event and continuing Service Delivery facts. Invalid source links redact source identity and display `RESTRICTED_OR_CHANGED`.
- Mobilisation portfolio adds owner, target date, unresolved action and blocker counts, and next work. Creation journeys retain exact Organisation/Mobilisation context into Site, Event and Site Service, then return an exact source ID for an explicit link. Service Delivery start remains a separate guarded action after a recorded handover.
- A prominent **New lead** action now opens a guided existing/new Organisation choice and a New Lead Opportunity form. It uses the existing guarded Organisation and Opportunity writes, confirms each source record before advancing, and retains a separately saved Organisation if Opportunity creation fails. Existing business Contacts can be selected; a new Contact can be added in the Organisation workspace after creation.
- [Research reconciliation](../product-review/PRODUCT-05-COMMERCIAL-WORKSPACE-DESIGN-MAP.md) maps studied product patterns to KSS jobs and contract gaps. [Synthetic visual scenario](../product-review/prototypes/product-05-commercial.html) uses fictional examples and is not source evidence.

## Checks and gates

| Check | Result |
| --- | --- |
| `git diff --check` | Passed |
| `npm run lint` | Passed with one pre-existing unused-variable warning in `tests/site-horizon-maintenance.test.mjs` |
| Development-configured Next build | Passed, including TypeScript and the new `/crm/new-lead` route. Build used the existing synthetic Development public settings; no deployment. |
| Focused CRM, Mobilisation and Service Delivery tests | Seven of nine passed on the first network-enabled run. The two route tests redirected because the build still contained placeholder public settings. Rebuilding with Development settings and rerunning the CRM suite passed all four CRM tests, including both route tests. |
| Database read contract | Applied `product_05_commercial_handoff` and a follow-up `product_05_handoff_source_case_fix` migration to dedicated synthetic Development. The first Office handoff read exposed a SQL `CASE` error; the correction fixed it. Office readback returned 21 Mobilisations, 40 exact source links and one Service Delivery for a synthetic Client. Office portfolio returned 56 total and two paged items. Anonymous, Operations, Staff, guessed Organisation and mismatched Opportunity reads were denied. |
| Security advisor | The two new RPCs trigger the expected `authenticated_security_definer_function_executable` warning because they are intentionally callable by authenticated Office/Super. Each function checks `private.crm_authorised()` internally; anonymous and non-Office persona readbacks were denied. |
| Authenticated desktop and mobile browser | Captured the 1440px CRM surfaces, account, Opportunity, activity interaction, handoff and portfolio; captured 390px Pipeline, Opportunity and New lead. At 390px Pipeline and Opportunity document widths equal 390px; no visible interactive target was below 44px after the shell brand correction. Keyboard Tab focused the skip link with a solid visible outline. |

## Review evidence

| Surface | Authenticated Development screenshot |
| --- | --- |
| Overview and New lead entry | [1440px Overview](../product-review/prototypes/overview-1440.png), [1440px New lead](../product-review/prototypes/new-lead-1440.png), [390px New lead](../product-review/prototypes/new-lead-390.png) |
| Active Pipeline and cards | [1440px Pipeline](../product-review/prototypes/pipeline-1440.png), [390px Pipeline](../product-review/prototypes/pipeline-390.png) |
| Organisation, Contacts, Opportunities | [Organisation list](../product-review/prototypes/organisations-1440.png), [account record](../product-review/prototypes/account-1440.png), [Contacts](../product-review/prototypes/contacts-1440.png), [Opportunities](../product-review/prototypes/opportunities-1440.png) |
| Opportunity and follow-up | [1440px record](../product-review/prototypes/opportunity-1440.png), [390px record](../product-review/prototypes/opportunity-390.png) |
| Activity and keyboard | [Activity collapsed](../product-review/prototypes/activity-collapsed-1440.png), [activity expanded](../product-review/prototypes/activity-expanded-1440.png), [390px keyboard focus](../product-review/prototypes/opportunity-390-keyboard-focus.png) |
| Commercial to operations | [Handoff](../product-review/prototypes/handoff-1440.png), [Mobilisation portfolio](../product-review/prototypes/mobilisations-1440.png) |

The authenticated database contains accumulated synthetic regression fixtures, so these screenshots prove the screens and read paths but are weak evidence of a polished populated scenario. The [separate fictional visual scenario](../product-review/prototypes/product-05-commercial.html) is explicitly static and was not submitted to the database. Browser policy blocked agent navigation to that local file; David opened it separately in the app. The New lead form was inspected and its existing-Organisation search returned authorised matches, but no new lead was submitted in the browser. Exact source creation/link return journeys were code-reviewed and source tests passed; they were not walked end to end in this browser session.

This is an implementation candidate in synthetic Development, not human accepted or deployed to staging/production. The focused tests created their usual synthetic records. No real KSS data, live integrations or paid services were added.
