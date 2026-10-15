-- The creator of a child can always read it. Without this, inserting a child
-- and reading it back in one request fails row-level security, because the
-- creator isn't in child_members until the next statement.
create policy "creators can view children they created"
  on children for select
  using (auth.uid() = created_by);
