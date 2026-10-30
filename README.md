# Movera

*Physio, planned around you.* Scheduling, prepaid packages, UPI payment requests and WhatsApp reminders for a one-physio practice
that sees patients at **Dominate Performance** or at their homes.

Built with Next.js 16, Supabase (login and Postgres) and hosted free on Cloudflare Workers, the same
setup as the Sound of Muses site.

## What it does

**For the physio** (logs in with email and password, `/admin`):

| Page | What's there |
| --- | --- |
| Today | Today's and tomorrow's visits with **Done / No-show / Cancel**, WhatsApp messages waiting to be sent, money owed |
| Calendar | One week at a time. **Suggest visits** plans the week; review, change or remove suggestions, then **Approve all**. Book visits by hand. |
| Patients | Each patient's WhatsApp number, home address and Google Maps link, session length (45, 60… minutes), visits per week, usual place, preferred times, packages and visit history |
| Payments | Requests waiting, mark paid, change an amount, ask for a one-off payment |
| Messages | Every WhatsApp message: to send now, coming up, sent |
| Hours | The weekly free slots visits can go in |
| Settings | Clinic name and map link, UPI ID, home-visit fee, travel time around home visits, WhatsApp mode |

**For patients** (log in with their phone number, `/me`): their next sessions, the package counter
(e.g. 4 of 6 done), anything due with a Pay button, and the days and times that suit them.

### How the week gets planned

The planner takes the physio's free slots and each active patient's preferred times, and books
each patient's session length (45 or 60 minutes, set per patient) where both overlap, on a 15-minute grid:

- up to the patient's *visits per week*, counting visits already booked that week;
- on different days, spread out (two a week lands about three days apart);
- with the travel time (default 30 minutes) kept free before and after every home visit;
- patients with the fewest possible times are placed first, so flexible patients don't crowd them out.

Suggestions are shown in amber and aren't booked until approved. Anyone who couldn't be fitted is
listed, with the reason if they have no preferred times.

### Packages, the visit counter and payments

- The physio adds a package on the patient's page: number of visits and price. Clinic and home visits
  both count towards it; each home visit adds the home-visit fee from Settings.
- Marking a visit **Done** moves the counter forward (visit 3 of 6…). Cancelled visits and no-shows
  never use a visit.
- When the last visit of a package is marked done, the app makes the next package (same size and
  price) and a **payment request** for its price plus the home-visit fees from the package just
  finished. The WhatsApp message links to a payment page with a **UPI QR code** and a *Pay with a UPI
  app* button, for the UPI ID in Settings.
- UPI payments go straight to the physio's bank, so the app can't see them: the physio checks the
  bank app and taps **Mark paid**.
- **Undo done** reverses a mistaken completion (latest visit of a package only) and withdraws the
  payment request it caused, if still unpaid.

### WhatsApp

Messages: a **reminder the day before** each visit (ready from 10 am the day before), a **weekly
schedule** (Sunday 6 pm, for the coming week), **payment requests**, and **login links**.

- **One-tap mode (default, no setup).** Messages wait under Messages (and on Today). Tapping **Send on
  WhatsApp** opens WhatsApp on the physio's phone with the message typed in; they press send.
  Messages stay current: a reminder for a visit that moved or was cancelled is dropped.
- **Automatic mode** (later). Needs a WhatsApp Business number on Meta's WhatsApp Cloud API. See
  *Switching on automatic WhatsApp* below.

## Phones and tablets

The app works in Safari on iPhone and iPad and in Chrome on Android, as well as on any computer, and can
be installed to the home screen like an app (`src/app/manifest.ts`, icons in `public/icons`):

- **Android:** patients see an **Install** button on their page (or Chrome menu → *Add to Home screen*).
- **iPhone:** patients see a note to tap **Share → Add to Home Screen**.

Installed, it opens full-screen with its own icon and a bottom tab bar on phones. `public/sw.js`
shows an offline page when there's no signal; it never stores pages, so no patient data is kept on
the phone.

## Photos

Photos live in `public/images` with these names:

| File | Where it shows |
| --- | --- |
| `hero.jpg` | Home page header, patient page banner |
| `clinic.jpg` | Home page, clinic card |
| `home-visit.jpg` | Home page, home-visit card |
| `rehab.jpg` | Home page, the band near the bottom |
| `login.jpg` | Login page (beside the form on wide screens) |

Use landscape photos about 1600–2000 px wide, saved as JPEG at around 200–400 KB. Every photo sits on
the blue-and-teal gradient, so a missing file still looks deliberate. Only use photos you have the
rights to: your own, or free-licence ones (Unsplash's free photos, not Unsplash+, or Pexels).

The current photos are free to use under the [Pexels licence](https://www.pexels.com/license/):
`hero.jpg` [5793972](https://www.pexels.com/photo/5793972/), `clinic.jpg` [5793954](https://www.pexels.com/photo/5793954/),
`rehab.jpg` [5794038](https://www.pexels.com/photo/5794038/), `login.jpg` [5794014](https://www.pexels.com/photo/5794014/)
(by Yan Krukau) and `home-visit.jpg` [7551627](https://www.pexels.com/photo/7551627/) (by Kampus Production).

## Setup

1. **Supabase.** Create a free project at supabase.com. In the SQL editor, run
   `supabase/migrations/0001_schema.sql`.
   - Authentication → Users → **Add user**: the physio's email and a password, with *Auto confirm* on.
   - Authentication → URL Configuration: set the Site URL to the app's address and add
     `https://<app-address>/**` to the redirect URLs.
   - Authentication → Providers → Email: set the email OTP / link expiry to **86400** (24 hours) so
     WhatsApp login links last a day.
2. **Cloudflare.** Create a free account, open Workers & Pages once, create an API token from the
   **Edit Cloudflare Workers** template and note the Account ID.
3. **GitHub secrets** (repository → Settings → Secrets and variables → Actions):
   `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` (e.g. `https://physio-scheduler.<you>.workers.dev`)
   and `CRON_SECRET` (any long random string).
4. **Worker secrets** (Cloudflare → Workers & Pages → physio-scheduler → Settings → Variables and
   Secrets, as **Secret**): `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAILS` (the physio's email) and the same
   `CRON_SECRET`. The Worker appears after the first deploy.
5. Push to `main`: GitHub builds and deploys. The *WhatsApp reminders* workflow then runs hourly.
6. Log in as the physio. Fill in **Settings** (the UPI account name especially) and **Hours**, then add patients.

### Patient login

Every patient added gets a login account tied to their phone number.

- **Login links (works now).** On the patient's page, **Prepare login link for WhatsApp** queues a
  one-time link; send it from Messages. One tap logs the patient in, and they stay logged in on that phone.
- **Text-message codes.** Patients can type their number and receive a 6-digit code once Supabase has
  an SMS provider (Authentication → Providers → Phone: Twilio, MessageBird, Vonage or Textlocal).
  Indian SMS needs DLT registration of the sender and message. Codes only go to numbers on the
  patient list.

### Switching on automatic WhatsApp

1. Get a phone number that isn't on regular WhatsApp, and set up the WhatsApp Cloud API in Meta's
   developer console (needs a Meta Business account; verification takes a few days).
2. Create and get approval for these **Utility** templates, in English (`en`), with exactly these variables:

   | Template name | Body variables |
   | --- | --- |
   | `visit_reminder` | `{{1}}` first name, `{{2}}` day and time, `{{3}}` place |
   | `weekly_schedule` | `{{1}}` first name, `{{2}}` week starting, `{{3}}` the visits, separated by " \| " |
   | `payment_request` | `{{1}}` first name, `{{2}}` amount, `{{3}}` payment link |
   | `login_link` | `{{1}}` first name, `{{2}}` login link |

3. Add Worker secrets `WHATSAPP_TOKEN` (a permanent system-user token) and `WHATSAPP_PHONE_NUMBER_ID`
   (and `WHATSAPP_TEMPLATE_LANGUAGE` if not `en`), then choose **Automatic** in Settings.
   Messages are then sent by the hourly job; a failed one shows under Messages with the reason and a
   one-tap fallback.

## Development

```bash
npm install
cp .env.example .env.local   # fill in the Supabase keys
npm run dev                  # http://localhost:3000
npm test                     # planner tests
npm run lint
npm run preview              # Cloudflare build served by Wrangler
```

All times are India time (Asia/Kolkata). Row-level security is on for every table with no policies:
browsers can't read the database directly; the server checks who's asking and uses the service role key.
