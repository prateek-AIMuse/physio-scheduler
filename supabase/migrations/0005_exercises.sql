-- Home exercise programmes: each practice keeps an exercise library, assigns exercises to patients
-- with sets and reps, and patients tick off each day they did them.
-- Run once in the Supabase SQL editor, after 0004_self_booking.sql.

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices (id) on delete cascade,
  name text not null,
  body_area text not null default '',
  instructions text not null default '',
  -- A demonstration video (YouTube, Vimeo, Google Drive…)
  video_url text not null default '',
  created_at timestamptz not null default now()
);
create index on public.exercises (practice_id, name);

create table public.patient_exercises (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  sets int not null default 3 check (sets between 1 and 20),
  reps int not null default 10 check (reps between 1 and 200),
  hold_seconds int check (hold_seconds between 1 and 600),
  times_per_day int not null default 1 check (times_per_day between 1 and 10),
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.patient_exercises (patient_id, active);

-- One row per exercise per day the patient did it (days in the practice's time zone)
create table public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  patient_exercise_id uuid not null references public.patient_exercises (id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  unique (patient_exercise_id, day)
);
create index on public.exercise_logs (patient_id, day);

alter table public.exercises enable row level security;
alter table public.patient_exercises enable row level security;
alter table public.exercise_logs enable row level security;

-- Assignments and logs take the patient's practice, and can't point at another practice's patient
create trigger patient_exercises_practice before insert or update of patient_id, practice_id on public.patient_exercises
  for each row execute function public.practice_from_patient();
create trigger exercise_logs_practice before insert or update of patient_id, practice_id on public.exercise_logs
  for each row execute function public.practice_from_patient();

-- An assignment must use an exercise from the same practice's library
create or replace function public.exercise_same_practice()
returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.exercises e where e.id = new.exercise_id and e.practice_id = new.practice_id) then
    raise exception 'That exercise belongs to another practice';
  end if;
  return new;
end $$;
create trigger patient_exercises_same_practice after insert or update of exercise_id, practice_id on public.patient_exercises
  for each row execute function public.exercise_same_practice();
