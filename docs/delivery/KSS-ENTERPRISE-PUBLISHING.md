# KSS Enterprise publishing map

Updated: 27 September 2026. This is the active publishing configuration; older staging reports remain historical evidence.

| Role | Current value |
| --- | --- |
| Canonical source | `DavidCapener182/KSSSuperApp`, branch `main` |
| Canonical Vercel project | `kss-enterprise` (`prj_4jIvF5zewGzJqWKRukfqr4i7gwU1`), formerly `kss-enterprise-staging` |
| Published URL | <https://project-2hiwc.vercel.app> |
| Vercel production branch | `main`; each push creates a production deployment, with production domain auto-assignment enabled |
| Published Supabase project | Synthetic Development `dnfhkmmnlbiabqypclqg`, confirmed by the production `KSS_STAGING_SUPABASE_PROJECT_REF` setting |
| Duplicate historical Vercel project | `kss-super-app-legacy-unused` (`prj_l9yuAeyAKwcrIDQcFMhALQKC4ufO`), formerly `kss-super-app`; its Git connection was removed. It has no successful production deployment and is not a release target. |

**Release rule:** feature branch/worktree → temporary Preview → verified merge to `main` → production deployment on `kss-enterprise` → signed-in journey verification at the published URL. A Preview is never another accepted version. Record both the `main` SHA and deployed SHA; a capability is `LIVE & VERIFIED` only when its accepted journey is observed on the published SHA.

The published app currently uses synthetic records and retains its explicit synthetic/staging safety label. This label describes data status; it does not name a second application or product branch. Real Staff/client data and live operational use remain outside this cutover.

At the last direct Vercel check, the production deployment was READY on `3ff021cdad9baa26e5ece048e41acaf983163e60`, matching the then-current `origin/main` and assigned to the published URL. The URL loaded the signed-in synthetic Super Admin home. This is a release-path check, not complete feature journey verification. Refresh both SHAs and complete journey checks after every later merge.

GitHub now reports `main` as the repository default. The obsolete remote `staging` branch was retired after confirming its merge commit `d351cd2` has exactly the same tree as its `main` parent `41ab510`; historical deployment and commit evidence remains. There is no second active product branch.
