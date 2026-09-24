# TASK-21C — Service Delivery source cards, first slice

**Scope approved by David:** Staffing and Attendance source cards in synthetic Dev, following acceptance of TASK-21B on 24 September 2026.

**Status:** ACCEPTED — SYNTHETIC DEV. David formally accepted this bounded slice on 24 September 2026. This closes the TASK-21C implementation lane; no successor or additional source card is authorised by this acceptance.

## Boundary

The Service Delivery detail shows factual, read-only Staffing and Attendance summaries for an exact Review Period and Site Service. Staffing comes from the existing 08A service demand and allocation contract. Attendance comes from the existing 09B recorded attendance contract. Source records retain their identity and authority; these cards do not copy people, events, reasons, hours or management state into Service Delivery.

The selected period's inclusive Europe/London dates define the attendance window. The card labels current planned Staffing separately from recorded Attendance. Historical attendance can remain after a demand or allocation is cancelled. No readiness score, worked-time, pay, billing or compliance conclusion is derived.

Office Admin and Super Admin may read the cards through a guarded, actor-derived RPC. Operations, Security Staff and Clients do not gain access. Every request checks the exact Service Delivery, Review Period, Site Service and historical Client/Site link membership. Direct base-table access is unchanged.

Site Book, Assets, operational documents/SOPs, incidents, worked time, payable/chargeable time, contracts, SLAs, finance, KPIs, SLA/performance scoring, readiness/compliance scoring, notifications, exports, additional source cards, staging, production and real KSS data are outside this slice. Further Service Delivery work needs a separate decision and must respect David's limit of no more than two active implementation threads.
