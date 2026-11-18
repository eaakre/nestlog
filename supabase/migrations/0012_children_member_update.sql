-- Let either parent edit the child's details (birth date) from Settings.
-- Until now children rows could only be read and created, never changed.
create policy "members can update their children"
  on children for update
  using (is_child_member(id))
  with check (is_child_member(id));
