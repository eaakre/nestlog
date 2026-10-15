-- Growth measurements: weight (grams), height and head size (centimeters).
create table if not exists growth_measurements (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  logged_by uuid not null references profiles(id),
  kind text not null check (kind in ('weight', 'height', 'head')),
  value numeric not null check (value > 0), -- grams for weight, cm for height/head
  measured_on date not null,
  notes text,
  created_at timestamptz not null default now()
);

alter table growth_measurements enable row level security;

create policy "members can view growth measurements"
  on growth_measurements for select using (is_child_member(child_id));
create policy "members can insert growth measurements"
  on growth_measurements for insert with check (is_child_member(child_id) and auth.uid() = logged_by);
create policy "members can update growth measurements"
  on growth_measurements for update using (is_child_member(child_id));
create policy "members can delete growth measurements"
  on growth_measurements for delete using (is_child_member(child_id));

alter publication supabase_realtime add table growth_measurements;
