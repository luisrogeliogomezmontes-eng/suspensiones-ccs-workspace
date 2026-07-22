# API — Proyecto 1 · Suspensiones Caracas (Telemetría ESP32)

> Contrato de datos para el equipo de programación. El backend es **Supabase**
> (Postgres + PostgREST + Realtime). **No hay servidor propio que construir**:
> Supabase expone REST y WebSocket automáticamente sobre las tablas de abajo.
> Esquema fuente de verdad: [`backend/supabase/migrations/`](../backend/supabase/migrations).
>
> Estado: **MVP (I1)**. Auth aún no está (llega en I3): hoy se usa la `anon key`.
> Última actualización: 2026-07-13.

---

## 0. Endpoints base

| Recurso | URL |
|---|---|
| REST (PostgREST) | `https://<PROJECT>.supabase.co/rest/v1` |
| Realtime (WebSocket) | `wss://<PROJECT>.supabase.co/realtime/v1` |
| Proyecto actual | `ntqdrkbzntcfwwenawxy` |

**Autenticación (MVP):** toda request lleva la **publishable/anon key** en dos headers:

```
apikey: <ANON_KEY>
Authorization: Bearer <ANON_KEY>
```

- La `anon key` es **pública por diseño** (viaja al navegador). No es un secreto.
- La `service_role key` **es secreta** y solo va en servidor / Edge Functions. Nunca en cliente.

> ⚠️ **Posture de seguridad MVP (decisión D13) — leer antes de construir.** Hoy el rol
> `anon` puede **leer** `devices/readings/events` e **insertar** en `readings`. En
> términos OWASP API Top 10 esto es deuda conocida y temporal:
> - **A01 · BOLA (Broken Object Level Authorization):** no hay autorización por objeto —
>   cualquiera con la key (que es pública) lee/escribe filas de **todos** los devices, no
>   solo el suyo. **No construyan asumiendo que la anon key aísla unidades.**
> - **API4 · Consumo sin restricción:** no hay rate-limiting en el endpoint `anon`. Un
>   cliente (o agente) en bucle puede insertar/leer sin tope. No lo usen en loops abiertos.
>
> Se cierra en **I3**: Supabase Auth + RLS por dueño + **token por dispositivo** +
> rate-limit (ver §7). El contrato de datos (§1) se mantiene; lo que cambia es *quién puede
> qué*. Diséñense contra el modelo de I3, no contra la apertura de hoy.

Pídanle a Luis la `ANON_KEY` y la `PROJECT URL` (o están en `dashboard/.env.local`).

---

## 1. Modelo de datos

Cuatro tablas. La unidad móvil (maleta ESP32) es un `device`; su telemetría son `readings`;
el control baja por `commands`; las alertas se registran en `events`.

### 1.1 `devices` — una fila por unidad (soporta flota)

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid (PK) | id de la unidad |
| `name` | text | ej. `UNIDAD-01` |
| `fw_version` | text | versión de firmware |
| `temp_warn` | real | umbral °C **de aire interior** — advertencia (default 33) |
| `temp_serious` | real | umbral °C serio (default 40) |
| `temp_crit` | real | umbral °C crítico (default 46) |
| `last_seen` | timestamptz | lo actualiza un trigger al llegar telemetría |
| `created_at` | timestamptz | — |

> ⚠️ **Los umbrales son sobre la temperatura del AIRE dentro de la maleta**, no la
> superficie del equipo. El DHT22 mide aire (indicador adelantado de calor atrapado).

### 1.2 `readings` — serie temporal de telemetría (la tabla caliente)

| Columna | Tipo | Unidad / rango | Nota |
|---|---|---|---|
| `id` | bigint (identity) | — | PK compuesta `(device_id, ts, id)` |
| `device_id` | uuid (FK) | — | **requerido** |
| `ts` | timestamptz | ISO 8601 UTC | **sellado en origen** (GPS/NTP del ESP32), no en el ingest |
| `temp_c` | real | °C | punto principal (aire). `null` si no hay sensor |
| `temp_points` | jsonb | °C por punto | multi-punto: `{"intake":31.2,"starlink":48.9,"ecoflow":34.1}` |
| `fan_on` | boolean | — | estado del ventilador |
| `fan_duty` | smallint | 0–100 (%) | PWM (0 = off) |
| `fan_rpm` | integer | rpm | tacómetro (opcional) |
| `lat` | double precision | grados | GPS |
| `lng` | double precision | grados | GPS |
| `alt` | real | m | altitud |
| `speed_kmph` | real | km/h | velocidad GPS |
| `course` | real | grados 0–360 | rumbo |
| `sats` | smallint | conteo | satélites usados |
| `hdop` | real | — | dilución horizontal (menor = mejor) |
| `rssi` | smallint | dBm | señal WiFi del ESP32 |
| `uptime_s` | bigint | s | uptime del ESP32 |
| `heap_free` | integer | bytes | RAM libre |
| `batt_soc` | smallint | 0–100 (%) | EcoFlow (integración futura) |
| `power_w` | real | W | consumo (futuro) |
| `link_obstruction` | real | — | Starlink (futuro) |
| `link_down_mbps` | real | Mbps | Starlink (futuro) |

Todo lo que no sea `device_id` y `ts` puede venir `null` (el firmware omite lo que no tiene).

### 1.3 `commands` — downlink de control (dashboard → ESP32)

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid (PK) | — |
| `device_id` | uuid (FK) | destino |
| `ts` | timestamptz | default `now()` |
| `type` | enum | `fan_mode` · `setpoint` · `hysteresis` · `power_cycle` · `reboot` |
| `payload` | jsonb | ej. `{"mode":"auto"}` · `{"value":40}` |
| `issued_by` | uuid | operador (auth) |
| `ack_ts` | timestamptz | lo setea el firmware al confirmar; `null` = pendiente |

El ESP32 hace **polling** de comandos pendientes (`ack_ts is null`) — MQTT llega en fase 2.

### 1.4 `events` — bitácora de alertas

| Columna | Tipo | Nota |
|---|---|---|
| `id` | bigint (PK) | — |
| `device_id` | uuid (FK) | — |
| `ts` | timestamptz | default `now()` |
| `kind` | enum | `over_temp` · `fast_heating` · `offline` · `gps_lost` · `geofence` · `tamper` · `low_battery` · `link_obstruction` |
| `severity` | enum | `info` · `warning` · `serious` · `critical` |
| `message` | text | — |
| `ack_by` / `ack_ts` | uuid / timestamptz | reconocimiento |

---

## 2. Ingesta (uplink) — lo que hace el ESP32 hoy

`POST` a la tabla `readings` vía PostgREST. **Este es el contrato real del firmware**
([`firmware/net.cpp`](../firmware/net.cpp)):

```http
POST /rest/v1/readings HTTP/1.1
Host: <PROJECT>.supabase.co
apikey: <ANON_KEY>
Authorization: Bearer <ANON_KEY>
Content-Type: application/json
Prefer: return=minimal
```

```json
{
  "device_id": "00000000-0000-0000-0000-000000000001",
  "ts": "2026-07-13T18:22:05Z",
  "temp_c": 31.4,
  "fan_on": false,
  "fan_duty": 0,
  "lat": 10.4558,
  "lng": -66.8431,
  "alt": 900.0,
  "speed_kmph": 0.0,
  "course": 0.0,
  "hdop": 1.1,
  "sats": 6,
  "rssi": -50,
  "uptime_s": 1234,
  "heap_free": 195000
}
```

- Éxito → **HTTP 201** (con `Prefer: return=minimal`, cuerpo vacío).
- 401/403 → falta o no basta la key / RLS. 400 → tipo o columna inválida.
- `curl` equivalente para probar:

```bash
curl -X POST "https://<PROJECT>.supabase.co/rest/v1/readings" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" -H "Prefer: return=minimal" \
  -d '{"device_id":"00000000-0000-0000-0000-000000000001","ts":"2026-07-13T18:22:05Z","temp_c":31.4}'
```

---

## 3. Lectura (downlink) — lo que hace el dashboard

PostgREST expone filtros por query string. Ejemplos:

```bash
# Últimas lecturas de un device en los últimos 60 min, ascendente
GET /rest/v1/readings?device_id=eq.<UUID>&ts=gte.2026-07-13T17:00:00Z&order=ts.asc

# El device y sus umbrales
GET /rest/v1/devices?id=eq.<UUID>&select=*

# Últimos 200 puntos, descendente
GET /rest/v1/readings?device_id=eq.<UUID>&order=ts.desc&limit=200
```

Operadores PostgREST usados: `eq.` `gte.` `lte.` `order=` `limit=` `select=`.
Con el SDK JS (`@supabase/supabase-js`) es lo mismo en forma fluida — ver
[`dashboard/src/lib/useTelemetry.ts`](../dashboard/src/lib/useTelemetry.ts).

---

## 4. Tiempo real (Realtime / WebSocket)

El dashboard se suscribe a los `INSERT` de `readings` (también publicadas `events` y
`commands`). Con el SDK JS:

```ts
supabase
  .channel(`readings:${deviceId}`)
  .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "readings",
        filter: `device_id=eq.${deviceId}` },
      (payload) => handle(payload.new))
  .subscribe();
```

Cada `payload.new` es una fila de `readings` (mismas columnas del §1.2).

---

## 5. Errores

**Hoy (PostgREST directo):** los errores NO vienen en RFC 9457. El shape real es de
PostgREST (verificado contra el proyecto):

```json
{ "code": "42703", "message": "column readings.nope does not exist",
  "details": null, "hint": null }
```

| HTTP | Cuándo | Qué mirar |
|---|---|---|
| `201` | INSERT ok (con `Prefer: return=minimal`, cuerpo vacío) | — |
| `400` | JSON malo, tipo/columna inválida, viola un `check` (ej. `fan_duty` fuera de 0–100) | `message` + `code` (SQLSTATE) |
| `401` | Falta `apikey`/`Authorization` o key inválida | headers |
| `403` | RLS niega la operación (rol sin política) | política / rol |
| `404` | Recurso/tabla inexistente | ruta |
| `409` | Viola FK o unique (ej. `device_id` que no existe) | `details` |

- `code` es el **SQLSTATE** de Postgres (`23503`=FK, `23514`=check, `42703`=columna, `22P02`=tipo).
- ⚠️ El OpenAPI autogenerado de PostgREST (`GET /rest/v1/`) **exige la secret key** — con la
  anon da 401. No sirve como doc pública; por eso este archivo **es** el contrato.

**A futuro (capa Edge, I3):** los endpoints propios devolverán **RFC 9457**
(`application/problem+json`: `type`/`title`/`status`/`detail`/`instance`+`timestamp`) con
`detail` accionable — para que un consumidor (o agente LLM) se auto-corrija sin adivinar.

---

## 6. Convenciones y garantías

- **Tiempo:** `ts` es UTC ISO 8601, **sellado por el ESP32** (GPS/NTP). No confíen en la
  hora de llegada al servidor.
- **Unidades:** °C, km/h, dBm, W, bytes, grados. Documentadas en §1.
- **Nulos:** cualquier métrica opcional puede faltar; el firmware omite lo que no mide.
  No asuman que `temp_c`/`lat`/`lng` siempre vienen.
- **Umbrales:** no los hardcodeen; léanlos de `devices` (`temp_warn/serious/crit`), son
  configurables por unidad.
- **Idempotencia:** no hay dedupe; si reintentan un POST puede duplicar (mismo `ts`,
  distinto `id`). Para ingesta idempotente, PostgREST soporta upsert con
  `Prefer: resolution=merge-duplicates` sobre una unique key — se evaluará en la capa Edge.

---

## 7. Roadmap del contrato (qué va a cambiar)

| Fase | Cambio | Impacto para el equipo |
|---|---|---|
| **I3** | Supabase **Auth** + RLS por dueño + **token por device** | Cierra el BOLA de hoy: lectura pedirá login; el device usará su token. |
| **I3** | **Capa Edge propia** (Supabase Edge Functions / Deno): `POST /ingest`, `GET /telemetry`, `POST /command` | Desacopla al equipo del esquema Postgres; el contrato de §1 se mantiene. |
| **F2** | **MQTT** (Mosquitto) para uplink/downlink en vez de polling | Alternativa al REST para tiempo real de campo. |

**Principios que adoptará la capa Edge** (de la skill `api-builder`, adaptados al stack
Supabase — no se scaffoldea un server nuevo mientras PostgREST alcance):
- **Contrato-primero con validación en el borde** (Zod) en cada endpoint — hoy la única
  validación son los `check`/FK de Postgres; se moverá al borde con mensajes accionables.
- **Errores RFC 9457** (`application/problem+json`) para auto-corrección de agentes (§5).
- **Authz deny-by-default**, ownership verificado por request (nunca confiar en el `device_id`
  del body) + **rate-limiting** por token/device (OWASP A01 y API4).

Cualquier cambio que rompa compatibilidad se versiona aquí antes de aplicarse.
