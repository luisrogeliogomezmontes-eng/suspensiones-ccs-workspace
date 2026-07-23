# Plan OTA — Actualización remota de firmware (R2 / Fase 4)

> **Estado (2026-07-23):** cliente firmware **construido y compila** (71 %); backend
> **listo** (enum `ota` + bucket privado `firmware`); **NO validado en hardware**;
> sin UI de publicación en el dashboard (se publica por script/CLI). Arranque hecho
> para que **las próximas unidades salgan actualizables en remoto**.

## Por qué
Centinela 01 y 02 quedaron en campo **sin poder actualizarles el código** (no traen
cliente OTA, y meterlo requiere un flasheo físico que ya no es posible). La lección:
**ninguna unidad debe salir de fábrica sin OTA.** Esto lo resuelve para la 03+.

## Arquitectura — OTA disparado por comando
Reusa el canal de comandos que ya existe y funciona (autenticado con `x-device-token`,
poleado cada 5 s). No inventa transporte nuevo.

```
operador → sube firmware-vX.bin a Storage (bucket privado 'firmware')
         → genera URL firmada (temporal)
         → inserta comando { type:'ota', payload:{ url, md5?, version? } }
device   → poll de commands → ve 'ota' → ack → descarga el .bin por HTTPS
         → escribe la partición OTA inactiva (Update.h) → valida (MD5) → reinicia
         → arranca en la imagen nueva
```

### Firmware (`firmware/ota.{h,cpp}` + `net.cpp`)
- `otaApplyFromUrl(url, md5)`: descarga con `WiFiClientSecure`+`HTTPClient`, escribe con
  `Update.writeStream`, valida y `ESP.restart()`. Corre en la tarea de red (core 0).
- **Particiones**: el esquema `default` del FQBN `esp32:esp32:esp32` ya trae **app0/app1**
  (1.31 MB c/u) → soporta OTA sin tocar nada. El sketch ocupa ~0.93 MB (cabe).
- **Todas las unidades polean** ahora (antes las `GPS_ONLY` no): `fan_mode`/`setpoint`
  solo aplican donde hay fan; `ota`/`reboot` en cualquiera → **toda la flota actualizable**.
- **Fail-safe**: descarga interrumpida o MD5 que no cuadra → `Update.end()` NO cambia la
  partición de arranque → la unidad **sigue viva en la imagen vieja**.

### Backend
- Migración `0011_ota_command.sql`: agrega `'ota'` al enum `command_type`.
- Bucket **privado** `firmware` (2 MB máx). Descarga por **URL firmada** (el device no se
  autentica: la URL firmada ES la credencial, temporal).
- `FW_VERSION` en `config.h` (se imprime al bootear) → saber qué imagen corre cada unidad.

## Flujo de publicación (manual, MVP)
```bash
# 1. Compilar la unidad destino (identidad baked, ver ⚠️ abajo)
arduino-cli compile firmware --output-dir /tmp/fw
MD5=$(md5 -q /tmp/fw/firmware.ino.bin)          # macOS; en linux: md5sum

# 2. Subir a Storage (service_role) y firmar URL (ej. 1 h)
#    (via API de Storage: POST /storage/v1/object/firmware/<archivo> …
#     y POST /storage/v1/object/sign/firmware/<archivo> {"expiresIn":3600})

# 3. Insertar el comando ota con la URL firmada + md5
#    insert into commands(device_id,type,payload)
#      values('<uuid>','ota', jsonb_build_object('url','<signed>','md5','<md5>','version','pX'));
```
→ Convertir esto en `scripts/publish-ota.sh` cuando se valide en hardware.

## ⚠️ Landmines (leer antes de usar)
1. **Binarios POR-UNIDAD, no uno para la flota (todavía).** `secrets.h` (WiFi, anon key,
   **`DEVICE_TOKEN` y `DEVICE_ID` por-unidad**) se **hornea en el `.bin`**. OTA de un `.bin`
   compartido **sobrescribiría la identidad** de la unidad destino con la de otra. → Por
   ahora: **compilar por unidad** (con su `secrets.h`) y OTA **a esa unidad**. La solución
   real es mover la identidad a **NVS** (provisioning), tarea de la **línea de producción**
   → ahí sí un solo `.bin` sirve para toda la flota + OTA a todas. Ver [[production-line]].
2. **Sin rollback automático ante crash.** Si la imagen nueva bootea pero crashea, el
   bootloader NO revierte solo (feature de IDF no habilitado en el core Arduino default).
   → **Validar cada build en una unidad física** antes de publicarlo a una desplegada.
   Mitigado en parte: una descarga corrupta/incompleta NO cambia de partición.
3. **`setInsecure()`** (no valida el certificado TLS) — igual que la telemetría. TODO: root CA.
4. **01/02 no reciben OTA** (no traen cliente). Solo unidades flasheadas con este firmware
   en adelante. 01/02 quedan en control-por-parámetros (setpoint/fan_mode/reboot).

## Qué falta para cerrarlo
- [ ] **Validar en hardware** (próxima unidad física): publicar un build, verificar
      descarga+flasheo+boot en la imagen nueva y el fail-safe ante descarga cortada.
- [ ] `scripts/publish-ota.sh` (build → upload → sign → comando) end-to-end.
- [ ] **Identidad en NVS** (con la línea de producción) → un binario para la flota.
- [ ] Rollback de bootloader (partición con `app_rollback`) + root CA.
- [ ] UI de publicación en el dashboard (subir .bin + disparar) — opcional; hoy por script.
- [ ] Reportar `FW_VERSION` a `devices.fw_version` (hoy solo al serial) para ver la versión
      de cada unidad en el dashboard.
