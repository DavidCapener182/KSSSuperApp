# Protected staging alignment — release ledger (24 September 2026)

Status: ALL 122 LISTED SCHEMA MIGRATIONS APPLIED TO SYNTHETIC STAGING; APP DEPLOYMENT AND AUTHENTICATED POSTFLIGHT PENDING. This ledger is for the isolated `kss-integration-preview` branch. Do not run `supabase db push`; migration names and remote versions differ from Dev history.

## Verified current split

- Online protected staging Supabase project: `kwpgjbxepxuhwxxydaca`; 39 migration-history entries. Its Vercel deployment is based on the old `origin/staging` ancestor `de24b6a`.
- Synthetic Dev Supabase project: `dnfhkmmnlbiabqypclqg`; 177 migration-history entries.
- The code candidate builds locally and includes accepted TASK-17B and TASK-21B/21C from their separate branches. It also contains technically delivered TASK-12A Incident Reporting, whose authenticated visual acceptance is still pending; staging would be for that walkthrough, not a claim of acceptance. The candidate is isolated from the dirty shared checkout and omits uncommitted TASK-19A.
- Ten 03E migrations are already present on staging under different version numbers. They must be matched by *name and applied effect*, not replayed by absent Dev version. The two staging-only 03G reconciliation/seed migrations remain staging history.
- The 122 entries below are source-controlled migrations present in Dev by name but not staging by name, in the actual Dev application order. Their local filename timestamps differ from Dev history for some entries. This is an application candidate, not proof that the SQL has been safely replayed on staging.
- The Supabase staging dashboard showed physical scheduled database backups at 24 September 05:45:25 UTC and 23 September 09:00:45 UTC. The latest predates David's staging Auth account creation that evening. Neither backup includes Storage object bytes. David subsequently authorised the in-place update with this account-recreation risk understood; no third Supabase project or paid clone is authorised.

## In-place attempt and stop point

### Latest staging checkpoint

David gave explicit follow-up authorisation for the listed synthetic staging rollout, including 09A, 08D's daily job, 10B's Event worked-time slice, the accepted Dev modules, TASK-12A solely for its visual walkthrough, and the 17B any-active-role self-service rule with exact manager grants. Automatic review then permitted those previously blocked migrations. All 122 candidate migration names were confirmed in staging migration history; total history is 161 entries (39 prior + 122 listed). The three later source files that repeated an identical previously created function were corrected to use `create or replace function` in this isolated release branch: 22B duty window, 23B missing materialisation, and 22B London window. No table reset, data backfill, or third database was used.

Postflight SQL readback after the complete schema rollout found five Auth users, five People, one `IN_PROGRESS` onboarding case with six requirement rows, four Storage objects, one active David `SUPER_ADMIN` role, and the active 08D job `kss-site-shift-horizon-08d` at `17 3 * * *`. The exact 5-of-6 UI projection, role-scoped browser journeys, and app deployment remain unverified at this checkpoint.

David explicitly authorised proceeding in place on 24 September 2026, accepting that his synthetic staging account could be recreated if an old backup had to be restored. The first four listed migrations applied successfully to staging: `people_directory_04a`, `people_directory_case_link_fix_04a`, `crm_foundation_05a`, and `crm_account_owner_history_05a`. Staging migration history increased from 39 to 43 entries. The fifth migration, `operational_crm_05b`, was rejected by automatic approval review because it broadly rewrites shared Task constraints and triggers while adding CRM activities/follow-up workflows, with a stated risk of disrupting other modules. No bypass, split, alternate SQL route, or retry was attempted. No further migrations or Vercel deployment occurred.

After David specifically requested continuation, the Task compatibility review found the 05B CRM tests passing. The document-review regression passed when run alone; its earlier concurrent run had failed at a PDF authorization check. The onboarding regression initially assumed its exact case appeared in the first 50 queue rows; the isolated release branch test was corrected to page to the exact case and then passed. The original `operational_crm_05b` migration and its two documented 05B follow-up migrations (`crm_operational_summary_05b`, `document_task_conflict_05b`) applied successfully to staging. Existing staging `tasks` still contained the same three completed `DOCUMENT_REVIEW` rows after the first 05B migration.

The next migration, `client_site_event_06a`, was rejected by automatic approval review as an additional Client–Site–Event scope expansion beyond the specifically approved CRM/Task staging rollout. The review stated that the general request to make staging work did not authorize that additional scope and forbade bypass. No 06A or later migration was applied. The Vercel staging app was not deployed.

Post-stop readback: staging still has five Auth users, five People, one onboarding case with six requirement rows and `IN_PROGRESS` state, and four Storage objects. David's exact Auth identity still maps to one `SUPER_ADMIN` assignment. This does not establish the 5-of-6 UI state after the partial schema update; that browser check remains open.

## Release gates

1. Freeze this exact Git candidate and confirm no newer accepted correction to any included module.
2. Verify a recoverable staging database backup/snapshot covering Auth and public schema, and separately export/verify private Storage objects. Supabase database backups do not include Storage object bytes. Confirm restore ownership and rollback mechanism.
3. Review every listed SQL file for staging data effects, prerequisites, cron/scheduler side effects, and Dev fixture assumptions. Exclude any fixture or 19A SQL. Reconcile the exact 03E/03G divergence before replay.
4. Rehearse the ordered SQL against a disposable copy of staging, not against protected staging. Check migration success, existing synthetic Staff A 5-of-6 onboarding case and David's Super Admin identity, role and login, RLS/direct-write denials, private file access, and project-wide regression.
5. Apply to protected staging in controlled groups with migration history/readback and stop on first mismatch. Update the Vercel staging code only after schema postflight. Preserve Vercel Authentication and separate Supabase environment variables.
6. Browser-test David's Super Admin on desktop and 390px, Staff/Office/Operations scope, existing 5-of-6 onboarding, and representative accepted modules. Record exact evidence. Keep real data and production out of scope.

## Explicit exclusions

- Unaccepted TASK-19A Operational Documents, including all ten in-progress migrations and UI routes. Its private Storage revocation risk is unresolved.
- Dev-only 06C SIA enablement, 08D cron proof/recovery probes, 22B synthetic Person fixture, and 20B synthetic Training fixture.
- Any unapproved follow-on functionality or real KSS data.

## Ordered source candidate (122)

| # | Dev history version | Migration name | Source file |
|---:|---|---|---|
| 1 | `20260923140000` | `people_directory_04a` | `supabase/migrations/20260923150000_people_directory_04a.sql` |
| 2 | `20260923140227` | `people_directory_case_link_fix_04a` | `supabase/migrations/20260923151500_people_directory_case_link_fix_04a.sql` |
| 3 | `20260923173348` | `crm_foundation_05a` | `supabase/migrations/20260923173000_crm_foundation_05a.sql` |
| 4 | `20260923174246` | `crm_account_owner_history_05a` | `supabase/migrations/20260923174500_crm_account_owner_history_05a.sql` |
| 5 | `20260923183905` | `operational_crm_05b` | `supabase/migrations/20260923193000_operational_crm_05b.sql` |
| 6 | `20260923184710` | `crm_operational_summary_05b` | `supabase/migrations/20260923195000_crm_operational_summary_05b.sql` |
| 7 | `20260923185151` | `document_task_conflict_05b` | `supabase/migrations/20260923200500_document_task_conflict_05b.sql` |
| 8 | `20260923195333` | `client_site_event_06a` | `supabase/migrations/20260923213000_client_site_event_06a.sql` |
| 9 | `20260923195536` | `operational_site_detail_06a` | `supabase/migrations/20260923215500_operational_site_detail_06a.sql` |
| 10 | `20260923195710` | `operational_guard_name_06a` | `supabase/migrations/20260923220500_operational_guard_name_06a.sql` |
| 11 | `20260923195837` | `operational_owner_choices_06a` | `supabase/migrations/20260923222500_operational_owner_choices_06a.sql` |
| 12 | `20260923200536` | `event_detail_projection_06a` | `supabase/migrations/20260923224000_event_detail_projection_06a.sql` |
| 13 | `20260923200619` | `event_upcoming_06a` | `supabase/migrations/20260923225000_event_upcoming_06a.sql` |
| 14 | `20260923213416` | `event_staffing_requirements_06b` | `supabase/migrations/20260923233000_event_staffing_requirements_06b.sql` |
| 15 | `20260923213619` | `staffing_exception_confirmation_06b` | `supabase/migrations/20260923234500_staffing_exception_confirmation_06b.sql` |
| 16 | `20260923213751` | `staffing_guard_dispatch_06b` | `supabase/migrations/20260923235500_staffing_guard_dispatch_06b.sql` |
| 17 | `20260923213831` | `staffing_existing_duplicate_edit_06b` | `supabase/migrations/20260924000500_staffing_existing_duplicate_edit_06b.sql` |
| 18 | `20260923215158` | `staffing_fk_indexes_06b` | `supabase/migrations/20260924003000_staffing_fk_indexes_06b.sql` |
| 19 | `20260924091759` | `event_staff_allocations_06c` | `supabase/migrations/20260924091434_event_staff_allocations_06c.sql` |
| 20 | `20260924092054` | `deployment_event_summary_06c` | `supabase/migrations/20260924092031_deployment_event_summary_06c.sql` |
| 21 | `20260924093109` | `fix_allocation_history_guard_06c` | `supabase/migrations/20260924093210_fix_allocation_history_guard_06c.sql` |
| 22 | `20260924094637` | `my_deployments_current_first_06c` | `supabase/migrations/20260924094820_my_deployments_current_first_06c.sql` |
| 23 | `20260924101257` | `staff_availability_07a` | `supabase/migrations/20260924100601_staff_availability_07a.sql` |
| 24 | `20260924101546` | `fix_availability_guard_07a` | `supabase/migrations/20260924101515_fix_availability_guard_07a.sql` |
| 25 | `20260924101920` | `ack_availability_cancellation_07a` | `supabase/migrations/20260924101752_ack_availability_cancellation_07a.sql` |
| 26 | `20260924103021` | `availability_calendar_bound_07a` | `supabase/migrations/20260924102931_availability_calendar_bound_07a.sql` |
| 27 | `20260924105739` | `workforce_schedule_07b` | `supabase/migrations/20260924130000_workforce_schedule_07b.sql` |
| 28 | `20260924110249` | `workforce_filter_choices_07b` | `supabase/migrations/20260924131500_workforce_filter_choices_07b.sql` |
| 29 | `20260924110855` | `workforce_client_exact_07b` | `supabase/migrations/20260924133000_workforce_client_exact_07b.sql` |
| 30 | `20260924115024` | `site_shift_foundation_08a` | `supabase/migrations/20260924150000_site_shift_foundation_08a.sql` |
| 31 | `20260924115350` | `site_shift_allocation_gate_08a` | `supabase/migrations/20260924151000_site_shift_allocation_gate_08a.sql` |
| 32 | `20260924115359` | `site_shift_actions_08a` | `supabase/migrations/20260924152000_site_shift_actions_08a.sql` |
| 33 | `20260924115605` | `fix_site_shift_guard_08a` | `supabase/migrations/20260924150100_fix_site_shift_guard_08a.sql` |
| 34 | `20260924115648` | `fix_site_shift_generation_08a` | `supabase/migrations/20260924150200_fix_site_shift_generation_08a.sql` |
| 35 | `20260924115713` | `fix_site_shift_allocation_guard_08a` | `supabase/migrations/20260924151100_fix_site_shift_allocation_guard_08a.sql` |
| 36 | `20260924115956` | `site_shift_schedule_08a` | `supabase/migrations/20260924153000_site_shift_schedule_08a.sql` |
| 37 | `20260924120448` | `staff_deployment_action_centre_08b` | `supabase/migrations/20260924160000_staff_deployment_action_centre_08b.sql` |
| 38 | `20260924120709` | `effective_pause_and_dst_08a` | `supabase/migrations/20260924153100_effective_pause_and_dst_08a.sql` |
| 39 | `20260924120825` | `site_shift_history_08a` | `supabase/migrations/20260924153200_site_shift_history_08a.sql` |
| 40 | `20260924121209` | `workforce_horizon_indicator_08a` | `supabase/migrations/20260924153400_workforce_horizon_indicator_08a.sql` |
| 41 | `20260924121412` | `validate_event_notification_recipient_08b` | `supabase/migrations/20260924161000_validate_event_notification_recipient_08b.sql` |
| 42 | `20260924121758` | `event_attendance_09a` | `supabase/migrations/20260924170000_event_attendance_09a.sql` |
| 43 | `20260924125902` | `fix_attendance_resolution_idempotency_09a` | `supabase/migrations/20260924171000_fix_attendance_resolution_idempotency_09a.sql` |
| 44 | `20260924135623` | `task_08d_static_horizon_maintenance` | `supabase/migrations/20260924135623_task_08d_static_horizon_maintenance.sql` |
| 45 | `20260924135852` | `task_08d_bounded_manual_rerun` | `supabase/migrations/20260924135852_task_08d_bounded_manual_rerun.sql` |
| 46 | `20260924140336` | `static_allocation_action_centre_08c` | `supabase/migrations/20260924140336_static_allocation_action_centre_08c.sql` |
| 47 | `20260924140706` | `static_notification_fk_indexes_08c` | `supabase/migrations/20260924140706_static_notification_fk_indexes_08c.sql` |
| 48 | `20260924140945` | `replay_static_notification_after_cancel_08c` | `supabase/migrations/20260924140945_replay_static_notification_after_cancel_08c.sql` |
| 49 | `20260924142904` | `task_12a_incident_reporting_foundation` | `supabase/migrations/20260924180000_task_12a_incident_reporting_foundation.sql` |
| 50 | `20260924143603` | `task_12a_submit_result` | `supabase/migrations/20260924190000_task_12a_submit_result.sql` |
| 51 | `20260924143623` | `task_08d_health_status` | `supabase/migrations/20260924143623_task_08d_health_status.sql` |
| 52 | `20260924143710` | `task_12a_action_event_mapping` | `supabase/migrations/20260924191000_task_12a_action_event_mapping.sql` |
| 53 | `20260924144710` | `task_12a_fk_indexes` | `supabase/migrations/20260924192000_task_12a_fk_indexes.sql` |
| 54 | `20260924144912` | `task_12a_external_descriptor_privacy` | `supabase/migrations/20260924193000_task_12a_external_descriptor_privacy.sql` |
| 55 | `20260924161448` | `attendance_pagination_focus_09a` | `supabase/migrations/20260924171500_attendance_pagination_focus_09a.sql` |
| 56 | `20260924170934` | `static_attendance_adapter_09b` | `supabase/migrations/20260924200000_static_attendance_adapter_09b.sql` |
| 57 | `20260924172914` | `event_work_time_10b` | `supabase/migrations/20260924210000_event_work_time_10b.sql` |
| 58 | `20260924173434` | `guard_approved_work_time_reopen_10b` | `supabase/migrations/20260924211000_guard_approved_work_time_reopen_10b.sql` |
| 59 | `20260924173727` | `fix_work_time_manager_action_ambiguity_10b` | `supabase/migrations/20260924212000_fix_work_time_manager_action_ambiguity_10b.sql` |
| 60 | `20260924174321` | `site_book_14a` | `supabase/migrations/20260924174321_site_book_14a.sql` |
| 61 | `20260924174558` | `mobilisation_18a` | `supabase/migrations/20260924222000_mobilisation_18a.sql` |
| 62 | `20260924174700` | `asset_custody_15a` | `supabase/migrations/20260924223000_asset_custody_15a.sql` |
| 63 | `20260924174734` | `control_room_13a` | `supabase/migrations/20260924174734_control_room_13a.sql` |
| 64 | `20260924174815` | `asset_person_custody_scope_15a` | `supabase/migrations/20260924223100_asset_person_custody_scope_15a.sql` |
| 65 | `20260924174833` | `site_book_access_choices_14a` | `supabase/migrations/20260924174833_site_book_access_choices_14a.sql` |
| 66 | `20260924174950` | `mobilisation_handover_facts_18a` | `supabase/migrations/20260924222100_mobilisation_handover_facts_18a.sql` |
| 67 | `20260924175006` | `asset_history_null_guard_15a` | `supabase/migrations/20260924223200_asset_history_null_guard_15a.sql` |
| 68 | `20260924175039` | `asset_event_location_15a` | `supabase/migrations/20260924223300_asset_event_location_15a.sql` |
| 69 | `20260924175131` | `asset_fk_indexes_15a` | `supabase/migrations/20260924223400_asset_fk_indexes_15a.sql` |
| 70 | `20260924175213` | `asset_stock_adjustment_15a` | `supabase/migrations/20260924223500_asset_stock_adjustment_15a.sql` |
| 71 | `20260924175345` | `asset_loss_recovery_15a` | `supabase/migrations/20260924223600_asset_loss_recovery_15a.sql` |
| 72 | `20260924175424` | `asset_stock_history_15a` | `supabase/migrations/20260924223700_asset_stock_history_15a.sql` |
| 73 | `20260924175455` | `asset_holder_choices_15a` | `supabase/migrations/20260924223800_asset_holder_choices_15a.sql` |
| 74 | `20260924175517` | `asset_holder_choices_scope_15a` | `supabase/migrations/20260924223900_asset_holder_choices_scope_15a.sql` |
| 75 | `20260924175751` | `site_book_read_model_14a` | `supabase/migrations/20260924175751_site_book_read_model_14a.sql` |
| 76 | `20260924175811` | `asset_holder_labels_15a` | `supabase/migrations/20260924224000_asset_holder_labels_15a.sql` |
| 77 | `20260924175927` | `mobilisation_choices_18a` | `supabase/migrations/20260924222200_mobilisation_choices_18a.sql` |
| 78 | `20260924180256` | `asset_my_workspace_15a` | `supabase/migrations/20260924224100_asset_my_workspace_15a.sql` |
| 79 | `20260924180257` | `mobilisation_safe_projection_18a` | `supabase/migrations/20260924222300_mobilisation_safe_projection_18a.sql` |
| 80 | `20260924180450` | `mobilisation_unlink_18a` | `supabase/migrations/20260924222400_mobilisation_unlink_18a.sql` |
| 81 | `20260924180453` | `asset_grant_history_15a` | `supabase/migrations/20260924224200_asset_grant_history_15a.sql` |
| 82 | `20260924180538` | `asset_grant_audit_view_15a` | `supabase/migrations/20260924224300_asset_grant_audit_view_15a.sql` |
| 83 | `20260924180738` | `asset_null_guard_15a` | `supabase/migrations/20260924224400_asset_null_guard_15a.sql` |
| 84 | `20260924180819` | `site_book_item_lookback_14a` | `supabase/migrations/20260924180819_site_book_item_lookback_14a.sql` |
| 85 | `20260924180911` | `site_book_item_execute_14a` | `supabase/migrations/20260924180911_site_book_item_execute_14a.sql` |
| 86 | `20260924181108` | `asset_inspection_scope_15a` | `supabase/migrations/20260924224500_asset_inspection_scope_15a.sql` |
| 87 | `20260924181328` | `asset_stock_actor_fields_15a` | `supabase/migrations/20260924224600_asset_stock_actor_fields_15a.sql` |
| 88 | `20260924181601` | `mobilisation_private_facts_18a` | `supabase/migrations/20260924222500_mobilisation_private_facts_18a.sql` |
| 89 | `20260924181907` | `site_book_grant_uniqueness_14a` | `supabase/migrations/20260924181907_site_book_grant_uniqueness_14a.sql` |
| 90 | `20260924193618` | `training_catalogue_20b` | `supabase/migrations/20260924193618_training_catalogue_20b.sql` |
| 91 | `20260924193642` | `training_catalogue_20b_schema` | `supabase/migrations/20260924193642_training_catalogue_20b_schema.sql` |
| 92 | `20260924193855` | `training_grant_readback_20b` | `supabase/migrations/20260924193855_training_grant_readback_20b.sql` |
| 93 | `20260924194309` | `training_active_identity_grant_20b` | `supabase/migrations/20260924194309_training_active_identity_grant_20b.sql` |
| 94 | `20260924194533` | `time_away_17b` | `supabase/migrations/20260924194533_time_away_17b.sql` |
| 95 | `20260924194554` | `credential_foundation_16b` | `supabase/migrations/20260924194554_credential_foundation_16b.sql` |
| 96 | `20260924194705` | `task_21b_service_delivery` | `supabase/migrations/20260924193740_task_21b_service_delivery.sql` |
| 97 | `20260924194753` | `training_course_identity_20b` | `supabase/migrations/20260924194753_training_course_identity_20b.sql` |
| 98 | `20260924194835` | `task_21b_blocker_reason_fix` | `supabase/migrations/20260924194814_task_21b_blocker_reason_fix.sql` |
| 99 | `20260924195120` | `fix_credential_submission_alias_16b` | `supabase/migrations/20260924195120_fix_credential_submission_alias_16b.sql` |
| 100 | `20260924195328` | `time_away_17b_guards` | `supabase/migrations/20260924195328_time_away_17b_guards.sql` |
| 101 | `20260924195541` | `time_away_17b_note_gate` | `supabase/migrations/20260924195541_time_away_17b_note_gate.sql` |
| 102 | `20260924195548` | `operational_contacts_22b` | `supabase/migrations/20260924235400_operational_contacts_22b.sql` |
| 103 | `20260924195630` | `management_reporting_23b` | `supabase/migrations/20260924195630_management_reporting_23b.sql` |
| 104 | `20260924195743` | `reporting_result_name_23b` | `supabase/migrations/20260924195743_reporting_result_name_23b.sql` |
| 105 | `20260924195913` | `operational_contacts_publish_fix_22b` | `supabase/migrations/20260924235500_operational_contacts_publish_fix_22b.sql` |
| 106 | `20260924195954` | `office_only_credential_decisions_16b` | `supabase/migrations/20260924195954_office_only_credential_decisions_16b.sql` |
| 107 | `20260924200012` | `task_21b_owner_null_guard` | `supabase/migrations/20260924195952_task_21b_owner_null_guard.sql` |
| 108 | `20260924200028` | `time_away_17b_calendar` | `supabase/migrations/20260924200028_time_away_17b_calendar.sql` |
| 109 | `20260924200344` | `audit_credential_oversight_16b` | `supabase/migrations/20260924200344_audit_credential_oversight_16b.sql` |
| 110 | `20260924200353` | `operational_contact_window_22b` | `supabase/migrations/20260924235600_operational_contact_window_22b.sql` |
| 111 | `20260924200511` | `time_away_17b_read_scope` | `supabase/migrations/20260924200511_time_away_17b_read_scope.sql` |
| 112 | `20260924200816` | `reporting_coverage_23b` | `supabase/migrations/20260924200816_reporting_coverage_23b.sql` |
| 113 | `20260924200915` | `operational_contact_context_names_22b` | `supabase/migrations/20260924235700_operational_contact_context_names_22b.sql` |
| 114 | `20260924200943` | `time_away_17b_team_lifecycle` | `supabase/migrations/20260924200943_time_away_17b_team_lifecycle.sql` |
| 115 | `20260924200958` | `reporting_event_coverage_23b` | `supabase/migrations/20260924200958_reporting_event_coverage_23b.sql` |
| 116 | `20260924201143` | `training_assignments_20c` | `supabase/migrations/20260924201143_training_assignments_20c.sql` |
| 117 | `20260924201748` | `operational_contact_london_window_22b` | `supabase/migrations/20260924235900_operational_contact_london_window_22b.sql` |
| 118 | `20260924201750` | `training_assignment_guards_20c` | `supabase/migrations/20260924201750_training_assignment_guards_20c.sql` |
| 119 | `20260924201755` | `task_21c_staffing_attendance_cards` | `supabase/migrations/20260924201521_task_21c_staffing_attendance_cards.sql` |
| 120 | `20260924202525` | `operational_contact_event_semantics_22b` | `supabase/migrations/20260924235930_operational_contact_event_semantics_22b.sql` |
| 121 | `20260924202659` | `operational_contact_management_history_22b` | `supabase/migrations/20260924235940_operational_contact_management_history_22b.sql` |
| 122 | `20260924202801` | `operational_contact_advisor_22b` | `supabase/migrations/20260924235950_operational_contact_advisor_22b.sql` |

**Release state:** four staging schema migrations applied; the fifth was rejected by automatic approval review. No Vercel deployment occurred. Further schema rollout is stopped pending approval review resolution.
