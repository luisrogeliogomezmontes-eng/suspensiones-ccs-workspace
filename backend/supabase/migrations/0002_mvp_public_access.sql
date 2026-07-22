-- 0002_mvp_public_access.sql — Acceso MVP sin Auth (I1) + escritura del device
--
-- ⚠️ TRADEOFF DE SEGURIDAD (temporal, MVP):
-- El dashboard I1 aún NO tiene login (Auth llega en I3). Lee con la publishable
-- key = rol `anon`. Y el ESP32 escribe con esa misma key. Por eso aquí abrimos:
--   * anon SELECT en devices/readings/events (lectura pública)
--   * anon INSERT en readings (ingesta de telemetría del device)
-- Cualquiera con la publishable key (que viaja al navegador) puede leer/insertar.
-- ENDURECER en I3: Supabase Auth + RLS por dueño/dispositivo + token propio por
-- device (JWT firmado o Edge Function que valide un secreto de dispositivo).

begin;

-- Lectura pública (MVP)
do $$ begin
  create policy "anon_read_devices"  on public.devices  for select to anon using (true);
  create policy "anon_read_readings" on public.readings for select to anon using (true);
  create policy "anon_read_events"   on public.events   for select to anon using (true);
exception when duplicate_object then null; end $$;

-- Ingesta de telemetría del device (solo INSERT; el FK valida device_id)
do $$ begin
  create policy "anon_insert_readings" on public.readings for insert to anon with check (true);
exception when duplicate_object then null; end $$;

-- ── Datos DEMO: 60 lecturas en los últimos 30 min para ver el Overview en vivo.
-- Bórralas cuando entre telemetría real:  delete from public.readings where uptime_s = 0;
insert into public.readings
  (device_id, ts, temp_c, fan_on, fan_duty, lat, lng, speed_kmph, course, sats, hdop,
   rssi, uptime_s, heap_free, batt_soc, power_w)
select
  '00000000-0000-0000-0000-000000000001',
  now() - (i * interval '30 seconds'),
  round((48 + 8 * sin(i / 6.0) + (random() - 0.5))::numeric, 1),               -- temp_c
  (48 + 8 * sin(i / 6.0)) > 55,                                                 -- fan_on
  greatest(0, round((((48 + 8 * sin(i / 6.0)) - 48) / 12 * 100))::int),        -- fan_duty
  round((10.4959 + sin(i / 8.0) * 0.004)::numeric, 6),                          -- lat (Altamira)
  round((-66.8536 + cos(i / 8.0) * 0.004)::numeric, 6),                         -- lng
  round((greatest(0, 20 + 15 * sin(i / 4.0)))::numeric, 1),                     -- speed_kmph
  round((mod(i * 37, 360))::numeric, 0),                                        -- course
  8 + (i % 4),                                                                  -- sats
  round((1.0 + random() * 0.6)::numeric, 1),                                    -- hdop
  -58 - (i % 12),                                                               -- rssi
  0,                                                                            -- uptime_s (marca de fila demo)
  200000,                                                                       -- heap_free
  greatest(40, 84 - i / 3)::int,                                                -- batt_soc
  round((54 + random() * 6)::numeric, 0)                                        -- power_w
from generate_series(0, 59) as i;

commit;
