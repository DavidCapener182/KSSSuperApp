# Engineering follow-up — synthetic test Auth sessions

**Status:** E-01 implementation and first serial regression recorded in `ENGINEERING-TEST-AUTH-SESSIONS-REPORT.md`; combined full-suite completion awaits the concurrent 07B shell expectation update. Not part of TASK-07A or TASK-07B business implementation.

Repeated Supabase Auth `Request rate limit reached` responses interrupt the broad Dev regression run. TASK-07A's one-pass 29-test run returned 14 passes and 15 failures: 13 failures stopped at Auth sign-in, one hit the previously reported controlled-document fixture denial, and one 06C assertion still assumed the former SIA candidate label. The 06C assertion and its paginated-history fixture assumption were corrected; 06C then passed independently. These are not a passing full-suite result.

Investigate sign-in cadence per test file and persona. Reuse short-lived synthetic authenticated sessions within a controlled test run where safe, while preserving test isolation and fresh database authority checks for role expiry. Keep tokens in process memory, never in source, fixtures, logs or a reusable disk cache. Refresh only when necessary. Do not weaken Supabase Auth limits or production configuration; do not add unbounded retries. Measure sign-in count and full-suite completion before and after. Investigate the controlled-document fixture denial independently, without changing immutable business history to satisfy the test.

This follow-up requires its own approval and should remain separate from 07B Workforce Schedule.
