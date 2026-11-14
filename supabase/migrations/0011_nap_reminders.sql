-- Nap-window push reminders: per-user toggle, how many minutes before the
-- window opens to notify, and the user's timezone (the reminder job runs in UTC
-- and needs it to tell naps from bedtime).
alter table notification_prefs
  add column if not exists nap_reminders boolean not null default true,
  add column if not exists nap_lead_minutes integer not null default 10 check (nap_lead_minutes between 0 and 60),
  add column if not exists timezone text not null default 'America/Chicago';
