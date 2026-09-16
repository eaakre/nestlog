# Nestlog

A small, installable web app (PWA) for tracking a baby's sleep, feeding, and
diapers — plus pumping — shared between two parent accounts. Inspired by
Nara: fast, one-tap logging with a live shared timeline.

- Each parent has their **own account** (own email/password).
- One or more **children** can be created, and a **share code** lets your
  partner join the same child so you both see and log the same data.
- Data syncs across devices in **real time** via Supabase (Postgres + Auth +
  Realtime).
- Installable to your phone's home screen as a PWA — no app store needed.

## Tech stack

- [Vite](https://vitejs.dev/) + React + TypeScript
- Tailwind CSS
- [Supabase](https://supabase.com) — Postgres database, auth, and realtime
- `vite-plugin-pwa` for offline shell + installability

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project (the
   free tier is plenty to start).
2. In the SQL editor, paste and run the contents of
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
   This creates all tables and the row-level-security policies that let two
   accounts safely share one child's data (and keep pumping data private to
   whoever pumped, unless it's linked to a shared child).
3. In **Project Settings → API**, copy the **Project URL** and the
   **anon public key**.
4. In **Authentication → Providers**, email/password sign-up is enabled by
   default — that's all this app uses. You can turn off "Confirm email" in
   **Authentication → Settings** while testing, so accounts are usable
   immediately after sign-up.

## 2. Configure the app

```bash
cp .env.example .env
```

Fill in the two values from step 1:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

## 3. Run it

```bash
npm install
npm run dev
```

Open the printed local URL. Create an account, add your child, then open
**Settings → Invite partner** to get a 6-character code. Have your wife sign
up on her own device/account and enter that code during onboarding — you'll
both land on the same child's dashboard.

## 4. Install it as an app on your phone

Once deployed (see below) and opened in Safari (iOS) or Chrome (Android):

- **iOS**: Share → "Add to Home Screen"
- **Android**: Menu → "Install app"

It'll behave like a native app icon, no App Store needed.

## 5. Deploy

Any static host that supports environment variables works. The simplest is
[Vercel](https://vercel.com):

```bash
npm run build
```

Then deploy the project (via the Vercel dashboard or CLI), setting
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables
there too.

## Project structure

```
src/
  contexts/      Auth + active-child state, shared across the app
  components/    The four tracker cards (Sleep, Feeding, Diaper, Pumping)
                 and the live Timeline feed
  pages/         Login, Signup, Onboarding, Dashboard, Settings
  lib/           Supabase client, date formatting, small hooks
supabase/
  migrations/    SQL schema + RLS policies — the source of truth for the DB
```

## How sharing works

- `children` — one row per baby.
- `child_members` — join table; a row here is what grants a user access to a
  child's data. Both you and your wife get a row for the same `child_id`.
- `invites` — short-lived 6-character codes tied to a child. Redeeming one
  inserts the matching `child_members` row for whoever enters the code.
- Every log table (`sleep_sessions`, `feedings`, `diapers`) is scoped by
  `child_id`, and Postgres row-level security only lets a request through if
  the requester has a `child_members` row for that child — so you can't see
  or write another family's data.
- `pumping_sessions` are visible to whoever logged them, plus anyone sharing
  the linked child — so it's private by default but shareable if you want
  your partner to see supply.

## Extending it

Ideas that fit naturally into this structure: growth/weight logs, medication
reminders, a "who's up" push notification when your partner starts a
overnight feed, CSV export, or a simple stats view (sleep totals per day).
Each would be one more table + RLS policy pair, plus a small card/page.
