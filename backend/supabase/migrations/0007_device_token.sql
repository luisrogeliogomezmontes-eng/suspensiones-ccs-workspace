-- 0007_device_token.sql — I3.2: token propio del device para consumir comandos
--
-- Le da al ESP32 su propio token para leer/confirmar SUS comandos, sin abrir el
-- acceso anón amplio. ADITIVO: no toca nada existente → riesgo cero.
--
-- Modelo del token: el device manda su anon key (gateway) + un header
--   x-device-token: <secreto>
-- Una función SECURITY DEFINER valida ese header contra device_tokens.
--
-- El cierre de la lectura anon (BOLA de lectura) va en 0008, aparte y verificable.

begin;

-- ── Tokens por dispositivo (secreto; solo lo leen funciones security definer) ──
create table if not exists public.device_tokens (
  device_id  uuid not null references public.devices(id) on delete cascade,
  token      text not null unique,
  created_at timestamptz not null default now()
);
alter table public.device_tokens enable row level security;
-- Sin policies → ni anon ni authenticated lo leen directo. Solo funciones definer.

comment on table public.device_tokens is 'Secreto por device para ingesta/consumo de comandos. No exponer.';

-- ── Validación del header x-device-token ─────────────────────────────────────
create or replace function public.device_token_ok()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.device_tokens t
    where t.token = nullif(
      current_setting('request.headers', true)::json ->> 'x-device-token', ''
    )
  );
$$;

-- device_id asociado al token del header (para acotar el acceso a su propia fila)
create or replace function public.device_id_from_token()
returns uuid language sql stable security definer set search_path = public as $$
  select t.device_id from public.device_tokens t
  where t.token = nullif(current_setting('request.headers', true)::json ->> 'x-device-token', '')
  limit 1;
$$;

-- ── El device (anon + token) lee y confirma SUS comandos ─────────────────────
do $$ begin
  create policy "device_select_commands" on public.commands
    for select to anon
    using (public.device_token_ok() and device_id = public.device_id_from_token());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "device_ack_commands" on public.commands
    for update to anon
    using (public.device_token_ok() and device_id = public.device_id_from_token())
    with check (public.device_token_ok() and device_id = public.device_id_from_token());
exception when duplicate_object then null; end $$;

commit;

-- Nota: cerrar la LECTURA anon (BOLA de lectura) se hace en 0008, como paso
-- deliberado y verificable (correr después de confirmar que el dashboard
-- logueado sigue mostrando datos).

-- ─────────────────────────────────────────────────────────────────────────────
-- DESPUÉS de correr esta migración, insertá el token del device (NO se commitea
-- en el repo). Corré esto en el SQL editor con el token que te paso por chat:
--
--   insert into public.device_tokens (device_id, token)
--   values ('00000000-0000-0000-0000-000000000001', '<DEVICE_TOKEN>');
-- ─────────────────────────────────────────────────────────────────────────────
