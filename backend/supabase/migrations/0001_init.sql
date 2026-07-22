-- 0001_init.sql — Esquema inicial de telemetría (I0)
-- Proyecto 1 · Suspensiones Caracas · unidad móvil ESP32 (Starlink + EcoFlow)
--
-- Modelo alineado con docs/PLAN-INTERFAZ.md §7.
-- Convenciones:
--   * ts se SELLA en origen (ESP32 vía GPS/NTP), no en el ingest.
--   * Un dispositivo escribe con anon key + RLS estricta (o token propio); el
--     dashboard lee con el usuario autenticado. service_role solo en servidor.
--   * Todo cambio de DDL vive aquí, versionado. Nunca "a mano".

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- Extensiones
-- ─────────────────────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ─────────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  create type command_type as enum ('fan_mode', 'setpoint', 'hysteresis', 'power_cycle', 'reboot');
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_kind as enum (
    'over_temp', 'fast_heating', 'offline', 'gps_lost',
    'geofence', 'tamper', 'low_battery', 'link_obstruction'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type severity as enum ('info', 'warning', 'serious', 'critical');
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- devices — una fila por unidad (soporta flota desde el día 1)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.devices (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  fw_version  text,
  -- umbrales térmicos por dispositivo (calibrables); °C
  temp_warn   real not null default 50,
  temp_serious real not null default 60,
  temp_crit   real not null default 70,
  last_seen   timestamptz,
  created_at  timestamptz not null default now()
);

comment on table public.devices is 'Unidad de conectividad móvil (maleta ESP32).';

-- ─────────────────────────────────────────────────────────────────────────────
-- readings — serie temporal de telemetría
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.readings (
  id           bigint generated always as identity,
  device_id    uuid not null references public.devices(id) on delete cascade,
  ts           timestamptz not null,               -- sellado en origen

  -- Térmico
  temp_c       real,                               -- punto principal
  temp_points  jsonb,                              -- multi-punto (integración A): {"intake":31.2,"starlink":48.9,...}

  -- Ventilación
  fan_on       boolean,
  fan_duty     smallint check (fan_duty between 0 and 100),
  fan_rpm      integer,

  -- GPS
  lat          double precision,
  lng          double precision,
  alt          real,
  speed_kmph   real,
  course       real,
  sats         smallint,
  hdop         real,

  -- Salud del ESP32
  rssi         smallint,
  uptime_s     bigint,
  heap_free    integer,

  -- Integraciones opcionales (E/F/D) — nulos hasta que existan
  batt_soc         smallint check (batt_soc between 0 and 100),
  power_w          real,
  link_obstruction real,
  link_down_mbps   real,

  primary key (device_id, ts, id)
);

comment on table public.readings is 'Telemetría cruda; ts sellado por el ESP32 (GPS/NTP).';

-- Índice principal de consulta (dispositivo + ventana de tiempo descendente)
create index if not exists readings_device_ts_idx
  on public.readings (device_id, ts desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- commands — downlink de control (dashboard → ESP32 por polling/MQTT)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.commands (
  id         uuid primary key default gen_random_uuid(),
  device_id  uuid not null references public.devices(id) on delete cascade,
  ts         timestamptz not null default now(),
  type       command_type not null,
  payload    jsonb not null default '{}'::jsonb,   -- ej. {"mode":"auto"} · {"value":55}
  issued_by  uuid,                                 -- auth.uid() del operador
  ack_ts     timestamptz                           -- el firmware confirma
);

create index if not exists commands_device_pending_idx
  on public.commands (device_id, ts desc)
  where ack_ts is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- events — bitácora de alertas
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.events (
  id         bigint generated always as identity primary key,
  device_id  uuid not null references public.devices(id) on delete cascade,
  ts         timestamptz not null default now(),
  kind       event_kind not null,
  severity   severity not null default 'warning',
  message    text,
  ack_by     uuid,
  ack_ts     timestamptz
);

create index if not exists events_device_ts_idx
  on public.events (device_id, ts desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger: mantener devices.last_seen al insertar telemetría
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.touch_device_last_seen()
returns trigger language plpgsql as $$
begin
  update public.devices
     set last_seen = greatest(coalesce(last_seen, 'epoch'::timestamptz), new.ts)
   where id = new.device_id;
  return new;
end $$;

drop trigger if exists trg_touch_last_seen on public.readings;
create trigger trg_touch_last_seen
  after insert on public.readings
  for each row execute function public.touch_device_last_seen();

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime: el dashboard se suscribe por WebSocket
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  alter publication supabase_realtime add table public.readings;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.events;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.commands;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — se activa aquí; las políticas concretas (viewer/operator, token de
-- dispositivo) llegan en la migración de Auth (fase I3). De momento: RLS ON y
-- lectura para usuarios autenticados. Escritura solo service_role (bypassa RLS).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.devices  enable row level security;
alter table public.readings enable row level security;
alter table public.commands enable row level security;
alter table public.events   enable row level security;

do $$ begin
  create policy "authenticated_read_devices"  on public.devices  for select to authenticated using (true);
  create policy "authenticated_read_readings" on public.readings for select to authenticated using (true);
  create policy "authenticated_read_commands" on public.commands for select to authenticated using (true);
  create policy "authenticated_read_events"   on public.events   for select to authenticated using (true);
exception when duplicate_object then null; end $$;

commit;
