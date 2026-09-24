-- TASK-20D. Pin the deterministic grader identifier on every Attempt.
alter table public.training_attempts add column grading_algorithm text not null default 'EXACT_EQUAL_WEIGHT_V1'
 check (grading_algorithm='EXACT_EQUAL_WEIGHT_V1');
