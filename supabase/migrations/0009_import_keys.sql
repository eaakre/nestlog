-- Lets the Nara import be re-run safely: each imported row carries its Nara id.
alter table sleep_sessions add column if not exists import_key text unique;
alter table feedings add column if not exists import_key text unique;
alter table diapers add column if not exists import_key text unique;
alter table pumping_sessions add column if not exists import_key text unique;
alter table milestones add column if not exists import_key text unique;
alter table growth_measurements add column if not exists import_key text unique;

notify pgrst, 'reload schema';
