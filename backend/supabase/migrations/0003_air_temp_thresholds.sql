-- 0003_air_temp_thresholds.sql — Recalibrar umbrales a T° de AIRE interior
--
-- El DHT22 mide el AIRE dentro de la maleta, no la superficie del equipo
-- (Starlink/EcoFlow). El aire es el indicador adelantado de calor atrapado.
-- La escala vieja (50/60/70) era para superficie: con aire nunca se coloreaba
-- (la prueba con yesquero llegó ~50°C y ni tocó rojo). Escala nueva sobre aire:
--   OK <33 · Advertencia 33–40 · Serio 40–46 · Crítico >46  (°C)
--
-- ⚠️ Ajustable por device: si una unidad va en un ambiente distinto, cambiá su
-- fila. Estos son los defaults del proyecto.

begin;

-- Filas existentes (LIVE): baja los umbrales de todas las unidades.
update public.devices
set temp_warn = 33, temp_serious = 40, temp_crit = 46;

-- Defaults de columna para futuras unidades.
alter table public.devices alter column temp_warn    set default 33;
alter table public.devices alter column temp_serious set default 40;
alter table public.devices alter column temp_crit    set default 46;

commit;
