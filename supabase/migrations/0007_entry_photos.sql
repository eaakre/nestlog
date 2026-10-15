-- Optional photo on every tracker entry (stored in the existing private bucket).
alter table sleep_sessions add column if not exists photo_path text;
alter table feedings add column if not exists photo_path text;
alter table diapers add column if not exists photo_path text;
alter table pumping_sessions add column if not exists photo_path text;
