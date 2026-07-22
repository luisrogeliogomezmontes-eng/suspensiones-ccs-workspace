-- seed.sql — datos mínimos para desarrollo local (supabase db reset)
insert into public.devices (id, name, fw_version, temp_warn, temp_serious, temp_crit)
values ('00000000-0000-0000-0000-000000000001', 'Centinela 01', 'p1-dev', 33, 40, 46)
on conflict (id) do nothing;
