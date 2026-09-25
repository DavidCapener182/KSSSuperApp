# TASK-UI04 shared UI change proposals

For controlled UI02 integration, consider a common source-card pattern with source label, fact timestamp, exact record link and one domain-specific next action. Control Room, Action Centre, Incident and Site Book currently implement this independently. A shared component must accept only caller-authorised fields and must not imply that one source state resolves another.

A shared async-action feedback pattern could distinguish request pending, server acceptance, authoritative readback and unconfirmed refresh. Domain clients should retain their own idempotency and source guards. No shared file was edited in UI04.
