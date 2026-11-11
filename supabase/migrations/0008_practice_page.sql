-- Each practice's own mini website (a public page at /<slug>) and the booking requests new patients
-- send from it. Run once in the Supabase SQL editor, after 0007_patient_condition.sql.

-- What the public page shows. The physio's name, clinic and city come from Settings and sign-up.
create table public.practice_pages (
  practice_id uuid primary key references public.practices (id) on delete cascade,
  -- The page's address: lowercase letters, digits and single hyphens, e.g. dr-priya-shah
  slug text unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40),
  published boolean not null default false,
  headline text not null default '',
  about text not null default '',
  qualifications text not null default '',
  -- Comma-separated, shown as tags
  specialities text not null default '',
  -- Where home visits are offered, e.g. "Andheri, Bandra, Juhu"
  home_areas text not null default '',
  -- [{ "name": "Clinic session", "minutes": 45, "price": 800, "where": "clinic" | "home" | "both" }]
  services jsonb not null default '[]',
  show_whatsapp boolean not null default true,
  accept_bookings boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.practice_pages enable row level security;

-- A time a new patient asked for on the public page. It holds the time until the physio accepts
-- (the patient and the visit are created then) or declines.
create table public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices (id) on delete cascade,
  full_name text not null,
  phone text not null check (phone ~ '^[1-9][0-9]{7,14}$'),
  service text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text not null default 'clinic' check (location in ('clinic', 'home')),
  address text not null default '',
  note text not null default '',
  status text not null default 'new' check (status in ('new', 'accepted', 'declined')),
  patient_id uuid references public.patients (id) on delete set null,
  visit_id uuid references public.visits (id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  check (ends_at > starts_at)
);
create index on public.booking_requests (practice_id, status, starts_at);
alter table public.booking_requests enable row level security;
