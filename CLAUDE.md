# Nestlog

Personal (non-commercial) installable PWA baby tracker, modeled on the Nara app. Tracks sleep, feeding, diapers, and the mother's pumping. Two parents have separate accounts, share a child, and sync in real time.

## Stack
Vite + React 18 + TypeScript, Tailwind CSS 3, react-router-dom 6, date-fns, vite-plugin-pwa (injectManifest, custom `src/sw.ts`). Backend is Supabase: Auth (email/password), Postgres with row-level security, realtime `postgres_changes`, Edge Functions (Deno) for web push.

## Commands
- `npm install`, `npm run dev`, `npm run build` (runs `tsc -b && vite build`)
- Env: copy `.env.example` to `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`)
- DB: run `supabase/migrations/*.sql` in order in the Supabase SQL editor (0001 init, 0002 push, 0003 child-creator select policy, 0004 pumping per side, 0005 baby firsts + photo bucket)

## Architecture notes
- Access is via `child_members`; RLS uses `is_child_member(child_id)`. Pumping sessions are visible to the logger and to anyone sharing the linked child.
- `ChildContext` owns children, active child, members, create/invite/redeem. `loading` stays true until the list has loaded for the signed-in user (prevents a false redirect to /onboarding).
- Open timers are rows with `end_time` null (sleep, breastfeed, pumping), so "Save, keep going" works and syncs across devices.
- Volume is stored in ml; oz/ml conversion happens at the edges (`src/lib/units.tsx`).
- `useRecentRows(table, childId, timeField)` powers each card's history with realtime reload. Entries are editable/deletable via `src/components/editors/*` and `EditorShell`.
- Baby Firsts: `milestones` table + private `milestone-photos` storage bucket (files under `<child_id>/`, access via `is_child_member`). UI in `FirstsCard`, `pages/Firsts.tsx`, `editors/MilestoneEditor`; age math in `src/lib/age.ts`; photos resized client-side in `src/lib/photos.ts`.
- Push: `src/lib/push.ts` (subscribe), `src/lib/notify.ts` (client calls `notify-partner`), Edge Functions in `supabase/functions/` (`notify-partner`, `send-reminders` on a pg_cron schedule). See README section 6.
- Design: tokens in `tailwind.config.js` (night/parchment/dusk/sage/amber, `header.*` card colors). Fonts: Lora (headings), DM Sans (body). Use original code and colors, not Nara's assets.

## Not built yet
History and Trends tabs, Growth (weight/height/head), child avatar/date header, day-grouped history, Nara data import (needs a real export file), offline queue, password reset, data export, leave/remove child, tests.

## Conventions
- Small focused commits. `main` is the branch.
- A standalone mock-data demo (`nestlog-demo.html`, single file, localStorage) exists outside this repo; keep it in sync only if asked.
