-- Scope NEW/OLD field checks by table; triggers also cover rows with different shapes.
create or replace function private.guard_site_shift_08a() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if current_setting('kss.write_08a',true) is distinct from 'allowed' then raise exception 'Site shift direct write denied'; end if;
 if tg_op='DELETE' then raise exception 'Site shift history cannot be deleted'; end if;
 if tg_op='INSERT' then return new; end if;
 if tg_table_name in ('site_service_events','site_service_pauses','site_shift_demand_events',
  'site_shift_exceptions','site_shift_template_lines','site_shift_template_events') then
  raise exception 'Site shift history is immutable';
 elsif tg_table_name='site_services' then
  if new.id is distinct from old.id or new.site_id is distinct from old.site_id or
   new.site_client_link_id is distinct from old.site_client_link_id or new.organisation_id is distinct from old.organisation_id or
   new.created_by_person_id is distinct from old.created_by_person_id or new.created_at is distinct from old.created_at or
   new.revision<>old.revision+1 then raise exception 'Service identity cannot change'; end if;
 elsif tg_table_name='site_shift_demands' then
  if new.id is distinct from old.id or new.service_id is distinct from old.service_id or
   new.template_line_id is distinct from old.template_line_id or new.origin is distinct from old.origin or
   new.service_date is distinct from old.service_date or new.created_by_person_id is distinct from old.created_by_person_id or
   new.created_at is distinct from old.created_at or new.revision<>old.revision+1 or old.state='CANCELLED' then
   raise exception 'Dated demand identity cannot change'; end if;
 elsif tg_table_name='site_shift_template_versions' then
  if new.id is distinct from old.id or new.line_id is distinct from old.line_id or new.service_id is distinct from old.service_id or
   new.version is distinct from old.version or new.effective_from is distinct from old.effective_from or
   new.weekdays is distinct from old.weekdays or new.role_id is distinct from old.role_id or
   new.required_quantity is distinct from old.required_quantity or new.report_time is distinct from old.report_time or
   new.shift_start_time is distinct from old.shift_start_time or new.shift_end_time is distinct from old.shift_end_time or
   new.area_label is distinct from old.area_label or new.reporting_point is distinct from old.reporting_point or
   new.actor_person_id is distinct from old.actor_person_id or new.published_at is distinct from old.published_at or
   new.reason is distinct from old.reason or old.effective_until is not null or new.effective_until<=old.effective_from then
   raise exception 'Published template is immutable'; end if;
 end if;
 return new;
end $$;
