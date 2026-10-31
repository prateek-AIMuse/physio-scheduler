-- Each practice works in its own time zone and currency, with its own default phone country code.
-- Run once in the Supabase SQL editor, after 0002_practices.sql.
alter table public.settings add column time_zone text not null default 'Asia/Kolkata';
alter table public.settings add column currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$');
alter table public.settings add column country_code text not null default '91' check (country_code ~ '^[1-9][0-9]{0,3}$');
-- How to pay when UPI doesn't apply (other currencies), e.g. bank details; shown on the payment page
alter table public.settings add column payment_instructions text not null default '';
