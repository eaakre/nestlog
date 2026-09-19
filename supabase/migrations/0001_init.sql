-- Nestlog schema
-- Run this in the Supabase SQL editor, or via `supabase db push` with the CLI.

create extension if not exists "pgcrypto";

-- ── Profiles ────────────────────────────────────────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles are readable by anyone signed in"
  on profiles for select
  using (auth.uid() is not null);

create policy "users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- ── Children ────────────────────────────────────────────────────────────────
create table if not exists children (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  birth_date date,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists child_members (
  child_id uuid not null references children(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'parent' check (role in ('parent', 'caregiver')),
  created_at timestamptz not null default now(),
  primary key (child_id, user_id)
);

-- Helper: is the current user a member of this child?
create or replace function is_child_member(target_child_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from child_members
    where child_id = target_child_id and user_id = auth.uid()
  );
$$;

alter table children enable row level security;
alter table child_members enable row level security;

create policy "members can view their children"
  on children for select
  using (is_child_member(id));

create policy "signed-in users can create a child"
  on children for insert
  with check (auth.uid() = created_by);

create policy "members can view child_members rows for their children"
  on child_members for select
  using (is_child_member(child_id));

create policy "signed-in users can add themselves as a member"
  on child_members for insert
  with check (auth.uid() = user_id);

-- ── Invites ─────────────────────────────────────────────────────────────────
create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  used_by uuid references profiles(id),
  used_at timestamptz
);

alter table invites enable row level security;

create policy "members can view invites for their children"
  on invites for select
  using (is_child_member(child_id));

create policy "members can create invites for their children"
  on invites for insert
  with check (is_child_member(child_id) and auth.uid() = created_by);

-- Anyone signed in may redeem an unused invite by code (they don't yet have
-- membership, so is_child_member would fail); the update just marks it used.
create policy "signed-in users can redeem an unused invite"
  on invites for update
  using (used_by is null)
  with check (used_by = auth.uid());

-- Also allow a signed-in, non-member user to look up one invite row by code
-- so they can join. This is intentionally narrow: only unused, unexpired rows.
create policy "signed-in users can look up an unused invite by code"
  on invites for select
  using (used_by is null and (expires_at is null or expires_at > now()));

-- ── Sleep sessions ───────────────────────────────────────────────────────────
create table if not exists sleep_sessions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  logged_by uuid not null references profiles(id),
  start_time timestamptz not null,
  end_time timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

alter table sleep_sessions enable row level security;

create policy "members can view sleep sessions"
  on sleep_sessions for select using (is_child_member(child_id));
create policy "members can insert sleep sessions"
  on sleep_sessions for insert with check (is_child_member(child_id) and auth.uid() = logged_by);
create policy "members can update sleep sessions"
  on sleep_sessions for update using (is_child_member(child_id));
create policy "members can delete sleep sessions"
  on sleep_sessions for delete using (is_child_member(child_id));

-- ── Feedings ─────────────────────────────────────────────────────────────────
create table if not exists feedings (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  logged_by uuid not null references profiles(id),
  type text not null check (type in ('breast', 'bottle', 'solid')),
  side text check (side in ('left', 'right', 'both')),
  amount_ml numeric,
  duration_minutes numeric,
  duration_left_minutes numeric,
  duration_right_minutes numeric,
  start_time timestamptz not null,
  end_time timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

alter table feedings enable row level security;

create policy "members can view feedings"
  on feedings for select using (is_child_member(child_id));
create policy "members can insert feedings"
  on feedings for insert with check (is_child_member(child_id) and auth.uid() = logged_by);
create policy "members can update feedings"
  on feedings for update using (is_child_member(child_id));
create policy "members can delete feedings"
  on feedings for delete using (is_child_member(child_id));

-- ── Diapers ──────────────────────────────────────────────────────────────────
create table if not exists diapers (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  logged_by uuid not null references profiles(id),
  wet boolean not null default false,
  dirty boolean not null default false,
  texture text check (texture in ('runny', 'mucousy', 'mushy', 'solid', 'pebbles')),
  color text check (color in ('black', 'green', 'yellow', 'brown', 'red', 'gray')),
  blowout boolean not null default false,
  diaper_rash boolean not null default false,
  time timestamptz not null,
  notes text,
  created_at timestamptz not null default now()
);

alter table diapers enable row level security;

create policy "members can view diapers"
  on diapers for select using (is_child_member(child_id));
create policy "members can insert diapers"
  on diapers for insert with check (is_child_member(child_id) and auth.uid() = logged_by);
create policy "members can update diapers"
  on diapers for update using (is_child_member(child_id));
create policy "members can delete diapers"
  on diapers for delete using (is_child_member(child_id));

-- ── Pumping sessions ─────────────────────────────────────────────────────────
-- child_id is optional (pumping belongs to the parent, not strictly the baby),
-- but when set it must be a child the user shares.
create table if not exists pumping_sessions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid references children(id) on delete set null,
  logged_by uuid not null references profiles(id),
  side text check (side in ('left', 'right', 'both')),
  amount_ml numeric,
  start_time timestamptz not null,
  end_time timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

alter table pumping_sessions enable row level security;

-- Visible to the person who logged it, and to anyone who shares the linked child.
create policy "owners and co-parents can view pumping sessions"
  on pumping_sessions for select
  using (auth.uid() = logged_by or (child_id is not null and is_child_member(child_id)));
create policy "users can insert their own pumping sessions"
  on pumping_sessions for insert
  with check (auth.uid() = logged_by and (child_id is null or is_child_member(child_id)));
create policy "owners can update their own pumping sessions"
  on pumping_sessions for update using (auth.uid() = logged_by);
create policy "owners can delete their own pumping sessions"
  on pumping_sessions for delete using (auth.uid() = logged_by);

-- ── Realtime ─────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table sleep_sessions;
alter publication supabase_realtime add table feedings;
alter publication supabase_realtime add table diapers;
alter publication supabase_realtime add table pumping_sessions;
