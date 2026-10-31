-- Online payments: each practice can connect its own Razorpay and/or Stripe account. Patients pay
-- by card, UPI or wallet on the gateway's page, and the gateway's webhook marks the request paid.
-- Run once in the Supabase SQL editor, after 0005_exercises.sql.

-- Gateway keys, kept apart from settings. Only the server (service role) can read this table.
create table public.payment_gateways (
  practice_id uuid primary key references public.practices (id) on delete cascade,
  razorpay_key_id text not null default '',
  razorpay_key_secret text not null default '',
  razorpay_webhook_secret text not null default '',
  stripe_secret_key text not null default '',
  stripe_webhook_secret text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.payment_gateways enable row level security;

-- Which gateway a request was sent to, and its reference there (payment link or checkout session)
alter table public.payment_requests add column gateway text check (gateway in ('razorpay', 'stripe'));
alter table public.payment_requests add column gateway_ref text;
alter table public.payment_requests add column gateway_url text;
alter table public.payment_requests add column paid_via text;
create index on public.payment_requests (gateway_ref);
