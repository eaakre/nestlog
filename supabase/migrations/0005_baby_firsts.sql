-- Baby Firsts (milestones), with optional photos stored in Supabase Storage.

create table if not exists milestones (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  logged_by uuid not null references profiles(id),
  title text not null,
  notes text,
  happened_on date not null,
  photo_path text,
  created_at timestamptz not null default now()
);

alter table milestones enable row level security;

create policy "members can view milestones"
  on milestones for select using (is_child_member(child_id));
create policy "members can insert milestones"
  on milestones for insert with check (is_child_member(child_id) and auth.uid() = logged_by);
create policy "members can update milestones"
  on milestones for update using (is_child_member(child_id));
create policy "members can delete milestones"
  on milestones for delete using (is_child_member(child_id));

alter publication supabase_realtime add table milestones;

-- Private photo bucket. Files live under "<child_id>/<file>", and access follows
-- child membership, so only parents sharing the child can see or change them.
insert into storage.buckets (id, name, public)
values ('milestone-photos', 'milestone-photos', false)
on conflict (id) do nothing;

create policy "members can view milestone photos"
  on storage.objects for select
  using (bucket_id = 'milestone-photos' and is_child_member(((storage.foldername(name))[1])::uuid));
create policy "members can upload milestone photos"
  on storage.objects for insert
  with check (bucket_id = 'milestone-photos' and is_child_member(((storage.foldername(name))[1])::uuid));
create policy "members can update milestone photos"
  on storage.objects for update
  using (bucket_id = 'milestone-photos' and is_child_member(((storage.foldername(name))[1])::uuid));
create policy "members can delete milestone photos"
  on storage.objects for delete
  using (bucket_id = 'milestone-photos' and is_child_member(((storage.foldername(name))[1])::uuid));
