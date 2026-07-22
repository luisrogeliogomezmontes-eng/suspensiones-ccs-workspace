# Plan — "Último status conocido" por centinela (graceful offline)

> **Estado: PLANIFICADO, sin implementar** (2026-07-20). Feature de UX del dashboard.
> Roadmap: **I6** (ver `PLAN-INTERFAZ.md` §11). Depende de I1 (Overview) — ya hecho.
> Origen: pedido de Luis tras el primer apagón real del Centinela 01 (apagaron la
> EcoFlow → cayó Starlink → cayó el ESP32). El dashboard quedó en blanco y "eso desespera".

## 1. Objetivo
Cuando un centinela se apaga (o pierde enlace), el dashboard **no debe quedar en blanco**.
Debe mostrar un **resumen de cierre** con el último estado conocido, para que se lea
"la unidad está apagada, esto es lo último que reportó" en vez de campos vacíos.
Regla UX: **un dato viejo etiquetado como viejo > un campo en blanco.**

## 2. Insight clave (define toda la solución)
El ESP32 se apaga **sin avisar** (corte de energía abrupto: no hay "goodbye"). Pero
**la ÚLTIMA lectura ya contiene todo lo que Luis pidió** — no hace falta un evento de
apagado ni cambios de firmware:

| Dato pedido | De dónde sale (última `reading`) |
|---|---|
| Hace cuánto se apagó | `now − ts` de la última lectura (± intervalo de POST como margen) |
| Última ubicación | `lat` / `lng` de la última lectura |
| Última temperatura | `temp_c` (+ su nivel según umbrales del device) |
| **Tiempo de uso de la última encendida** | `uptime_s` de la última lectura = **duración exacta de esa sesión** (el ESP lo cuenta desde el boot) |
| Última señal / GPS / fan | `rssi`, `sats`, `fan_duty`, `heap_free` de esa misma fila |
| Última vez visto (absoluto) | `ts` de la última lectura (= `devices.last_seen`) |

➡️ **El "momento de apagado" se INFIERE del último `ts`**, no se detecta. Un apagón por
corte de energía no da chance a un evento limpio; intentar detectarlo por brown-out en
firmware es poco fiable → se descarta. La inferencia por `ts` es correcta y suficiente.

## 3. El problema real a resolver (data gap)
`useTelemetry` hoy solo trae **los últimos 60 min** (`WINDOW_MIN`, filtro `gte ts`).
Si el device lleva **> 60 min apagado**, `readings` viene vacío y `latest` es `null`
→ **todo en blanco**. Ese es exactamente el bug que Luis vio.

**Fix:** además de la ventana de 60 min (para gráficas), pedir SIEMPRE la **última
lectura sin filtro de tiempo** (`order ts desc limit 1`). Esa fila alimenta el resumen
de cierre aunque la unidad lleve horas/días apagada.

## 4. Campos derivados a computar (nueva función `deriveLastKnown`)
Entrada: última lectura (sin ventana) + `now` + umbrales del device.
Salida (para la tarjeta):

- `powerState`: `"online" | "stale" | "offline"` — reusar `linkState()` de `status.ts`.
- `offForMs` = `now − ts(last)` → formatear "apagado hace 2 h 14 min".
- `lastSeenAbs` = `ts(last)` en hora local (fecha + hora).
- `sessionUptimeS` = `uptime_s(last)` → formatear "esta sesión duró 3 h 48 min".
  ⚠️ si `uptime_s` es null (fw viejo) → ocultar la fila, no mostrar "null".
- `lastTemp` = `{ value: temp_c, level: tempLevel(temp_c, thr) }`.
- `lastPos` = `{ lat, lng, sats }` + link a `maps` + mini-mapa **congelado** (marcador gris).
- `lastRssi`, `lastFanDuty`, `lastHeap` (secundarios, en un pie de tarjeta).
- (opcional) `sessionReadings` = count de filas de esa sesión (mismo `uptime` creciente).

## 5. UI — componente `LastKnownStatus` (tarjeta de cierre)
- **Cuándo aparece:** cuando `linkState === "offline"` (o `stale` con banner suave).
  En `online` se muestra el Overview normal en vivo.
- **Tono visual:** apagado ≠ error. Usar **gris/neutro** (no rojo de alarma) + ícono
  de "power/moon". Rojo se reserva para fallas reales (sobre-temp con enlace vivo).
  Respetar `LEVEL_META` de `status.ts` (color + ícono + etiqueta, nunca solo color).
- **Encabezado:** `⏻ Centinela 01 · Apagado` + "hace 2 h 14 min".
- **Cuerpo (grid de tiles, todos con dato real de la última lectura):**
  - `Última vez visto` — 20 jul 18:36 (hora local)
  - `Sesión` — duró 3 h 48 min · (opcional) N lecturas
  - `Última temperatura` — 25.5 °C ✓ (nivel por color+glyph)
  - `Última ubicación` — mini-mapa congelado + coords + "ver en mapa"
  - `Última señal` — RSSI −21 dBm · GPS 15 sats · Fan 0%
- **Marca de agua:** etiqueta clara "**último dato — la unidad está apagada**" para que
  nadie confunda el dato viejo con dato en vivo. Cero campos vacíos: si un valor falta,
  se muestra "—" con tooltip "no reportado en la última lectura".

## 6. Flota — un status por cada centinela (futuro cercano)
Luis dijo "cada centinela" → la feature debe escalar a **N unidades**:
- **Roster de flota** (nueva vista o sección del Overview): una fila/tarjeta por device
  con su chip de estado (online/stale/offline), "hace cuánto", última temp y última pos.
  Fuente: `devices` (todas) + la última `reading` de cada una (una query `distinct on
  (device_id) ... order by device_id, ts desc`, o una **vista SQL** `latest_reading`).
- Hoy hay 1 device → implementar la tarjeta single primero; el roster reusa la misma
  `deriveLastKnown` por cada fila. No sobre-construir hasta que haya 2+ unidades reales.

## 7. Archivos a tocar (aterrizado en el código actual)
| Archivo | Cambio |
|---|---|
| `dashboard/src/lib/useTelemetry.ts` | añadir query "última lectura sin ventana" → exponer `lastKnown: Reading \| null` en `Telemetry`. No romper `latest` (sigue siendo la última DENTRO de la ventana). |
| `dashboard/src/lib/status.ts` | añadir `deriveLastKnown(last, now, thr)` + formateadores de duración ("Xh Ym", "hace …"). Reusar `linkState`/`tempLevel`. |
| `dashboard/src/components/LastKnownStatus.tsx` | **nuevo** — la tarjeta de cierre (§5). |
| `dashboard/src/app/page.tsx` (Overview) | si `offline` → render `LastKnownStatus` en vez de los tiles vacíos; si `online` → Overview normal. |
| `dashboard/src/lib/format.ts` | helpers de duración/relativo si no existen. |
| (flota, fase 2) vista SQL `latest_reading` | `distinct on (device_id)` para el roster — migración nueva. |

## 8. Casos borde
- **Nunca reportó** (device sin ninguna reading) → estado "sin datos aún", no "apagado".
- **`uptime_s` null** (fw viejo / build GPS_ONLY sin ese campo) → ocultar la fila de sesión.
- **Reloj:** `ts` sellado por NTP/GPS en origen (UTC) → el "hace cuánto" es fiable aun si
  el server o el cliente tienen skew. Mostrar en hora local del que mira.
- **Reboot vs apagón:** si el `uptime_s` de la nueva sesión reinicia a 0, es un reboot;
  la tarjeta simplemente refleja la sesión vigente. No hace falta distinguirlos en I6.
- **Stale (enlace intermitente):** banner suave "señal con retraso" + seguir mostrando lo
  último; no saltar directo a la tarjeta de apagado hasta cruzar el umbral offline (60 s).

## 9. Fuera de alcance (no en I6)
- Detección de apagado "limpio" por firmware (brown-out) — poco fiable, se descarta.
- Notificación push de "unidad apagada" — va con las alertas persistentes (n8n, post-I4).
- Historial de sesiones de encendido/apagado (uptime por sesión a lo largo del tiempo) —
  interesante para un reporte de disponibilidad, pero es otra feature (I7+).

## 10. Definición de "hecho" (cuando se implemente)
Con el device apagado > 60 min, el Overview muestra la tarjeta de cierre con última
posición/temp/sesión reales (0 campos en blanco) → build/lint/typecheck limpios →
verificado apagando el device real (o mock forzado a offline).
