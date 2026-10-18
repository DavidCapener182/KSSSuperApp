# U55 My Schedule — current week and read lifetime

Status: LOCAL_VERIFIED_AWAITING_INTEGRATION. One product file: src/components/my-schedule-client.tsx. No API, SQL, auth, shared styles or other Staff client edits.

Actual Chromium red: request week2026-10-12, response week_start2026-10-19. The old client described that response as3of3 allocations for the current week and displayed empty current-day text. Red screenshots/source/receipt: task-3/output/ui-staff-duty-browser-20261018/red-schedule-checkpoint01. The existing my_schedule_08a projection explicitly emits week_start=p_week; the existing endpoint canonicalises the requested London Monday. No new source contract is needed.

The client now accepts only a response for its current requested week with the existing work/availability arrays and finite non-negative total. Changing week hides previous-week facts before the next fetch timer runs. Effect cleanup retires the previous request generation, including after unmount, so delayed old reads cannot overwrite the new week. Valid query/filter behaviour, fifty-item source pagination, day selection, returnWeek links, Event/Site identity, overnight dates and separate availability declarations remain intact. A failed/unavailable response is not presented as an empty authorised week.

Verification:
- Actual-source regression:9/9 tests pass. Against the immutable original component the corrected harness records2 passing/7 failing cases; original red and corrected red logs are preserved. Cases include valid week, mismatched week, old response before the replacement timer, immediate stale-fact hiding, unmount, malformed shape/total and denied/retry scope.
-25 actual source route/API boundary checks passed for the three unchanged U55–57 route families. These are synthetic principal/RPC projections, not auth or database acceptance.
- Scoped ESLint and TypeScript exit0; isolated Next typegen supplies generated framework route helpers.
-21/21 scoped real Chromium checks passed in schedule-green01, with1440/834/390/320 matching route-local before/after screenshots. Extra1440/390 checks cover source pagination, return context, current-page emptiness, denied source, wrong week and delayed old week. Zero external requests recorded. Final harness exited0 and closed its temporary loopback fixtures3170/3171.

The before visual source is the frozen StaffDuty baseline, with published3c8ba25 shared foundation used in both phases. The source repair baseline is the already redesigned current component SHA54aa526fb2275bc677cb50dff7b3f423c710566e3bb10278bc406f9e5643c1bc. These are separate, explicitly recorded comparisons. Real route pages and pure London-date helpers are copied verbatim; only fixture principal/Supabase adapters and API responses are synthetic. Unmatched/real writes are denied. No held manager Event/Site attendance command was used.

Additional U56/U57 failures are preserved separately under red-deployments-attendance-checkpoint01 and are not fixed or claimed green by this checkpoint. Root has authorised subsequent bounded repair work. The controlled U56 d958b0047d566e9cf981d819cd0364f132e17843f754edcfb0bf0d88f6c19d4f remains unchanged here.

No hosted authentication, RPC/RLS/persistence, real assignments, push or deployment occurred. Root owns independent integration, legacy UI-only fixture adaptation and publication.
