# CRM runner repeatability revision

Parent requested a repeatable runner after the original frozen evidence directory became committed input. Only the browser runner imports and initialisation changed; all bytes from its immutable-output assertion through the end, including every acceptance assertion, remain exact. Product source stays SHA706b89eebdc019179742cab3bcbe5ad7d98965f11f8d2694a23cbd200b51052d.

Use `KSS_CRM_READ_LIFECYCLE_OUTPUT` for an optional unused output path and `KSS_CRM_READ_LIFECYCLE_PORT` for a free loopback port (default3190, validated1024–65535). With no output setting, each run creates `output/CRM-READ-LIFECYCLE-20261019-<UTC timestamp>-<pid>`. Runtime fixtures use unique OS temporary directories. Existing outputs still fail the immutable guard. No external traffic, real auth or backend claims were added.

Fresh default-output rerun on3192 exited0:8/8 browser records at390/1280,24 screenshots,0external requests. Scoped runner lint exit0 and syntax check passed. Exact command/output path, prior/current runner hashes and every rerun file hash are in `evidence/CRM-READ-LIFECYCLE-20261019-runner-revision/runner-revision-receipt.json`. Results/source manifest/server log are copied there; original matching screenshots remain available in the new output directory.

Original frozen packet/report/manifest and its final-v4 screenshots are untouched. Its109-file manifest intentionally pins the pre-revision runner; this separate receipt records the sole authorised subsequent runner delta. No stage, commit or push by this worker.
