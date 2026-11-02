-- The condition each patient is being treated for, e.g. "Knee osteoarthritis" or "ACL reconstruction rehab".
-- Run once in the Supabase SQL editor, after 0006_online_payments.sql.
alter table public.patients add column condition text not null default '';
