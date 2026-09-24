-- Privacy review gate: TASK-17B uses controlled decision reasons only.
-- The optional free-text note remains disabled until separately reviewed.
alter table public.time_away_decisions add constraint time_away_decisions_no_note_17b check (note is null);
