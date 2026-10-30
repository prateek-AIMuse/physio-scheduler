-- Physio scheduler: settings, availability, patients, packages, visits, payment requests and the
-- WhatsApp message queue. Run once in the Supabase SQL editor.
--
-- Row-level security is on for every table with no policies: browsers can't read or write anything
-- directly. The server checks who is signed in, then uses the service role key.

create extension if not exists pgcrypto;

-- One row of practice settings, edited from /admin/settings
create table public.settings (
  id smallint primary key default 1 check (id = 1),
  practice_name text not null default 'Physio',
  physio_name text not null default '',
  clinic_name text not null default 'Dominate Performance',
  clinic_maps_url text not null default 'https://share.google/nQacWV52Jb7u5K6CU',
  upi_id text not null default 'omchavanl10-2@okhdfcbank',
  upi_payee_name text not null default '',
  home_visit_fee numeric(10,2) not null default 0 check (home_visit_fee >= 0),
  travel_buffer_minutes int not null default 30 check (travel_buffer_minutes between 0 and 180),
  -- 'manual': the physio sends each message with one tap. 'cloud_api': sent automatically.
  whatsapp_mode text not null default 'manual' check (whatsapp_mode in ('manual', 'cloud_api')),
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1);

-- The physio's weekly free slots. weekday: 1 = Monday … 7 = Sunday. Times are India time.
create table public.availability (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  full_name text not null,
  -- Digits only, with country code: 919876543210
  phone text not null unique check (phone ~ '^[1-9][0-9]{7,14}$'),
  address text not null default '',
  maps_url text not null default '',
  session_minutes int not null default 60 check (session_minutes between 15 and 180),
  visits_per_week int not null default 2 check (visits_per_week between 0 and 7),
  default_location text not null default 'clinic' check (default_location in ('clinic', 'home')),
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Times that suit each patient. location null = the patient's default location.
create table public.preferences (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  location text check (location in ('clinic', 'home')),
  check (end_time > start_time)
);
create index on public.preferences (patient_id);

-- Prepaid packages of N visits (any mix of clinic and home). paid_at null = not paid yet.
create table public.packages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  total_visits int not null check (total_visits between 1 and 200),
  price numeric(10,2) not null check (price >= 0),
  paid_at timestamptz,
  notes text not null default '',
  -- Set when the app made this package as the renewal after a visit used up the previous one
  auto_from_visit uuid,
  created_at timestamptz not null default now()
);
create index on public.packages (patient_id, created_at);

-- proposed: suggested by the planner, waiting for the physio's approval.
-- Only completed visits use up a package visit; visit_no is the counter within the package.
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text not null check (location in ('clinic', 'home')),
  status text not null default 'scheduled' check (status in ('proposed', 'scheduled', 'completed', 'cancelled', 'no_show')),
  package_id uuid references public.packages (id) on delete set null,
  visit_no int,
  home_fee numeric(10,2) not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index on public.visits (starts_at);
create index on public.visits (patient_id, starts_at);
create unique index visits_package_counter on public.visits (package_id, visit_no) where package_id is not null;

-- A payment demand, paid by UPI at /pay/<token>. The physio marks it paid.
create table public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  patient_id uuid not null references public.patients (id) on delete cascade,
  -- The package this payment buys (the renewal), if any
  package_id uuid references public.packages (id) on delete set null,
  amount numeric(10,2) not null check (amount > 0),
  description text not null default '',
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  -- The completed visit that triggered this request, so undoing that visit can withdraw it
  from_visit uuid,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index on public.payment_requests (patient_id, created_at);

-- WhatsApp messages. In manual mode the physio taps Send on each; in cloud_api mode the cron sends them.
-- dedupe_key stops the same reminder being queued twice.
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  visit_id uuid references public.visits (id) on delete cascade,
  kind text not null check (kind in ('weekly_summary', 'day_reminder', 'payment_request', 'login_link', 'custom')),
  dedupe_key text unique,
  body text not null,
  -- Values for the approved WhatsApp template (cloud_api mode)
  template_params jsonb not null default '[]',
  due_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'sent', 'skipped', 'failed')),
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);
create index on public.messages (status, due_at);

alter table public.settings enable row level security;
alter table public.availability enable row level security;
alter table public.patients enable row level security;
alter table public.preferences enable row level security;
alter table public.packages enable row level security;
alter table public.visits enable row level security;
alter table public.payment_requests enable row level security;
alter table public.messages enable row level security;

-- Marks a visit completed and moves the counter forward, in one transaction.
-- The visit goes to the patient's oldest package that still has visits left. When it uses up the
-- package, the next package is made (same size and price) and a payment request goes out for it,
-- plus any home-visit fees from the package just finished.
create or replace function public.complete_visit(p_visit uuid, p_home_fee numeric)
returns jsonb language plpgsql as $$
declare
  v public.visits;
  pkg public.packages;
  nxt public.packages;
  used int;
  extras numeric;
  amount numeric := 0;
  with_price boolean := false;
  req uuid;
begin
  select * into v from public.visits where id = p_visit;
  if not found then raise exception 'Visit not found'; end if;
  if v.status = 'completed' then
    return jsonb_build_object('package_id', v.package_id, 'visit_no', v.visit_no, 'request_id', null);
  end if;
  -- One completion at a time per patient, so two visits never get the same number
  perform 1 from public.patients where id = v.patient_id for update;

  select p.* into pkg from public.packages p
  where p.patient_id = v.patient_id
    and (select count(*) from public.visits x where x.package_id = p.id) < p.total_visits
  order by p.created_at, p.id limit 1;

  if not found then
    update public.visits set status = 'completed', completed_at = now(), package_id = null, visit_no = null,
      home_fee = case when v.location = 'home' then p_home_fee else 0 end
    where id = v.id;
    return jsonb_build_object('package_id', null, 'visit_no', null, 'request_id', null);
  end if;

  select count(*) into used from public.visits where package_id = pkg.id;
  update public.visits set status = 'completed', completed_at = now(), package_id = pkg.id, visit_no = used + 1,
    home_fee = case when v.location = 'home' then p_home_fee else 0 end
  where id = v.id;

  if used + 1 < pkg.total_visits then
    return jsonb_build_object('package_id', pkg.id, 'visit_no', used + 1, 'total', pkg.total_visits, 'request_id', null);
  end if;

  -- Package used up: find or make the next one, and ask for what's owed
  select coalesce(sum(home_fee), 0) into extras from public.visits where package_id = pkg.id;
  select p.* into nxt from public.packages p
  where p.patient_id = v.patient_id and p.id <> pkg.id
    and (select count(*) from public.visits x where x.package_id = p.id) < p.total_visits
  order by p.created_at, p.id limit 1;
  if not found then
    insert into public.packages (patient_id, total_visits, price, auto_from_visit)
    values (v.patient_id, pkg.total_visits, pkg.price, v.id) returning * into nxt;
  end if;

  if nxt.paid_at is null and not exists (
    select 1 from public.payment_requests where package_id = nxt.id and status in ('pending', 'paid')
  ) and nxt.price > 0 then
    with_price := true;
    amount := nxt.price;
  end if;
  amount := amount + extras;

  if amount > 0 then
    insert into public.payment_requests (patient_id, package_id, amount, description, from_visit)
    values (
      v.patient_id,
      case when with_price then nxt.id end,
      amount,
      concat_ws(' + ',
        case when with_price then format('Next package: %s visits', nxt.total_visits) end,
        case when extras > 0 then format('Home-visit fees: ₹%s', extras) end),
      v.id)
    returning id into req;
  end if;

  return jsonb_build_object('package_id', pkg.id, 'visit_no', used + 1, 'total', pkg.total_visits,
    'request_id', req, 'next_package_id', nxt.id);
end $$;

-- Undoes a completion marked by mistake. Only the latest visit of a package can be undone, so the
-- counter never has gaps. Withdraws the payment request and renewal package it made, if unpaid.
create or replace function public.reopen_visit(p_visit uuid)
returns void language plpgsql as $$
declare
  v public.visits;
begin
  select * into v from public.visits where id = p_visit;
  if not found or v.status <> 'completed' then raise exception 'Visit is not completed'; end if;
  perform 1 from public.patients where id = v.patient_id for update;
  if v.package_id is not null and exists (
    select 1 from public.visits where package_id = v.package_id and visit_no > v.visit_no
  ) then
    raise exception 'Only the latest visit of a package can be undone';
  end if;
  if exists (select 1 from public.payment_requests where from_visit = v.id and status = 'paid') then
    raise exception 'The payment this visit asked for is already marked paid';
  end if;
  update public.payment_requests set status = 'cancelled' where from_visit = v.id and status = 'pending';
  delete from public.packages p where p.auto_from_visit = v.id and p.paid_at is null
    and not exists (select 1 from public.visits x where x.package_id = p.id);
  update public.visits set status = 'scheduled', completed_at = null, package_id = null, visit_no = null, home_fee = 0
  where id = v.id;
end $$;

revoke all on function public.complete_visit(uuid, numeric) from public, anon, authenticated;
revoke all on function public.reopen_visit(uuid) from public, anon, authenticated;
grant execute on function public.complete_visit(uuid, numeric) to service_role;
grant execute on function public.reopen_visit(uuid) to service_role;
