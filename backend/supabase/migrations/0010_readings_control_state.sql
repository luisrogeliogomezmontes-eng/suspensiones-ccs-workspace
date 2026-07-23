-- 0010_readings_control_state.sql — Read-back del estado de control del device
--
-- Antes, /control editaba a CIEGAS: sembraba enciende/apaga hardcodeados porque
-- el device jamás reportaba sus umbrales reales. El firmware SÍ los conoce
-- (netTempOn/Off, persistidos en NVS) y el modo del fan (auto/on/off) → ahora los
-- incluye en cada telemetría para que el panel muestre el estado REAL.
--
-- Columnas nullable: las unidades con firmware viejo (p.ej. Centinela 01, en
-- campo y sin OTA) simplemente las omiten en su INSERT → nulo, cero ruptura. El
-- dashboard cae al último `setpoint` con ack para esas unidades.
--
-- ⚠️ APLICAR ANTES de flashear firmware que postee estos campos: si el POST manda
-- una columna inexistente, Supabase rechaza el INSERT y se corta la telemetría.

begin;

alter table public.readings
  add column if not exists temp_on  real,   -- setpoint efectivo: enciende a (°C aire)
  add column if not exists temp_off real,   -- setpoint efectivo: apaga a (°C aire)
  add column if not exists fan_mode text     -- modo del fan: 'auto' | 'on' | 'off'
    check (fan_mode is null or fan_mode in ('auto', 'on', 'off'));

comment on column public.readings.temp_on  is 'Umbral efectivo del fan (enciende), read-back del device. Null en fw viejo.';
comment on column public.readings.temp_off is 'Umbral efectivo del fan (apaga), read-back del device. Null en fw viejo.';
comment on column public.readings.fan_mode is 'Modo del fan reportado por el device: auto/on/off. Null en fw viejo.';

commit;
