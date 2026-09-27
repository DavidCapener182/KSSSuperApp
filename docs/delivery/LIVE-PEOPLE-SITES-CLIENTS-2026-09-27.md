# Live People, Sites and client import — 27 September 2026

## Scope and source

David authorised importing current working staff from PARiM and identifying current Sites and Events from the preceding two months. David confirmed Blackpool Football Club, Segen Ltd, Footasylum, Music Magpie, Fanatics Collectables and Gymshark as current clients. The existing David Capener Person and Super Admin role were retained. No onboarding cases were created for imported existing staff.

## Published result

- 63 active PARiM People profiles matched to 63 KSS People records, including the existing David record; 63 source links, 63 contact profiles, 53 addresses and 102 recorded position entries. Imported positions are distinct from KSS access roles.
- Six Sites are ACTIVE and linked to confirmed clients: Music Magpie Warehouse, Wellingborough Warehouse, three Gymshark stores and Blackpool Football Club. Their reporting points require confirmation. The Site UI hides source references.
- Six newly confirmed current clients are present in CRM. The existing Fragrance Shop client was preserved.
- Two source-backed Blackpool matches were added as COMPLETED Events: Bromley (12 September) and Plymouth Argyle (19 September).
- Each Site links to an access-checked, Site-specific workspace placeholder. Maps were deferred at David's request.

## Evidence

- Type generation, TypeScript, focused ESLint, `git diff --check` and the Webpack production build passed for the Site workspace/client confirmation change.
- Supabase readback: six ACTIVE Sites, six current Site–client links, seven total CLIENT organisations including the pre-existing Fragrance Shop, and two completed Blackpool matches.
- Production Vercel deployment for `58698f30387e8455cf7a3d4b6485ad00ca7504f6` reached READY and aliased `project-2hiwc.vercel.app`.
- Signed-in published readback returned HTTP 200 for the Music Magpie Site workspace with its Site name and Coming soon content. The six confirmed clients read as CLIENT and the two Blackpool matches read as COMPLETED.
- Local development preview remains available at `http://127.0.0.1:3400` during this task.

## Remaining source gaps

- PARiM's TALA Location record lacked a usable street address and postcode; no Site was invented.
- Reporting points and the operational owner of historical Blackpool Events were not supplied by the source. David is the current KSS record owner for the imported matches.
- Footasylum and Fanatics have no source-verified Site link in this import.
