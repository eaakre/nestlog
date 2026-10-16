-- Diapers can have several textures and colors.
alter table diapers add column if not exists textures text[] not null default '{}';
alter table diapers add column if not exists colors text[] not null default '{}';

update diapers set textures = array[texture] where texture is not null and textures = '{}';
update diapers set colors = array[color] where color is not null and colors = '{}';

notify pgrst, 'reload schema';
