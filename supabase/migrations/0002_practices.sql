-- Many practices on one Movera. Every physio has their own practice; patients, calendar, packages,
-- payments, messages and settings all belong to one practice and are kept apart.
-- Run once in the Supabase SQL editor, after 0001_schema.sql.
--
-- The data already in the app becomes the first practice. It has no owner yet: the first time a
-- platform owner (an email in ADMIN_EMAILS) logs in, they take it over.

create table public.practices (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid unique references auth.users (id) on delete set null,
  -- pending: signed up, waiting for the platform owner's approval
  status text not null default 'pending' check (status in ('pending', 'approved', 'suspended')),
  physio_name text not null default '',
  email text not null default '',
  phone text not null default '',
  city text not null default '',
  registration_no text not null default '',
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
alter table public.practices enable row level security;

do $$
declare
  legacy uuid;
begin
  insert into public.practices (status, physio_name, approved_at)
  select 'approved', physio_name, now() from public.settings limit 1
  returning id into legacy;
  if legacy is null then
    insert into public.practices (status, approved_at) values ('approved', now()) returning id into legacy;
  end if;

  -- Settings: one row per practice instead of one row in all
  alter table public.settings add column practice_id uuid references public.practices (id) on delete cascade;
  update public.settings set practice_id = legacy;
  alter table public.settings drop constraint if exists settings_id_check;
  alter table public.settings drop constraint settings_pkey;
  alter table public.settings drop column id;
  alter table public.settings alter column practice_id set not null;
  alter table public.settings add primary key (practice_id);

  -- Every other table gets the practice it belongs to
  alter table public.availability add column practice_id uuid references public.practices (id) on delete cascade;
  alter table public.patients add column practice_id uuid references public.practices (id) on delete cascade;
  alter table public.preferences add column practice_id uuid references public.practices (id) on delete cascade;
  alter table public.packages add column practice_id uuid references public.practices (id) on delete cascade;
  alter table public.visits add column practice_id uuid references public.practices (id) on delete cascade;
  alter table public.payment_requests add column practice_id uuid references public.practices (id) on delete cascade;
  alter table public.messages add column practice_id uuid references public.practices (id) on delete cascade;
  update public.availability set practice_id = legacy;
  update public.patients set practice_id = legacy;
  update public.preferences set practice_id = legacy;
  update public.packages set practice_id = legacy;
  update public.visits set practice_id = legacy;
  update public.payment_requests set practice_id = legacy;
  update public.messages set practice_id = legacy;
end $$;

alter table public.availability alter column practice_id set not null;
alter table public.patients alter column practice_id set not null;
alter table public.preferences alter column practice_id set not null;
alter table public.packages alter column practice_id set not null;
alter table public.visits alter column practice_id set not null;
alter table public.payment_requests alter column practice_id set not null;
alter table public.messages alter column practice_id set not null;

create index on public.availability (practice_id);
create index on public.patients (practice_id);
create index on public.visits (practice_id, starts_at);
create index on public.payment_requests (practice_id, status);
create index on public.messages (practice_id, status, due_at);

-- The same person can be a patient of more than one physio: phone numbers are unique per practice,
-- and one login can belong to several patient records
alter table public.patients drop constraint patients_phone_key;
alter table public.patients add constraint patients_practice_phone_key unique (practice_id, phone);
alter table public.patients drop constraint patients_user_id_key;
create index on public.patients (user_id);

-- New practices start with an empty clinic and UPI ID; the physio fills them in under Settings
alter table public.settings alter column clinic_name set default '';
alter table public.settings alter column clinic_maps_url set default '';
alter table public.settings alter column upi_id set default '';

-- Rows that belong to a patient take that patient's practice, and can't point at another one.
-- This also covers the packages and payment requests that complete_visit() creates.
create or replace function public.practice_from_patient()
returns trigger language plpgsql as $$
declare
  p uuid;
begin
  select practice_id into p from public.patients where id = new.patient_id;
  if p is null then raise exception 'Patient not found'; end if;
  if new.practice_id is null then
    new.practice_id := p;
  elsif new.practice_id <> p then
    raise exception 'That patient belongs to another practice';
  end if;
  return new;
end $$;

create trigger preferences_practice before insert or update of patient_id, practice_id on public.preferences
  for each row execute function public.practice_from_patient();
create trigger packages_practice before insert or update of patient_id, practice_id on public.packages
  for each row execute function public.practice_from_patient();
create trigger visits_practice before insert or update of patient_id, practice_id on public.visits
  for each row execute function public.practice_from_patient();
create trigger payment_requests_practice before insert or update of patient_id, practice_id on public.payment_requests
  for each row execute function public.practice_from_patient();
create trigger messages_practice before insert or update of patient_id, practice_id on public.messages
  for each row execute function public.practice_from_patient();
