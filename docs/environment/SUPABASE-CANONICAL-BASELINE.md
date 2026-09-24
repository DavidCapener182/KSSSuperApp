# Supabase canonical source baseline

Date: 25 September 2026. Branch: `kss-source-baseline`. Survivor: `dnfhkmmnlbiabqypclqg`. **Source reconciliation is committed; clean database replay has not been executed.** No migration or database object was changed in this task.

## Reconciliation method

All 187 remote ledger entries were compared by descriptive name and historical SQL. The 180 product entries now have exactly one file in `supabase/migrations`, with the **actual remote version** as its filename prefix. Of those, 167 files are byte-identical to remote SQL and 13 differ only by line comments/formatting under the documented normalization test. There are zero product name/version mismatches and zero unresolved SQL pairs. Original local timestamps survive in Git history and are noted below where different. The canonical file order matches the historical remote ledger order. This is source identity and static order evidence; it is not a clean replay result or proof of each current database object definition.

Classes: **A 180, B 0, C 5, D 2, E 0, F 1, G 2, H 0.** A is matched canonical product source; C is remote proof/test; D is Dev-only activation/fixture; F is the unapplied 19A Storage candidate held by its owner; G is deleted-staging history. B/E/H were resolved through branch integration, exact SQL restoration and filename alignment. The five proof migrations and two Dev-only entries remain historical ledger records but are outside normal product replay. Neither 03G file remains in `supabase/migrations`.

The column “current effect individually verified” is NO where no per-object definition check was performed; it does not negate the remote applied-ledger entry. The consolidation audit separately confirms broad schema presence. **Replay YES is a source disposition, not permission to apply it to the survivor.**

## The 13 formerly ambiguous SQL pairs

For each, the earlier local file had the same descriptive name but differed from the applied remote statement. The actual applied remote statement is now the canonical replay source. The old local edits are not silently assumed to have run. The listed later migrations show the relevant forward-correction chain; they do not by themselves prove every final object body was checked. None of the 13 is proof-only.

| Descriptive name | Domain | Initial SQL effect equivalent? | Difference | Relevant later migration(s) | Canonical disposition |
|---|---|---|---|---|---|
| site_shift_foundation_08a | 08A | NO | Guard, pause-overlap and generation behavior changed | fix_site_shift_guard_08a; fix_site_shift_generation_08a; effective_pause_and_dst_08a | Remote 20260924115024 SQL is canonical; old local copy retired |
| site_shift_schedule_08a | 08A | NO | Projection fields and horizon indicator differ | workforce_horizon_indicator_08a; subsequent schedule source | Remote 20260924115956 SQL is canonical; old local copy retired |
| task_12a_incident_reporting_foundation | 12A | NO | Action-event mapping differs | task_12a_action_event_mapping | Remote 20260924142904 SQL is canonical; old local copy retired |
| asset_custody_15a | 15A | NO | Base custody actions, quantity checks and site location differ | asset_person_custody_scope, asset_stock_adjustment, asset_loss_recovery, asset_null_guard | Remote 20260924174700 SQL is canonical; old local copy retired |
| asset_person_custody_scope_15a | 15A | NO | Custody scope and event location differ | asset_event_location_15a; later custody guards | Remote 20260924174815 SQL is canonical; old local copy retired |
| asset_stock_adjustment_15a | 15A | NO | Null/quantity guard differs | asset_null_guard_15a; asset_stock_actor_fields_15a | Remote 20260924175213 SQL is canonical; old local copy retired |
| asset_loss_recovery_15a | 15A | NO | Null guard differs | asset_null_guard_15a | Remote 20260924175345 SQL is canonical; old local copy retired |
| asset_holder_choices_15a | 15A | NO | Holder authority clause differs | asset_holder_choices_scope_15a | Remote 20260924175455 SQL is canonical; old local copy retired |
| asset_null_guard_15a | 15A | NO | Guard clauses differ | asset_inspection_scope_15a; asset_stock_actor_fields_15a | Remote 20260924180738 SQL is canonical; old local copy retired |
| training_catalogue_20b | 20B | YES | Only terminating semicolon differs | not needed | Remote 20260924193618 SQL is canonical; old local copy retired |
| operational_contacts_22b | 22B | NO | Window, event and context helpers were folded into local base | operational_contact_window, context_names, london_window, event_semantics | Remote 20260924195548 SQL is canonical; old local copy retired |
| management_reporting_23b | 23B | NO | Materialisation and event coverage logic differ | reporting_result_name, reporting_coverage, reporting_event_coverage | Remote 20260924195630 SQL is canonical; old local copy retired |
| reporting_coverage_23b | 23B | NO | Event applicability predicate differs | reporting_event_coverage_23b | Remote 20260924200816 SQL is canonical; old local copy retired |

The exact changes include a `CREATE` versus `CREATE OR REPLACE` drift in two 22B follow-up files brought by the hosted-branch merge. Both were also restored to the actual remote statements after the base 22B source was restored. These are additional resolved source differences, outside the original 13.

## Migration manifest

| Canonical source filename/location | Descriptive name | Actual remote version | Domain | Class | Replay clean synthetic | Dev-only | Proof-only | Current effect individually verified | Notes |
|---|---|---|---|---|---|---|---|---|---|
| supabase/migrations/20260922213315_identity_foundation.sql | identity_foundation | 20260922213315 | foundation/other | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260922221737_shared_site_journey.sql | shared_site_journey | 20260922221737 | foundation/other | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260922221814_fix_shared_assignment_audit.sql | fix_shared_assignment_audit | 20260922221814 | foundation/other | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260922222600_narrow_site_preflight_and_index.sql | narrow_site_preflight_and_index | 20260922222600 | foundation/other | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260922231135_private_documents_02a.sql | private_documents_02a | 20260922231135 | 02A | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260922232116_guard_document_upload_02a.sql | guard_document_upload_02a | 20260922232116 | 02A | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260922232349_fix_document_proof_separator_02a.sql | fix_document_proof_separator_02a | 20260922232349 | 02A | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260922232829_fix_document_cleanup_visibility_02a.sql | fix_document_cleanup_visibility_02a | 20260922232829 | 02A | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260922233224_restrict_document_cleanup_select_02a.sql | restrict_document_cleanup_select_02a | 20260922233224 | 02A | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260922235110_document_review_replacement_02b.sql | document_review_replacement_02b | 20260922235110 | 02B | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260923003042_connected_tasks_02c.sql | connected_tasks_02c | 20260923003042 | 02C | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260923003818_fix_task_reconciliation_02c.sql | fix_task_reconciliation_02c | 20260923003818 | 02C | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260923010729_onboarding_case_03a.sql | onboarding_case_03a | 20260923010729 | 03A | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260923011708_stop_cancelled_onboarding_upload_03a.sql | stop_cancelled_onboarding_upload_03a | 20260923011708 | 03A | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260923011923_guard_onboarding_history_03a.sql | guard_onboarding_history_03a | 20260923011923 | 03A | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260923042043_personal_details_sia_03b.sql | personal_details_sia_03b | 20260923042043 | 03B | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260923043252_fix_03b_submission_aliases.sql | fix_03b_submission_aliases | 20260923043252 | 03B | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260923043554_scope_current_profile_to_active_v2_case.sql | scope_current_profile_to_active_v2_case | 20260923043554 | foundation/other | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260923043644_track_profile_credential_changes.sql | track_profile_credential_changes | 20260923043644 | foundation/other | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260923043746_guard_stale_sia_request.sql | guard_stale_sia_request | 20260923043746 | foundation/other | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260923043808_bind_sia_verification_change_sequence.sql | bind_sia_verification_change_sequence | 20260923043808 | foundation/other | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260923043916_audit_super_private_profile_read.sql | audit_super_private_profile_read | 20260923043916 | foundation/other | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260923052335_controlled_documents_03c.sql | controlled_documents_03c | 20260923052335 | 03C | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260923052843_fix_controlled_history_guard_03c.sql | fix_controlled_history_guard_03c | 20260923052843 | 03C | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260923052959_fix_controlled_catalog_rls_03c.sql | fix_controlled_catalog_rls_03c | 20260923052959 | 03C | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260923053548_serialize_controlled_authority_03c.sql | serialize_controlled_authority_03c | 20260923053548 | 03C | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260923061212_identity_evidence_03d.sql | identity_evidence_03d | 20260923061212 | 03D | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260923071903_onboarding_queue_03e.sql | onboarding_queue_03e | 20260923071903 | foundation/other | A | YES | NO | NO | NO | Former local filename: 20260923065553_onboarding_queue_03e.sql |
| supabase/migrations/20260923072028_fix_queue_request_variable_03e.sql | fix_queue_request_variable_03e | 20260923072028 | foundation/other | A | YES | NO | NO | NO | Former local filename: 20260923071732_fix_queue_request_variable_03e.sql |
| supabase/migrations/20260923072138_allow_draft_owner_start_03e.sql | allow_draft_owner_start_03e | 20260923072138 | foundation/other | A | YES | NO | NO | NO | Former local filename: 20260923071905_allow_draft_owner_start_03e.sql |
| supabase/migrations/20260923072403_prevent_coordinator_self_reassignment_03e.sql | prevent_coordinator_self_reassignment_03e | 20260923072403 | foundation/other | A | YES | NO | NO | NO | Former local filename: 20260923072742_prevent_coordinator_self_reassignment_03e.sql |
| supabase/migrations/20260923072759_allow_rls_owner_helper_03e.sql | allow_rls_owner_helper_03e | 20260923072759 | foundation/other | A | YES | NO | NO | NO | Former local filename: 20260923073218_allow_rls_owner_helper_03e.sql |
| supabase/migrations/20260923072854_review_request_authority_03e.sql | review_request_authority_03e | 20260923072854 | foundation/other | A | YES | NO | NO | NO | Former local filename: 20260923073611_review_request_authority_03e.sql |
| supabase/migrations/20260923072956_history_oversight_read_03e.sql | history_oversight_read_03e | 20260923072956 | foundation/other | A | YES | NO | NO | NO | Former local filename: 20260923074022_history_oversight_read_03e.sql |
| supabase/migrations/20260923074234_restore_controlled_access_guard_03e.sql | restore_controlled_access_guard_03e | 20260923074234 | foundation/other | A | YES | NO | NO | NO | Former local filename: 20260923074335_restore_controlled_access_guard_03e.sql |
| supabase/migrations/20260923074528_narrow_cover_document_actions_03e.sql | narrow_cover_document_actions_03e | 20260923074528 | foundation/other | A | YES | NO | NO | NO | Former local filename: 20260923074815_narrow_cover_document_actions_03e.sql |
| supabase/migrations/20260923074803_cover_progress_without_history_03e.sql | cover_progress_without_history_03e | 20260923074803 | foundation/other | A | YES | NO | NO | NO | Former local filename: 20260923075244_cover_progress_without_history_03e.sql |
| supabase/migrations/20260923140000_people_directory_04a.sql | people_directory_04a | 20260923140000 | 04A | A | YES | NO | NO | NO | Former local filename: 20260923150000_people_directory_04a.sql |
| supabase/migrations/20260923140227_people_directory_case_link_fix_04a.sql | people_directory_case_link_fix_04a | 20260923140227 | 04A | A | YES | NO | NO | NO | Former local filename: 20260923151500_people_directory_case_link_fix_04a.sql |
| supabase/migrations/20260923173348_crm_foundation_05a.sql | crm_foundation_05a | 20260923173348 | 05A | A | YES | NO | NO | NO | Former local filename: 20260923173000_crm_foundation_05a.sql |
| supabase/migrations/20260923174246_crm_account_owner_history_05a.sql | crm_account_owner_history_05a | 20260923174246 | 05A | A | YES | NO | NO | NO | Former local filename: 20260923174500_crm_account_owner_history_05a.sql |
| supabase/migrations/20260923183905_operational_crm_05b.sql | operational_crm_05b | 20260923183905 | 05B | A | YES | NO | NO | NO | Former local filename: 20260923193000_operational_crm_05b.sql |
| supabase/migrations/20260923184710_crm_operational_summary_05b.sql | crm_operational_summary_05b | 20260923184710 | 05B | A | YES | NO | NO | NO | Former local filename: 20260923195000_crm_operational_summary_05b.sql |
| supabase/migrations/20260923185151_document_task_conflict_05b.sql | document_task_conflict_05b | 20260923185151 | 05B | A | YES | NO | NO | NO | Former local filename: 20260923200500_document_task_conflict_05b.sql |
| supabase/migrations/20260923195333_client_site_event_06a.sql | client_site_event_06a | 20260923195333 | 06A | A | YES | NO | NO | NO | Former local filename: 20260923213000_client_site_event_06a.sql |
| supabase/migrations/20260923195536_operational_site_detail_06a.sql | operational_site_detail_06a | 20260923195536 | 06A | A | YES | NO | NO | NO | Former local filename: 20260923215500_operational_site_detail_06a.sql |
| supabase/migrations/20260923195710_operational_guard_name_06a.sql | operational_guard_name_06a | 20260923195710 | 06A | A | YES | NO | NO | NO | Former local filename: 20260923220500_operational_guard_name_06a.sql |
| supabase/migrations/20260923195837_operational_owner_choices_06a.sql | operational_owner_choices_06a | 20260923195837 | 06A | A | YES | NO | NO | NO | Former local filename: 20260923222500_operational_owner_choices_06a.sql |
| supabase/migrations/20260923200536_event_detail_projection_06a.sql | event_detail_projection_06a | 20260923200536 | 06A | A | YES | NO | NO | NO | Former local filename: 20260923224000_event_detail_projection_06a.sql |
| supabase/migrations/20260923200619_event_upcoming_06a.sql | event_upcoming_06a | 20260923200619 | 06A | A | YES | NO | NO | NO | Former local filename: 20260923225000_event_upcoming_06a.sql |
| supabase/migrations/20260923213416_event_staffing_requirements_06b.sql | event_staffing_requirements_06b | 20260923213416 | 06B | A | YES | NO | NO | NO | Former local filename: 20260923233000_event_staffing_requirements_06b.sql |
| supabase/migrations/20260923213619_staffing_exception_confirmation_06b.sql | staffing_exception_confirmation_06b | 20260923213619 | 06B | A | YES | NO | NO | NO | Former local filename: 20260923234500_staffing_exception_confirmation_06b.sql |
| supabase/migrations/20260923213751_staffing_guard_dispatch_06b.sql | staffing_guard_dispatch_06b | 20260923213751 | 06B | A | YES | NO | NO | NO | Former local filename: 20260923235500_staffing_guard_dispatch_06b.sql |
| supabase/migrations/20260923213831_staffing_existing_duplicate_edit_06b.sql | staffing_existing_duplicate_edit_06b | 20260923213831 | 06B | A | YES | NO | NO | NO | Former local filename: 20260924000500_staffing_existing_duplicate_edit_06b.sql |
| supabase/migrations/20260923215158_staffing_fk_indexes_06b.sql | staffing_fk_indexes_06b | 20260923215158 | 06B | A | YES | NO | NO | NO | Former local filename: 20260924003000_staffing_fk_indexes_06b.sql |
| supabase/migrations/20260924091759_event_staff_allocations_06c.sql | event_staff_allocations_06c | 20260924091759 | 06C | A | YES | NO | NO | NO | Former local filename: 20260924091434_event_staff_allocations_06c.sql |
| supabase/dev_only/20260924091837_dev_only_enable_06c_sia.sql | dev_only_enable_06c_sia | 20260924091902 | 06C | D | NO | YES | NO | NO | Synthetic Dev activation/fixture; outside normal replay |
| supabase/migrations/20260924092054_deployment_event_summary_06c.sql | deployment_event_summary_06c | 20260924092054 | 06C | A | YES | NO | NO | NO | Former local filename: 20260924092031_deployment_event_summary_06c.sql |
| supabase/migrations/20260924093109_fix_allocation_history_guard_06c.sql | fix_allocation_history_guard_06c | 20260924093109 | 06C | A | YES | NO | NO | NO | Former local filename: 20260924093210_fix_allocation_history_guard_06c.sql |
| supabase/migrations/20260924094637_my_deployments_current_first_06c.sql | my_deployments_current_first_06c | 20260924094637 | 06C | A | YES | NO | NO | NO | Former local filename: 20260924094820_my_deployments_current_first_06c.sql |
| supabase/migrations/20260924101257_staff_availability_07a.sql | staff_availability_07a | 20260924101257 | 07A | A | YES | NO | NO | NO | Former local filename: 20260924100601_staff_availability_07a.sql |
| supabase/migrations/20260924101546_fix_availability_guard_07a.sql | fix_availability_guard_07a | 20260924101546 | 07A | A | YES | NO | NO | NO | Former local filename: 20260924101515_fix_availability_guard_07a.sql |
| supabase/migrations/20260924101920_ack_availability_cancellation_07a.sql | ack_availability_cancellation_07a | 20260924101920 | 07A | A | YES | NO | NO | NO | Former local filename: 20260924101752_ack_availability_cancellation_07a.sql |
| supabase/migrations/20260924103021_availability_calendar_bound_07a.sql | availability_calendar_bound_07a | 20260924103021 | 07A | A | YES | NO | NO | NO | Former local filename: 20260924102931_availability_calendar_bound_07a.sql |
| supabase/migrations/20260924105739_workforce_schedule_07b.sql | workforce_schedule_07b | 20260924105739 | 07B | A | YES | NO | NO | NO | Former local filename: 20260924130000_workforce_schedule_07b.sql |
| supabase/migrations/20260924110249_workforce_filter_choices_07b.sql | workforce_filter_choices_07b | 20260924110249 | 07B | A | YES | NO | NO | NO | Former local filename: 20260924131500_workforce_filter_choices_07b.sql |
| supabase/migrations/20260924110855_workforce_client_exact_07b.sql | workforce_client_exact_07b | 20260924110855 | 07B | A | YES | NO | NO | NO | Former local filename: 20260924133000_workforce_client_exact_07b.sql |
| supabase/migrations/20260924115024_site_shift_foundation_08a.sql | site_shift_foundation_08a | 20260924115024 | 08A | A | YES | NO | NO | NO | Resolved: canonical SQL restored from remote statement |
| supabase/migrations/20260924115350_site_shift_allocation_gate_08a.sql | site_shift_allocation_gate_08a | 20260924115350 | 08A | A | YES | NO | NO | NO | Former local filename: 20260924151000_site_shift_allocation_gate_08a.sql |
| supabase/migrations/20260924115359_site_shift_actions_08a.sql | site_shift_actions_08a | 20260924115359 | 08A | A | YES | NO | NO | NO | Former local filename: 20260924152000_site_shift_actions_08a.sql |
| supabase/migrations/20260924115605_fix_site_shift_guard_08a.sql | fix_site_shift_guard_08a | 20260924115605 | 08A | A | YES | NO | NO | NO | Former local filename: 20260924150100_fix_site_shift_guard_08a.sql |
| supabase/migrations/20260924115648_fix_site_shift_generation_08a.sql | fix_site_shift_generation_08a | 20260924115648 | 08A | A | YES | NO | NO | NO | Former local filename: 20260924150200_fix_site_shift_generation_08a.sql |
| supabase/migrations/20260924115713_fix_site_shift_allocation_guard_08a.sql | fix_site_shift_allocation_guard_08a | 20260924115713 | 08A | A | YES | NO | NO | NO | Former local filename: 20260924151100_fix_site_shift_allocation_guard_08a.sql |
| supabase/migrations/20260924115956_site_shift_schedule_08a.sql | site_shift_schedule_08a | 20260924115956 | 08A | A | YES | NO | NO | NO | Resolved: canonical SQL restored from remote statement |
| supabase/migrations/20260924120448_staff_deployment_action_centre_08b.sql | staff_deployment_action_centre_08b | 20260924120448 | 08B | A | YES | NO | NO | NO | Former local filename: 20260924160000_staff_deployment_action_centre_08b.sql |
| supabase/migrations/20260924120709_effective_pause_and_dst_08a.sql | effective_pause_and_dst_08a | 20260924120709 | 08A | A | YES | NO | NO | NO | Former local filename: 20260924153100_effective_pause_and_dst_08a.sql |
| supabase/migrations/20260924120825_site_shift_history_08a.sql | site_shift_history_08a | 20260924120825 | 08A | A | YES | NO | NO | NO | Former local filename: 20260924153200_site_shift_history_08a.sql |
| supabase/migrations/20260924121209_workforce_horizon_indicator_08a.sql | workforce_horizon_indicator_08a | 20260924121209 | 08A | A | YES | NO | NO | NO | Former local filename: 20260924153400_workforce_horizon_indicator_08a.sql |
| supabase/migrations/20260924121412_validate_event_notification_recipient_08b.sql | validate_event_notification_recipient_08b | 20260924121412 | 08B | A | YES | NO | NO | NO | Former local filename: 20260924161000_validate_event_notification_recipient_08b.sql |
| supabase/migrations/20260924121758_event_attendance_09a.sql | event_attendance_09a | 20260924121758 | 09A | A | YES | NO | NO | NO | Former local filename: 20260924170000_event_attendance_09a.sql |
| supabase/migrations/20260924125902_fix_attendance_resolution_idempotency_09a.sql | fix_attendance_resolution_idempotency_09a | 20260924125902 | 09A | A | YES | NO | NO | NO | Former local filename: 20260924171000_fix_attendance_resolution_idempotency_09a.sql |
| supabase/migrations/20260924135623_task_08d_static_horizon_maintenance.sql | task_08d_static_horizon_maintenance | 20260924135623 | 08D | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924135852_task_08d_bounded_manual_rerun.sql | task_08d_bounded_manual_rerun | 20260924135852 | 08D | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924140336_static_allocation_action_centre_08c.sql | static_allocation_action_centre_08c | 20260924140336 | 08C | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924140706_static_notification_fk_indexes_08c.sql | static_notification_fk_indexes_08c | 20260924140706 | 08C | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924140945_replay_static_notification_after_cancel_08c.sql | replay_static_notification_after_cancel_08c | 20260924140945 | 08C | A | YES | NO | NO | NO | Historical SQL matches source |
| historical remote ledger only | task_08d_temporary_cron_execution_proof | 20260924141623 | 08D | C | NO | NO | YES | NO | Remote proof/test; excluded from replay |
| historical remote ledger only | task_08d_restore_daily_cron_schedule | 20260924141717 | 08D | C | NO | NO | YES | NO | Remote proof/test; excluded from replay |
| historical remote ledger only | task_08d_disable_cron_recovery_proof | 20260924141727 | 08D | C | NO | NO | YES | NO | Remote proof/test; excluded from replay |
| historical remote ledger only | task_08d_reenable_cron_after_proof | 20260924141743 | 08D | C | NO | NO | YES | NO | Remote proof/test; excluded from replay |
| supabase/migrations/20260924142904_task_12a_incident_reporting_foundation.sql | task_12a_incident_reporting_foundation | 20260924142904 | 12A | A | YES | NO | NO | NO | Resolved: canonical SQL restored from remote statement |
| historical remote ledger only | task_08d_failure_isolation_probe | 20260924143247 | 08D | C | NO | NO | YES | NO | Remote proof/test; excluded from replay |
| supabase/migrations/20260924143603_task_12a_submit_result.sql | task_12a_submit_result | 20260924143603 | 12A | A | YES | NO | NO | NO | Former local filename: 20260924190000_task_12a_submit_result.sql |
| supabase/migrations/20260924143623_task_08d_health_status.sql | task_08d_health_status | 20260924143623 | 08D | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924143710_task_12a_action_event_mapping.sql | task_12a_action_event_mapping | 20260924143710 | 12A | A | YES | NO | NO | NO | Former local filename: 20260924191000_task_12a_action_event_mapping.sql |
| supabase/migrations/20260924144710_task_12a_fk_indexes.sql | task_12a_fk_indexes | 20260924144710 | 12A | A | YES | NO | NO | NO | Former local filename: 20260924192000_task_12a_fk_indexes.sql |
| supabase/migrations/20260924144912_task_12a_external_descriptor_privacy.sql | task_12a_external_descriptor_privacy | 20260924144912 | 12A | A | YES | NO | NO | NO | Former local filename: 20260924193000_task_12a_external_descriptor_privacy.sql |
| supabase/migrations/20260924161448_attendance_pagination_focus_09a.sql | attendance_pagination_focus_09a | 20260924161448 | 09A | A | YES | NO | NO | NO | Former local filename: 20260924171500_attendance_pagination_focus_09a.sql |
| supabase/migrations/20260924170934_static_attendance_adapter_09b.sql | static_attendance_adapter_09b | 20260924170934 | 09B | A | YES | NO | NO | NO | Former local filename: 20260924200000_static_attendance_adapter_09b.sql |
| supabase/migrations/20260924172914_event_work_time_10b.sql | event_work_time_10b | 20260924172914 | 10B | A | YES | NO | NO | NO | Former local filename: 20260924210000_event_work_time_10b.sql |
| supabase/migrations/20260924173434_guard_approved_work_time_reopen_10b.sql | guard_approved_work_time_reopen_10b | 20260924173434 | 10B | A | YES | NO | NO | NO | Former local filename: 20260924211000_guard_approved_work_time_reopen_10b.sql |
| supabase/migrations/20260924173727_fix_work_time_manager_action_ambiguity_10b.sql | fix_work_time_manager_action_ambiguity_10b | 20260924173727 | 10B | A | YES | NO | NO | NO | Former local filename: 20260924212000_fix_work_time_manager_action_ambiguity_10b.sql |
| supabase/migrations/20260924174321_site_book_14a.sql | site_book_14a | 20260924174321 | 14A | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924174558_mobilisation_18a.sql | mobilisation_18a | 20260924174558 | 18A | A | YES | NO | NO | NO | Former local filename: 20260924222000_mobilisation_18a.sql |
| supabase/migrations/20260924174700_asset_custody_15a.sql | asset_custody_15a | 20260924174700 | 15A | A | YES | NO | NO | NO | Resolved: canonical SQL restored from remote statement |
| supabase/migrations/20260924174734_control_room_13a.sql | control_room_13a | 20260924174734 | 13A | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924174815_asset_person_custody_scope_15a.sql | asset_person_custody_scope_15a | 20260924174815 | 15A | A | YES | NO | NO | NO | Resolved: canonical SQL restored from remote statement |
| supabase/migrations/20260924174833_site_book_access_choices_14a.sql | site_book_access_choices_14a | 20260924174833 | 14A | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924174950_mobilisation_handover_facts_18a.sql | mobilisation_handover_facts_18a | 20260924174950 | 18A | A | YES | NO | NO | NO | Former local filename: 20260924222100_mobilisation_handover_facts_18a.sql |
| supabase/migrations/20260924175006_asset_history_null_guard_15a.sql | asset_history_null_guard_15a | 20260924175006 | 15A | A | YES | NO | NO | NO | Former local filename: 20260924223200_asset_history_null_guard_15a.sql |
| supabase/migrations/20260924175039_asset_event_location_15a.sql | asset_event_location_15a | 20260924175039 | 15A | A | YES | NO | NO | NO | Former local filename: 20260924223300_asset_event_location_15a.sql |
| supabase/migrations/20260924175131_asset_fk_indexes_15a.sql | asset_fk_indexes_15a | 20260924175131 | 15A | A | YES | NO | NO | NO | Former local filename: 20260924223400_asset_fk_indexes_15a.sql |
| supabase/migrations/20260924175213_asset_stock_adjustment_15a.sql | asset_stock_adjustment_15a | 20260924175213 | 15A | A | YES | NO | NO | NO | Resolved: canonical SQL restored from remote statement |
| supabase/migrations/20260924175345_asset_loss_recovery_15a.sql | asset_loss_recovery_15a | 20260924175345 | 15A | A | YES | NO | NO | NO | Resolved: canonical SQL restored from remote statement |
| supabase/migrations/20260924175424_asset_stock_history_15a.sql | asset_stock_history_15a | 20260924175424 | 15A | A | YES | NO | NO | NO | Former local filename: 20260924223700_asset_stock_history_15a.sql |
| supabase/migrations/20260924175455_asset_holder_choices_15a.sql | asset_holder_choices_15a | 20260924175455 | 15A | A | YES | NO | NO | NO | Resolved: canonical SQL restored from remote statement |
| supabase/migrations/20260924175517_asset_holder_choices_scope_15a.sql | asset_holder_choices_scope_15a | 20260924175517 | 15A | A | YES | NO | NO | NO | Former local filename: 20260924223900_asset_holder_choices_scope_15a.sql |
| supabase/migrations/20260924175751_site_book_read_model_14a.sql | site_book_read_model_14a | 20260924175751 | 14A | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924175811_asset_holder_labels_15a.sql | asset_holder_labels_15a | 20260924175811 | 15A | A | YES | NO | NO | NO | Former local filename: 20260924224000_asset_holder_labels_15a.sql |
| supabase/migrations/20260924175927_mobilisation_choices_18a.sql | mobilisation_choices_18a | 20260924175927 | 18A | A | YES | NO | NO | NO | Former local filename: 20260924222200_mobilisation_choices_18a.sql |
| supabase/migrations/20260924180256_asset_my_workspace_15a.sql | asset_my_workspace_15a | 20260924180256 | 15A | A | YES | NO | NO | NO | Former local filename: 20260924224100_asset_my_workspace_15a.sql |
| supabase/migrations/20260924180257_mobilisation_safe_projection_18a.sql | mobilisation_safe_projection_18a | 20260924180257 | 18A | A | YES | NO | NO | NO | Former local filename: 20260924222300_mobilisation_safe_projection_18a.sql |
| supabase/migrations/20260924180450_mobilisation_unlink_18a.sql | mobilisation_unlink_18a | 20260924180450 | 18A | A | YES | NO | NO | NO | Former local filename: 20260924222400_mobilisation_unlink_18a.sql |
| supabase/migrations/20260924180453_asset_grant_history_15a.sql | asset_grant_history_15a | 20260924180453 | 15A | A | YES | NO | NO | NO | Former local filename: 20260924224200_asset_grant_history_15a.sql |
| supabase/migrations/20260924180538_asset_grant_audit_view_15a.sql | asset_grant_audit_view_15a | 20260924180538 | 15A | A | YES | NO | NO | NO | Former local filename: 20260924224300_asset_grant_audit_view_15a.sql |
| supabase/migrations/20260924180738_asset_null_guard_15a.sql | asset_null_guard_15a | 20260924180738 | 15A | A | YES | NO | NO | NO | Resolved: canonical SQL restored from remote statement |
| supabase/migrations/20260924180819_site_book_item_lookback_14a.sql | site_book_item_lookback_14a | 20260924180819 | 14A | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924180911_site_book_item_execute_14a.sql | site_book_item_execute_14a | 20260924180911 | 14A | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924181108_asset_inspection_scope_15a.sql | asset_inspection_scope_15a | 20260924181108 | 15A | A | YES | NO | NO | NO | Former local filename: 20260924224500_asset_inspection_scope_15a.sql |
| supabase/migrations/20260924181328_asset_stock_actor_fields_15a.sql | asset_stock_actor_fields_15a | 20260924181328 | 15A | A | YES | NO | NO | NO | Former local filename: 20260924224600_asset_stock_actor_fields_15a.sql |
| supabase/migrations/20260924181601_mobilisation_private_facts_18a.sql | mobilisation_private_facts_18a | 20260924181601 | 18A | A | YES | NO | NO | NO | Former local filename: 20260924222500_mobilisation_private_facts_18a.sql |
| supabase/migrations/20260924181907_site_book_grant_uniqueness_14a.sql | site_book_grant_uniqueness_14a | 20260924181907 | 14A | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924193618_training_catalogue_20b.sql | training_catalogue_20b | 20260924193618 | 20B | A | YES | NO | NO | NO | Resolved: canonical SQL restored from remote statement |
| supabase/migrations/20260924193642_training_catalogue_20b_schema.sql | training_catalogue_20b_schema | 20260924193642 | 20B | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924193719_training_synthetic_fixture_20b.sql | training_synthetic_fixture_20b | 20260924193719 | 20B | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924193855_training_grant_readback_20b.sql | training_grant_readback_20b | 20260924193855 | 20B | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924193913_operational_controlled_documents_19a.sql | operational_controlled_documents_19a | 20260924193913 | 19A | A | YES | NO | NO | NO | Former local filename: 20260924233000_operational_controlled_documents_19a.sql |
| supabase/migrations/20260924194122_operational_document_guard_19a.sql | operational_document_guard_19a | 20260924194122 | 19A | A | YES | NO | NO | NO | Former local filename: 20260924233100_operational_document_guard_19a.sql |
| supabase/migrations/20260924194207_operational_document_replace_order_19a.sql | operational_document_replace_order_19a | 20260924194207 | 19A | A | YES | NO | NO | NO | Former local filename: 20260924233200_operational_document_replace_order_19a.sql |
| supabase/migrations/20260924194309_training_active_identity_grant_20b.sql | training_active_identity_grant_20b | 20260924194309 | 20B | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924194533_time_away_17b.sql | time_away_17b | 20260924194533 | 17B | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924194551_operational_document_operations_status_19a.sql | operational_document_operations_status_19a | 20260924194551 | 19A | A | YES | NO | NO | NO | Former local filename: 20260924233300_operational_document_operations_status_19a.sql |
| supabase/migrations/20260924194554_credential_foundation_16b.sql | credential_foundation_16b | 20260924194554 | 16B | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924194705_task_21b_service_delivery.sql | task_21b_service_delivery | 20260924194705 | 21B | A | YES | NO | NO | NO | Former local filename: 20260924193740_task_21b_service_delivery.sql |
| supabase/migrations/20260924194753_training_course_identity_20b.sql | training_course_identity_20b | 20260924194753 | 20B | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924194835_task_21b_blocker_reason_fix.sql | task_21b_blocker_reason_fix | 20260924194835 | 21B | A | YES | NO | NO | NO | Former local filename: 20260924194814_task_21b_blocker_reason_fix.sql |
| supabase/migrations/20260924194940_operational_document_file_proof_19a.sql | operational_document_file_proof_19a | 20260924194940 | 19A | A | YES | NO | NO | NO | Former local filename: 20260924233400_operational_document_file_proof_19a.sql |
| supabase/migrations/20260924195120_fix_credential_submission_alias_16b.sql | fix_credential_submission_alias_16b | 20260924195120 | 16B | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924195328_time_away_17b_guards.sql | time_away_17b_guards | 20260924195328 | 17B | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924195541_time_away_17b_note_gate.sql | time_away_17b_note_gate | 20260924195541 | 17B | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924195548_operational_contacts_22b.sql | operational_contacts_22b | 20260924195548 | 22B | A | YES | NO | NO | NO | Resolved: canonical SQL restored from remote statement |
| supabase/migrations/20260924195630_management_reporting_23b.sql | management_reporting_23b | 20260924195630 | 23B | A | YES | NO | NO | NO | Resolved: canonical SQL restored from remote statement |
| supabase/migrations/20260924195657_operational_document_context_labels_19a.sql | operational_document_context_labels_19a | 20260924195657 | 19A | A | YES | NO | NO | NO | Former local filename: 20260924233500_operational_document_context_labels_19a.sql |
| supabase/migrations/20260924195743_reporting_result_name_23b.sql | reporting_result_name_23b | 20260924195743 | 23B | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924195913_operational_contacts_publish_fix_22b.sql | operational_contacts_publish_fix_22b | 20260924195913 | 22B | A | YES | NO | NO | NO | Former local filename: 20260924235500_operational_contacts_publish_fix_22b.sql |
| supabase/migrations/20260924195954_office_only_credential_decisions_16b.sql | office_only_credential_decisions_16b | 20260924195954 | 16B | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924200012_task_21b_owner_null_guard.sql | task_21b_owner_null_guard | 20260924200012 | 21B | A | YES | NO | NO | NO | Former local filename: 20260924195952_task_21b_owner_null_guard.sql |
| supabase/migrations/20260924200028_time_away_17b_calendar.sql | time_away_17b_calendar | 20260924200028 | 17B | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924200107_operational_document_assigner_catalogue_19a.sql | operational_document_assigner_catalogue_19a | 20260924200107 | 19A | A | YES | NO | NO | NO | Former local filename: 20260924233600_operational_document_assigner_catalogue_19a.sql |
| supabase/migrations/20260924200215_operational_document_policy_execute_19a.sql | operational_document_policy_execute_19a | 20260924200215 | 19A | A | YES | NO | NO | NO | Former local filename: 20260924233700_operational_document_policy_execute_19a.sql |
| supabase/migrations/20260924200344_audit_credential_oversight_16b.sql | audit_credential_oversight_16b | 20260924200344 | 16B | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924200353_operational_contact_window_22b.sql | operational_contact_window_22b | 20260924200353 | 22B | A | YES | NO | NO | NO | Former local filename: 20260924235600_operational_contact_window_22b.sql |
| supabase/migrations/20260924200456_controlled_policy_outer_ids_19a.sql | controlled_policy_outer_ids_19a | 20260924200456 | 19A | A | YES | NO | NO | NO | Former local filename: 20260924233800_controlled_policy_outer_ids_19a.sql |
| supabase/migrations/20260924200511_time_away_17b_read_scope.sql | time_away_17b_read_scope | 20260924200511 | 17B | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924200816_reporting_coverage_23b.sql | reporting_coverage_23b | 20260924200816 | 23B | A | YES | NO | NO | NO | Resolved: canonical SQL restored from remote statement |
| supabase/migrations/20260924200915_operational_contact_context_names_22b.sql | operational_contact_context_names_22b | 20260924200915 | 22B | A | YES | NO | NO | NO | Former local filename: 20260924235700_operational_contact_context_names_22b.sql |
| supabase/migrations/20260924200943_time_away_17b_team_lifecycle.sql | time_away_17b_team_lifecycle | 20260924200943 | 17B | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924200958_reporting_event_coverage_23b.sql | reporting_event_coverage_23b | 20260924200958 | 23B | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924201143_training_assignments_20c.sql | training_assignments_20c | 20260924201143 | 20C | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/dev_only/20260924235800_task_22b_synthetic_person.sql | dev_only_task_22b_synthetic_person | 20260924201216 | 22B | D | NO | YES | NO | NO | Synthetic Dev activation/fixture; outside normal replay |
| supabase/migrations/20260924201422_operational_document_provenance_19a.sql | operational_document_provenance_19a | 20260924201422 | 19A | A | YES | NO | NO | NO | Former local filename: 20260924233900_operational_document_provenance_19a.sql |
| supabase/migrations/20260924201748_operational_contact_london_window_22b.sql | operational_contact_london_window_22b | 20260924201748 | 22B | A | YES | NO | NO | NO | Former local filename: 20260924235900_operational_contact_london_window_22b.sql |
| supabase/migrations/20260924201750_training_assignment_guards_20c.sql | training_assignment_guards_20c | 20260924201750 | 20C | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924201755_task_21c_staffing_attendance_cards.sql | task_21c_staffing_attendance_cards | 20260924201755 | 21C | A | YES | NO | NO | NO | Former local filename: 20260924201521_task_21c_staffing_attendance_cards.sql |
| supabase/migrations/20260924202525_operational_contact_event_semantics_22b.sql | operational_contact_event_semantics_22b | 20260924202525 | 22B | A | YES | NO | NO | NO | Former local filename: 20260924235930_operational_contact_event_semantics_22b.sql |
| supabase/migrations/20260924202659_operational_contact_management_history_22b.sql | operational_contact_management_history_22b | 20260924202659 | 22B | A | YES | NO | NO | NO | Former local filename: 20260924235940_operational_contact_management_history_22b.sql |
| supabase/migrations/20260924202801_operational_contact_advisor_22b.sql | operational_contact_advisor_22b | 20260924202801 | 22B | A | YES | NO | NO | NO | Former local filename: 20260924235950_operational_contact_advisor_22b.sql |
| supabase/migrations/20260924221957_training_assessments_20d.sql | training_assessments_20d | 20260924221957 | 20D | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924222117_leave_scheduling_constraint_17c.sql | leave_scheduling_constraint_17c | 20260924222117 | 17C | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924222218_training_assessment_choices_20d.sql | training_assessment_choices_20d | 20260924222218 | 20D | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924222411_training_assessment_retake_projection_20d.sql | training_assessment_retake_projection_20d | 20260924222411 | 20D | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924222550_training_assessment_answer_validation_20d.sql | training_assessment_answer_validation_20d | 20260924222550 | 20D | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924222558_leave_workforce_projection_17c.sql | leave_workforce_projection_17c | 20260924222558 | 17C | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924223436_training_assessment_guard_refinements_20d.sql | training_assessment_guard_refinements_20d | 20260924223436 | 20D | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924223814_training_assessment_start_lock_20d.sql | training_assessment_start_lock_20d | 20260924223814 | 20D | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924223901_training_assessment_algorithm_20d.sql | training_assessment_algorithm_20d | 20260924223901 | 20D | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/migrations/20260924224338_training_assessment_start_source_lock_20d.sql | training_assessment_start_source_lock_20d | 20260924224338 | 20D | A | YES | NO | NO | NO | Historical SQL matches source |
| supabase/staging_history/20260923094852_staging_reconcile_versions_03g.sql | staging_reconcile_versions_03g | none in survivor | 03G | G | NO | NO | NO | NO | Deleted staging history; outside normal replay |
| supabase/staging_history/20260923095239_seed_staging_03g.sql | seed_staging_03g | none in survivor | 03G | G | NO | NO | NO | NO | Deleted staging history; outside normal replay |
| 19A owner worktree: supabase/dev_only/20260924234000_operational_storage_server_boundary_19a.sql | operational_storage_server_boundary_19a | none; unapplied | 19A | F | NO | YES | NO | NO | UNAPPLIED — SECURITY CLOSE-OUT PENDING; not integrated |

## Branch and pending boundaries

- The accepted 17B/21B/21C source is integrated through merge `6b97048`, preserving the accepted branch history and ten formerly worktree-only migration files.
- TASK-17C source from `c0f4456` is integrated by `2055165`; its two SQL statements match remote `20260924222117` and `20260924222558`. TASK-17C remains **unaccepted**; `da0249f` verification follow-up remains on the owner branch.
- Ten already-applied 19A product SQL files were byte-matched and committed by `9c28192`. 19A UI, new server-only PDF work, tests and the unapplied Dev-only Storage candidate remain in the owner's shared checkout, outside this integration branch. **UNAPPLIED — SECURITY CLOSE-OUT PENDING.** No secret was copied or configured.
- Historical delivery reports retain their observed versions and project refs. The two deleted-staging 03G files are in `supabase/staging_history` for historical evidence only.

## Replay limits

All 180 canonical files parse as PostgreSQL SQL. The static scan found no duplicate version, no detected ALTER-before-CREATE for locally created tables, and no proof/Dev-only/staging SQL in normal replay. The Dev-only scripts activate a synthetic policy or create a synthetic Person; no product schema creator was found in them. The remote applied order is represented by filenames. This does not test PL/pgSQL runtime behavior, data-dependent statements, extensions, seed assumptions, or clean-environment execution. No disposable Postgres/Supabase runtime was available, so a clean replay was not run.
