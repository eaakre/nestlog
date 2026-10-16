-- Either parent sharing the child can edit or delete a pumping session (not just the person who logged it).
drop policy if exists "owners can update their own pumping sessions" on pumping_sessions;
drop policy if exists "owners can delete their own pumping sessions" on pumping_sessions;

create policy "owners and co-parents can update pumping sessions"
  on pumping_sessions for update
  using (auth.uid() = logged_by or (child_id is not null and is_child_member(child_id)))
  with check (auth.uid() = logged_by or (child_id is not null and is_child_member(child_id)));

create policy "owners and co-parents can delete pumping sessions"
  on pumping_sessions for delete
  using (auth.uid() = logged_by or (child_id is not null and is_child_member(child_id)));
