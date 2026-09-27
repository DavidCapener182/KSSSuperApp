# PRODUCT-07 Assets P1 daily-use candidate — synthetic Development

Date: 27 September 2026. Scope approved by David: scalable guarded register search/filter/paging, reviewed individual-item issue/transfer/return, uniform Staff/outstanding-issue pickers and exact event readback. This is a bounded synthetic Development change on top of accepted TASK-15A, not a real stocktake, live-data import or production release.

## Source and implementation

Isolated managed worktree `/Users/davidcapener/.codex/worktrees/kss-product-07-build/KSSSuperApp`, starting at `origin/main` `1bafa6464f3ae549b8c3b5c1f4ce7b70cf24bc31`. Shared checkout was dirty and not edited. The accepted asset ledger and its guarded custody/stock mutations are unchanged.

- `asset_register_page` returns a bounded 1–100 item page with total count, stable reference/ID ordering and server-side search, class, holder/context, condition, repair, exception, expected-return and factual view filters. The Office/Super or exact Operations grant predicate remains inside the RPC. `asset_register_support` returns authorised store, stock and current holder-context choices without loading the full item register.
- The `/assets` register now uses those projections, shows count/page controls, retains distinct custody, location, condition, repair, exception and expected-return fields, and gives an availability answer with the rule's factual reason. Search and filters reset pagination. The selected item has an action-specific review step before ISSUE/TRANSFER/RETURN, naming the current and destination holders, item, recorded/observed condition and expected return. It does not treat acknowledgement as part of the custody event.
- Uniform issue selects an authorised Staff Person; return selects an outstanding line from the exact stock record. The return choice will exclude pending acknowledgements, matching the existing guarded `asset_stock_move` rule. Stocktake, variance approval, correction policy, scanning, kits, bulk issue, duty inference and lost-key escalation remain separate decisions.
- `/api/assets` now checks the returned event ID, revision and, for item actions, action/asset/destination against an actor-only receipt RPC before reporting a confirmed write. A submitted event without exact readback is shown as unconfirmed and the UI asks for current-source review before retry. Grants retain their existing separate response contract. Direct table access and Staff self-only equipment projection remain unchanged.

## Applied synthetic Development migration

- Target verified immediately before apply: Supabase `dnfhkmmnlbiabqypclqg`, project name `KSSNWLTD's Project`, `ACTIVE_HEALTHY`, `eu-west-1`. Pre-apply migration ledger had no PRODUCT-07 slot/name.
- Local source: `supabase/migrations/20260927170000_product_07_asset_register_workflows.sql`, SHA-256 `aa406a41ae91dc47d9a7cc6f01229e230438633917f62ee2f4eaf62b3fc84eb1`.
- Applied once by Supabase migration tool. MCP assigned remote version `20260927164145`, name `product_07_asset_register_workflows_20260927170000`; the assigned version differs from the local filename. No second apply was used to repair that timestamp mismatch.
- Post-apply `pg_proc` readback found all five expected RPCs (`asset_register_page`, `asset_register_support`, `asset_stock_issue_choices`, `asset_event_receipt`, `asset_stock_event_receipt`) as SECURITY DEFINER with empty `search_path`, authenticated EXECUTE and no anon EXECUTE.

## Checks and evidence

- Focused ESLint and `tsc --noEmit --incremental false` passed. The Next 16 Webpack production build passed with the approved synthetic Development environment. The relevant bundled Next 16 Route Handler and Server/Client Component guides were read before code changes.
- `tests/assets-product07.test.mjs` passed against authenticated synthetic Development: page size/count, distinct pagination, no-match search, availability predicate, Office stock choices, Operations page and Staff denial for register/support/stock choices. Unknown actor receipt returned null. Existing `tests/assets-routes.test.mjs` passed, preserving prior anonymous, Staff, Office, Operations and Super Admin route boundaries.
- A one-shot authenticated HTTP proof (`KSS_PRODUCT07_MUTATION_PROOF=1`, `tests/assets-product07-actions.test.mjs`) passed: Office REGISTER; scoped Operations ISSUE; Staff ACK_ISSUE; Operations RETURN and ACK_RETURN. Each route response included the exact actor-only event receipt. Staff could not read an Operations event receipt. Source readback for synthetic `P07-MUK1VCJC` showed five ordered events, final STORE custody, SERVICEABLE condition, no repair/exception/pending acknowledgement and revision 5. Its temporary Operations grant was revoked; readback found zero active proof grants.
- The local production build was opened in an authenticated synthetic Super Admin browser. At 1280px it showed 85 authorised items with 30 on page one and no document overflow (`scrollWidth=1280`). At genuine 390px the desktop table was hidden, mobile list presented the records and `scrollWidth=390`. Searching `P07-` reduced the view to one authorised item, whose history opened on mobile without overflow. The AVAILABLE view returned that item with the source-backed “Available from store” reason.

## Remaining gates and limits

- A narrow forward migration to exclude pending uniform acknowledgements from return choices is prepared but awaits the Phase 1 coordinator's unique migration slot and synthetic Development apply. Final focused tests, production build and commit should be repeated after it lands.
- The authenticated visual browser check used Super Admin for register inspection. Operations issue/return review controls and uniform pickers were exercised through code/contract and the HTTP event proof, not a separate Operations 390px browser session. The browser used synthetic Development, not staging or production.
- No real asset or uniform count was verified. The P0 physical stocktake/variance-review/correction workflow and store/restricted-key/loss/retention policies remain pre-live work. This candidate does not authorise live stock, production, or a new grant/role model.
