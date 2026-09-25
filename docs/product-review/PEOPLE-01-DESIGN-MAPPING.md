# PEOPLE-01 visual correction: design mapping

Prepared before the revised implementation, 25 September 2026. Sources: UI01 competitive research, PRODUCT-02 People review, and the linked public vendor pages. Vendor material is a workflow comparator, not a tested product contract.

| Researched pattern | KSS requirement | Proposed KSS interaction | Intentionally not copied |
|---|---|---|---|
| BambooHR task visibility and progress | See which starters need attention and which exact requirements are verified | Workspace opens on factual Office, Staff, and blocked queues; case presents a sequenced journey with verified/total count | Automated readiness, signatures, or a green compliance score |
| HiBob person context and lifecycle | Put the starter, role, Site, owner and start date ahead of technical identifiers | Person-led case header and contextual sections for journey, evidence, terms, and Training | One broad employee record that expands private access |
| Rippling actionable handoffs | Make the next actor and task obvious | Each queue preview and case highlights source `nextActor` / `nextAction`; existing guarded links and writes remain the only actions | A new task engine, inferred stage, or automatic action closure |
| Credentially evidence checks | Distinguish requested, submitted, accepted, and separately verified | Evidence lane spells out exact current source facts; protected request is opened through its own authorisation | Implying document receipt equals an identity, legal, or credential check |
| Mobile starter tasks across these products | Enable action without a desktop table | Responsive factual queue previews and vertical case journey with large links and visible keyboard focus | Vendor branding or layout |

## KSS presentation rules

- The queue API exposes views, counts, rows, owner, last-activity timestamp and next actor/action. It does **not** expose a stored pipeline stage or attributable event history. The workspace therefore uses **factual action queues**, not a stage pipeline. A last-activity timestamp is shown without an invented event description.
- Each preview is an independently authorised, limited queue read. Its count is the returned `total`; preview cards are not the full queue. The People view uses the existing paginated queue and search.
- The case requirement order comes from the immutable case template. Presentation groups are navigation aids only. No group implies compliance or eligibility.
- Onboarding has no person/case-specific native Training projection. `NOT_CONNECTED` means this case requirement has no Training linkage; native Training exists separately. A narrow future read would require case/person scope, exact CourseVersion/assignment/attempt identities, status and dates, and the Training source's permission checks. It must not automatically verify onboarding.
- Controlled onboarding terms require an exact assigned published version and acknowledgement; operational documents from 19A do not substitute for that assignment. Opened, acknowledged, accepted as evidence, and verified remain different facts.
- No attributable case activity feed is in the accepted read. The UI can show case created/started dates and current requirement timestamps, but cannot fabricate a history timeline.

## Comparator references

- [BambooHR onboarding](https://www.bamboohr.com/platform/onboarding/)
- [HiBob employee management](https://www.hibob.com/platform/employee-management-software/)
- [Rippling HCM](https://www.rippling.com/)
- [Credentially pre-employment](https://credentially.io/)
