# CRM current-read lifecycle task packet

Authorised bounded functional repair in `src/components/crm-operational.tsx`; baseline a95d85079c33a3fd352bd190599864a79240c27c. Preserve accepted 05A/05B source IDs, query parameters, stage guards, task/activity payloads and independent server authority. No API/SQL/auth/task-action-component changes, hosted calls, credentials, deployment or production writes. Parent owns integration and independent review.

Reproduce successful facts surviving current 403, pending source actions surviving failed reads, delayed obsolete query/source results and writes completing after context retirement. Test valid matching reads and writes alongside negatives with actual transpiled component source and explicit synthetic hooks/DOM/HTTP; this is no authenticated/RPC/RLS proof. Pipeline has no actor prop: query/read lifetime correctness is the claim, not principal revalidation.

Read AGENTS, STATUS, DECISIONS, PHASE-05, accepted TASK-05B, systematic-debugging and bundled Next use-client documentation. One worker, no delegation. Stop on fresh denial or confirmed transport disconnection.

## Frozen result

One product changed: `src/components/crm-operational.tsx`, SHA256 `3844f83adf0656d3d640a018b36a068fd7ad8748b32836ffc6c45bc583dc030c` → `706b89eebdc019179742cab3bcbe5ad7d98965f11f8d2694a23cbd200b51052d`. Both loaders now retire facts at refresh start/failure, bind snapshots to current supplied query/record/person context, and ignore superseded/unmounted reads. Stage and record mutation continuations do not launch obsolete readbacks or clear a new context’s draft. Existing exact readback success remains accepted; failed confirmation remains uncertain, with no automatic write retry. Query URLs, fetch options and POST expressions are byte-identical, proven by AST contract comparison.

24 new actual-source lifecycle cases plus8 existing CRM source cases,3 revised dialog contracts and4 existing source contracts: **39/39 pass** in `evidence/CRM-READ-LIFECYCLE-20261019/final-local.txt`. Scoped product/test lint and TypeScript exit0 (`final-lint.txt`, `final-types.txt`). Initial TypeScript errors were absent generated Next types; parent’s successful build generated them before final recheck. Parent owns combined build/full-suite proof.

### Browser acceptance

Final immutable `browser-final-v4/results.json`: **8/8 records**, widths390/1280, before/after Pipeline and RecordWork.16 matching failure/recovery screenshots plus8 diagnostic screenshots. Final checks cover failed current403 removing facts, Retry recovery, after RecordWork held write resolving after source change without another GET/write or new-draft clearing, task-dialog Escape and exact focus return. Browser external requests0. The local fixture process and browser were stopped normally after the run. Before/after component, CSS, UI controls and due helper hashes are in `runtime-source-manifest.json`; byte-identical copies frozen under `frozen-runtime-source/`. Copied source provenance is explicit; this is not a complete compiled dependency graph. Locked installed dependencies were reused.

`browser-final/` is the initial locator failure (Type label accessible-name assumption). `browser-final-v2/` retained an immediate visibility assertion failure after a generic alert; no product fix followed. `browser-final-v3/` captured exact DOM/request ordering and passed8/8 with unchanged source. Final v4 waits for the exact application error and the required settled visibility state (hidden must be observed; persistent retention fails), then asserts it and captures DOM. Failed diagnostics remain separate and are not counted as acceptance. The final after-work390 DOM contains only the uncertainty message and Retry; requests are exact initial GET→one attempted POST→GET403.

### Scope and limitations

The root layout/shell/authentication is replaced with a labelled synthetic component harness; Office identity is supplied data. All API routes are intercepted synthetic responses, including successful and denied reads/writes. No Supabase/Auth/RPC/RLS, production, real role-revocation, persistence, or transaction proof.403 models current denied authority; Pipeline receives no actor prop and cannot independently revalidate identity. RecordWork’s supplied currentPersonId is part of its view key. Different query/source contexts can attempt independent server-guarded writes while an earlier context’s write is pending; no universal cross-context transaction/idempotency guarantee is claimed. Same-context duplicate submission is synchronously guarded. Existing server permissions and business rules are unchanged.

Historical dialog preservation assertions now use an explicit baseline/current SHA allowlist for4 changed function bodies,2 readers and2 loader effects. All other historical comparisons, prior keyboard effect and duplicate-submit wrapper remain exact. Optional generated receipts distinguish changed/unchanged hashes and write a new dated file, preserving the historical receipt. `CRM-READ-LIFECYCLE-20261019-revision.json` records exact pins.

No commit, stage, push, deployment, hosted call, credentials or schema/API/security changes performed by this lane. Ready for parent independent review/publication decision; no known unresolved blocker in this packet.
