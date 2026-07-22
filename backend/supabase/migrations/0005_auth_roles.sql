-- 0005_auth_roles.sql — I3.1: Auth + roles (viewer/operator/admin)
--
-- Modelo elegido: "todo tras login + roles". Esta migración es ADITIVA — no toca
-- las policies anon existentes (0002), para no romper la telemetría del ESP32 ni
-- el dashboard en producción durante la transición. El cierre del acceso anon
-- (lectura tras login) + token por device va en 0006/I3.2.
--
-- Roles:
--   viewer   → puede LEER (cuando se cierre anon, será el acceso base con login)
--   operator → viewer + enviar COMANDOS (control del fan/setpoint) y editar umbrales
--   admin    → operator + gestión (roles de otros, etc.)

begin;

-- ── Rol de aplicación ────────────────────────────────────────────────────────
do $$ begin
  create type app_role as enum ('viewer', 'operator', 'admin');
exception when duplicate_object then null; end $$;

-- ── Perfil por usuario (1:1 con auth.users) ──────────────────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  role       app_role not null default 'viewer',
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

comment on table public.profiles is 'Perfil + rol de cada usuario autenticado.';

-- Crear el perfil automáticamente al registrarse un usuario.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Helpers de rol (security definer → leen profiles sin recursión de RLS) ────
create or replace function public.is_operator()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('operator', 'admin')
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- ── Policies de profiles ─────────────────────────────────────────────────────
do $$ begin
  -- cada quien lee su propio perfil (para saber su rol en el dashboard)
  create policy "profiles_self_read" on public.profiles
    for select to authenticated using (id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  -- admin puede leer todos los perfiles (gestión de roles)
  create policy "profiles_admin_read" on public.profiles
    for select to authenticated using (public.is_admin());
exception when duplicate_object then null; end $$;

-- ── Control: solo operator+ puede emitir comandos ────────────────────────────
do $$ begin
  create policy "operator_insert_commands" on public.commands
    for insert to authenticated with check (public.is_operator());
exception when duplicate_object then null; end $$;

-- operator+ puede ajustar umbrales del device (edición desde el panel)
do $$ begin
  create policy "operator_update_devices" on public.devices
    for update to authenticated using (public.is_operator()) with check (public.is_operator());
exception when duplicate_object then null; end $$;

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- DESPUÉS de aplicar esta migración, crear tu usuario y hacerte admin:
--   1) Supabase → Authentication → Providers → habilitar Email (sin confirmación
--      para el MVP: Auth → Providers → Email → desactivar "Confirm email").
--   2) Registrarte desde el dashboard (/login) o Authentication → Users → Add user.
--   3) Hacerte admin (SQL editor):
--        update public.profiles set role = 'admin'
--        where email = 'luisrogeliogomezmontes@gmail.com';
-- ─────────────────────────────────────────────────────────────────────────────
