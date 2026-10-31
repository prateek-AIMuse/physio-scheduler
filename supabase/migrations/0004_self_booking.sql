-- Patients book, move and cancel their own sessions, if the physio switches it on.
-- Run once in the Supabase SQL editor, after 0003_regions.sql.
alter table public.settings add column self_booking boolean not null default false;
-- How far ahead of a session patients can still book, move or cancel it
alter table public.settings add column booking_notice_hours int not null default 12 check (booking_notice_hours between 0 and 168);
-- How many days ahead patients can see open times
alter table public.settings add column booking_window_days int not null default 14 check (booking_window_days between 1 and 60);
-- Who made or last changed the booking, so the physio sees what patients did
alter table public.visits add column booked_by text not null default 'physio' check (booked_by in ('physio', 'patient'));
alter table public.visits add column changed_at timestamptz;
