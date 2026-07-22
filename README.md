# Suspensiones Caracas — Proyecto 1

Datalogger de **temperatura + control de ventilación + GPS** sobre **ESP32**, con
telemetría a Supabase y **dashboard web propio** (local y remoto). Unidad móvil de
monitoreo para una maleta de conectividad (Starlink + EcoFlow) en moto.

**Dashboard en producción:** https://suspensiones-esp32-telemetria.vercel.app
(Overview · Histórico · Mapa · Alertas · Control · Usuarios — login requerido, PWA instalable)

- Instrucciones de trabajo (rol, estándares, protocolos): [CLAUDE.md](CLAUDE.md)
- Estado vivo, arquitectura, decisiones y roadmap: [MEMORY.md](MEMORY.md)
- Bitácora de sesiones (qué se hizo y cuándo): [docs/BITACORA.md](docs/BITACORA.md)
- Plan de interfaz/telemetría: [docs/PLAN-INTERFAZ.md](docs/PLAN-INTERFAZ.md)
- Backlog de mejoras propuestas (OTA, alertas, etc.): [docs/RECOMENDACIONES.md](docs/RECOMENDACIONES.md)
- **Informes de hardware (esquemáticos, BOM, gastos)** — un solo punto de entrada: [docs/informes/index.html](docs/informes/index.html) (abrir en el navegador)
- Esquemáticos profesionales KiCad (ERC validado): [docs/kicad/](docs/kicad/)

## Estructura
```
.
├── CLAUDE.md            # Instrucciones de sistema + protocolos de inicio/cierre
├── MEMORY.md            # Contexto vivo (arquitectura, decisiones, roadmap, to-do)
├── firmware/            # Sketch arduino-cli (ESP32, C++) — loop no bloqueante
│   ├── firmware.ino     # entry: setup/loop + scheduler millis
│   ├── config.h         # pines, umbrales, periodos, flags (HAS_TEMP_SENSOR)
│   ├── gps.{h,cpp}      # GPS no bloqueante (TinyGPS++)
│   ├── temp.{h,cpp}     # DHT22 (temperatura/humedad)
│   ├── net.{h,cpp}      # WiFi + HTTPS→Supabase en tarea FreeRTOS + portal cautivo
│   ├── secrets.h.example# plantilla (secrets.h real es git-ignored)
│   └── sketch.yaml      # board + librerías (arduino-cli)
├── backend/supabase/    # Migraciones SQL versionadas + seed
│   ├── migrations/0001_init.sql          # esquema (devices/readings/commands/events)
│   ├── migrations/0002_mvp_public_access.sql  # acceso anon MVP + datos demo
│   ├── migrations/0003…0006              # umbrales T° aire, auth/roles, gestión de usuarios
│   ├── migrations/0007_device_token.sql       # token propio por device ✅ aplicada
│   ├── migrations/0008_lock_anon_reads.sql    # cierra lectura anon ✅ aplicada
│   ├── migrations/0009_api_keys.sql           # keys de la API pública v1 ✅ aplicada
│   ├── functions/api-v1/                      # API pública v1 (Hono/Deno) — desplegada
│   └── seed.sql
├── dashboard/           # Dashboard Next.js 16 + TS + Tailwind v4 + Supabase Realtime + Auth + PWA
│   └── src/app/{page,historico,mapa,alertas,control,usuarios,login}  # ver dashboard/README.md
├── skills/              # Skills de asistencia (ver CLAUDE.md §9)
├── hardware/            # fotos/ (fotos de módulos comprados) · datasheets/, schematics/ (placeholder Fase 5 PCB)
└── docs/
    ├── api/             # Contrato + OpenAPI + Scalar de la API pública v1 (equipo de computación)
    ├── informes/        # Esquemáticos HTML (núcleo, carga), BOM visual, gastos — index.html
    ├── kicad/           # Esquemáticos KiCad reales (fan-driver/, carga-relay/), ERC-clean
    ├── referencias/     # Documentos de referencia (investigación externa, p.ej. desarrollo de APIs)
    ├── PRESUPUESTO.csv  # BOM planificada con costos
    ├── PLAN-INTERFAZ.md
    └── BITACORA.md
```

## Estado actual (ver MEMORY.md para el detalle)
| Área | Estado |
|---|---|
| Firmware: GPS | ✅ real, con fix confirmado |
| Firmware: temperatura + fan | ✅ **validado en hardware** (2026-07-19): DHT22 lee 29.2°C + fan PWM proporcional (59% @ 29.2°C, D26); unidad en build **COMPLETA `GPS_ONLY=0`** (temp+fan+GPS activos). ⚠️ VCC del DHT22 desde GPIO32 (pin 3V3 del header dañado, D28) |
| Firmware: telemetría | ✅ **end-to-end viva** (self-healing, D22): WiFi + POST a Supabase (tarea FreeRTOS) + portal de config |
| Firmware: control remoto | ✅ consume `commands` por token propio (`x-device-token`), aplica y confirma ack (I3.2) — ⚠️ requiere correr `0007`/`0008` en Supabase |
| Backend Supabase | ✅ esquema aplicado + Auth/roles + token de device activo (`0001`–`0009` corridas) |
| Dashboard | ✅ **en producción**, Auth con roles, Overview + Histórico + Mapa + Alertas + Control + Usuarios + PWA + **multi-centinela** (selector de unidad + vista de Flota, I8/D35) (I0–I4, I8 hechas) |
| API pública v1 | ✅ **en producción** (`functions/v1/api-v1`), verificada end-to-end. Monitoreo + control seguro de la flota para terceros — ver `docs/api/` |
| Hardware: compra | ✅ comprado ($184.80, ver `docs/informes/E_informe-gastos.html`) |
| Hardware: subsistema de carga | ⚠️ diseño cerrado (control autónomo, ver MEMORY D25) — falta la prueba física del módulo |

## Quickstart

**Firmware** (requiere `arduino-cli` + core `esp32:esp32` + libs TinyGPSPlus/ArduinoJson/DHT):
```bash
arduino-cli compile firmware
# ⚠️ subir con baud 115200 (921600 da "invalid head of packet" con algunos cables)
arduino-cli upload -p /dev/cu.usbserial-XX --fqbn esp32:esp32:esp32:UploadSpeed=115200 firmware
arduino-cli monitor -p /dev/cu.usbserial-XX -c baudrate=115200
```
WiFi se configura desde el **portal del ESP32** (AP `SuspensionesP1-XXXX`, clave `config1234`) o hardcodeando en `firmware/secrets.h`.

**Dashboard:**
```bash
cd dashboard && npm install && npm run dev   # http://localhost:3000
```
Sin credenciales Supabase corre en modo demo. Ver [dashboard/README.md](dashboard/README.md).

## ⚠️ Repositorio
Repo **independiente**, aislado del repo personal `agentes-claude`. Es código de empresa.
Secretos (`secrets.h`, `.env.local`) están git-ignored — nunca se commitean.
