-- 0006_admin_manage_roles.sql — I3: el admin gestiona roles desde la interfaz
--
-- Complementa 0005 (que ya deja al admin LEER todos los perfiles). Aquí le
-- permitimos ACTUALIZAR el rol de cualquier usuario. Creación de usuarios sigue
-- siendo por auto-registro (/login → rol viewer) o Edge Function (service_role).

begin;

do $$ begin
  create policy "admin_update_profiles" on public.profiles
    for update to authenticated
    using (public.is_admin())
    with check (public.is_admin());
exception when duplicate_object then null; end $$;

commit;
