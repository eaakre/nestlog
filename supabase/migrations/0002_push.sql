-- Push notifications: device subscriptions, per-user preferences, and a
-- de-dupe log so a reminder is only sent once.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table push_subscriptions enable row level security;
create policy "users manage their own push subscriptions"
  on push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists notification_prefs (
  user_id uuid primary key references profiles(id) on delete cascade,
  partner_alerts boolean not null default true,
  timer_reminders boolean not null default true,
  timer_minutes integer not null default 60 check (timer_minutes between 5 and 720),
  feed_reminders boolean not null default false,
  feed_hours numeric not null default 3 check (feed_hours between 0.5 and 12),
  updated_at timestamptz not null default now()
);
alter table notification_prefs enable row level security;
create policy "users manage their own notification prefs"
  on notification_prefs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Only the Edge Functions (service role) touch this; no policies on purpose.
create table if not exists sent_reminders (
  key text primary key,
  sent_at timestamptz not null default now()
);
alter table sent_reminders enable row level security;
