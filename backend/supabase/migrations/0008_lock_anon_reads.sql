-- 0008_lock_anon_reads.sql — I3.2: cerrar la LECTURA anon (BOLA de lectura)
--
-- 0002 abría lectura PÚBLICA (anon) de devices/readings/events. Ahora el
-- dashboard exige login y lee autenticado (authenticated_read_* de 0001), así
-- que cerramos la lectura anón. El ESP32 no lee esas tablas (solo escribe
-- readings [anon_insert_readings, 0002] e interactúa con commands vía su token
-- [device_*_commands, 0007]), no le afecta.
--
-- Blindaje: esta migración RE-GARANTIZA las policies de lectura autenticada
-- ANTES de quitar la anón (do-block idempotente: si 0001 ya las creó, no hace
-- nada). Así el dashboard LOGUEADO nunca queda sin lectura, aunque 0001 se
-- hubiera aplicado parcial. Ya no hace falta "verificar primero".
--
-- La INSERCIÓN de readings sigue con anon (telemetría). Gatearla por token del
-- device es el último apriete, en 0009.

begin;

-- ── 1) Garantizar lectura para usuarios autenticados (idempotente) ───────────
do $$ begin
  create policy "authenticated_read_devices"  on public.devices  for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated_read_readings" on public.readings for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated_read_events"   on public.events   for select to authenticated using (true);
exception when duplicate_object then null; end $$;

-- ── 2) Cerrar la lectura PÚBLICA anón (la abrió 0002) ────────────────────────
drop policy if exists "anon_read_devices"  on public.devices;
drop policy if exists "anon_read_readings" on public.readings;
drop policy if exists "anon_read_events"   on public.events;

commit;
