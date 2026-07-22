# RECOMENDACIONES — Mejoras propuestas (backlog técnico)

> Registro de mejoras **propuestas, no implementadas** (o parciales). Cada una con:
> qué resuelve, esfuerzo estimado y qué falta. El estado vivo está en [MEMORY.md](../MEMORY.md).
> Última revisión: 2026-07-20.

---

## R1 — Alerta de sobre-temperatura con fans saturados ⭐ (pedida por Luis)

**Idea:** si la temperatura llega al máximo (`TEMP_ON_C`, hoy 40 °C), **los fans ya están al tope** (70% duty) **y la temperatura SIGUE subiendo**, disparar una **alerta**: significa que la refrigeración no da abasto → posible problema térmico interno (Starlink/EcoFlow en riesgo).

**Por qué importa:** hoy el sistema sube el fan al tope y "se rinde" en silencio. Esa condición (saturado + subiendo) es justo el escenario peligroso que hay que avisar.

**Dónde va:** el dashboard ya deriva alertas del estado en vivo (`deriveAlerts()`, D27/I4). Es una **regla nueva** ahí, no firmware:
- Condición: `temp_c >= TEMP_ON_C` **Y** `fan_duty >= FAN_MAX_DUTY` **Y** `temp_c` con pendiente positiva sostenida (ej. subió ≥1 °C en las últimas N lecturas).
- Severidad: alta. Mensaje: "Refrigeración saturada — temperatura sigue subiendo a X °C con fans al 100%".
- Opcional: además escribir un `event` en la tabla (bitácora) y, a futuro, push/n8n → notificación al teléfono.

**Esfuerzo:** ~1-2 h (regla en `deriveAlerts` + banner). Push real requiere n8n/Web Push (Fase posterior).

**Estado:** ⬜ propuesta. Enganchar con I4 (alertas) y I5 (integraciones).

---

## R2 — OTA (Over-The-Air): cambiar CUALQUIER cosa del firmware en remoto ⭐⭐ (clave para la flota)

**Contexto:** Luis quiere **control remoto total** de cualquier Centinela, esté donde esté (con internet). Hoy el alcance remoto es limitado — ver la tabla:

| Capa | Qué permite cambiar en remoto | Estado |
|---|---|---|
| **Comandos** (`/control`, D27) | Solo lo predefinido: **umbrales** (`setpoint`), **modo del fan** (on/off/auto), **reboot**, power_cycle | ✅ Ya existe |
| **NVS** (esta sesión) | Que esos ajustes de `/control` **persistan** al reboot | ✅ Ya existe |
| **OTA** | **CUALQUIER cambio de código**: lógica nueva, arreglar bugs, agregar sensores/campos, cambiar la banda de control, nuevos comandos… | ⬜ **NO implementado** |

**Conclusión importante:** la NVS **NO** permite "cambiar cualquier cosa" — solo hace permanentes los ajustes que ya se podían mandar. Para cambiar **el comportamiento/código** sin cable hace falta **OTA**.

**Qué es OTA:** el ESP32 descarga un nuevo binario `.bin` por WiFi y **se re-flashea solo**. Opciones:
- **HTTP OTA con verificación de versión**: la unidad consulta periódicamente una URL (ej. Supabase Storage) por un firmware más nuevo; si hay, lo baja y aplica. Recomendado para flota (una URL, todas se actualizan).
- ArduinoOTA (push desde la misma LAN) — no sirve para unidades remotas.

**Requisitos / cuidados:**
- **Rollback seguro**: partición dual (OTA_0/OTA_1) + validación → si el nuevo firmware no arranca/reporta, volver al anterior. Crítico: un OTA fallido a una unidad en la calle = ladrillo inalcanzable.
- Firmar/verificar el binario (que nadie inyecte firmware).
- Hosting del `.bin` (Supabase Storage o el VPS) + un campo de "versión objetivo" por device.

**Esfuerzo:** medio — 1-2 sesiones (partición OTA, cliente HTTP OTA con versión, rollback, subida del .bin, prueba en 1 unidad antes de flota). Es de **Fase 4** del roadmap.

**Estado:** ⬜ propuesta fuerte. **Es la respuesta al "control remoto de cualquier cambio".** Hacer NVS primero (hecho) y OTA como siguiente gran paso de robustez de flota.

---

## R3 — Temperatura interna del ESP32 como métrica de salud (idea de Luis)

**Idea:** usar el **sensor de temperatura on-chip** del ESP32 (`temperatureRead()`) para (a) vigilar la salud térmica del propio MCU y (b) contrastar grueso con el DHT22.

**Realidad del sensor (⚠️ importante):** mide la temperatura del **die** (silicio), NO el aire. Está **sesgado alto** por autocalentamiento (típico 40-55 °C con el chip trabajando aunque el aire esté a 25 °C) y es **impreciso** (±varios °C, varía entre chips). **NO sirve como medida ambiente** ni para reemplazar el DHT22. **Sí sirve** como:
- **Salud del MCU**: si dispara muy alto (>80 °C) → el ESP está sobrecalentado (mala ventilación de la caja, sol directo).
- **Contraste de cordura**: si el DHT22 marca 25 °C pero el die marca 90 °C, algo raro pasa con la caja.

**Hecho ya (esta sesión):** el firmware **lo lee y lo imprime por serial** (`espC=NN` en la línea de estado) — para validar el valor mañana sin tocar la BD.

**Falta (pipeline completo):** para verlo en el dashboard/histórico:
1. Migración `0009`: columna `esp_temp_c` en `readings`.
2. Firmware: agregar `esp_temp_c` al JSON del POST (`net.cpp`).
3. Dashboard: testigo de salud del MCU + regla de alerta (>80 °C).

**Esfuerzo:** ~1-2 h el pipeline completo.

**Estado:** 🟡 parcial — lectura en serial lista; telemetría/dashboard pendientes.

---

## Prioridad sugerida
1. **R1** (alerta de saturación) — barata y de seguridad directa.
2. **R2** (OTA) — habilita la visión de flota de Luis; mayor esfuerzo pero alto valor.
3. **R3** (temp interna) — bajo esfuerzo, valor medio; cerrar el pipeline cuando se toque una migración.
