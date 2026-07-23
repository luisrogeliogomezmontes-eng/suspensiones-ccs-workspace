-- 0011_ota_command.sql — Tipo de comando `ota` (actualización remota de firmware)
--
-- Habilita el OTA disparado por comando (R2/Fase 4): se sube el .bin a Supabase
-- Storage y se inserta un comando `ota` con la URL; el device (con firmware que
-- trae el cliente OTA) lo baja, flashea la partición inactiva y reinicia.
--
-- Payload esperado: {"url":"https://…/firmware-vX.bin", "md5":"<32 hex>"?, "version":"…"?}
--   - url : obligatoria (HTTPS al binario).
--   - md5 : opcional; si viene, el device valida integridad antes de arrancar.
--   - version : opcional, informativa.
--
-- ⚠️ Las unidades ya desplegadas SIN cliente OTA (Centinela 01/02) NO pueden
-- recibir esto: engancha solo en unidades flasheadas con firmware que incluya
-- ota.{h,cpp}. Ver docs/plan-ota.md.
--
-- Nota: ALTER TYPE ... ADD VALUE no corre dentro de una transacción con uso en la
-- misma tx → se ejecuta suelto (sin begin/commit). Idempotente con IF NOT EXISTS.

alter type public.command_type add value if not exists 'ota';
