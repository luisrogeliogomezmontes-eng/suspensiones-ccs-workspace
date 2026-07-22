# API Suspensiones Caracas — Contrato `v1`

> Contrato de la **API de telemetría y control** de las unidades Centinela (maletas ESP32).
> Pensado para que **la app de Suspensiones CCS (equipo de computación)** integre monitoreo
> y control de las unidades **sin acoplarse a la base de datos interna**.
>
> **Estado:** BORRADOR para acordar con el equipo de computación. Cero implementación aún.
> **Última actualización:** 2026-07-20 · **Versión del contrato:** `v1`

---

## 0. TL;DR

- **Qué es:** una capa HTTP delgada y propia entre la app de ellos y nuestro Supabase. Ellos **nunca** tocan la BD directo → podemos iterar firmware/esquema/dashboard sin romperles nada.
- **Alcance v1:** monitoreo completo (lectura) + **control seguro** (fan, setpoint, umbrales), **desde el día 1**. **NO** incluye power-cycle de Starlink ni reboot remoto (quedan fuera de la API por seguridad).
- **Auth:** una **API-key** por consumidor (`X-API-Key`), revocable. La del equipo de computación cubre **toda la flota** (`device_ids: "*"`). Deny-by-default.
- **Datos en vivo:** **REST polling**. La data se refresca **cada 5 s** en origen → recomendado **polling cada 5 s** (§7). SSE/webhooks quedan para `v2`.
- **Sin campos derivados:** se entrega lo esencial **crudo**; ΔT, tendencias, etc. los calcula el consumidor. La interfaz es nuestra; ellos hacen la suya.
- **Hosting:** Supabase Edge Functions (Hono + Deno), junto a la BD. `service_role` solo por dentro, nunca expuesto.
- **Errores:** formato **RFC 9457** (`application/problem+json`).

---

## 1. Contexto y principio de diseño

La app de ellos **no** habla con Supabase; habla con **esta API**. La API traduce a la BD por dentro (con `service_role`, oculto). Beneficio central:

```
   [App Suspensiones CCS]  ──X-API-Key──►  [API v1 (Hono @ Supabase Edge)]  ──service_role──►  [Supabase / Postgres]
        (lo de ellos)                          (el contrato estable)                              (nuestros internos)
```

- **Contrato estable y versionado** (`v1`). Si algún día cambia la forma, sale `v2`; `v1` sigue vivo.
- **Su propia llave**, con scope a las unidades que les autoricemos. No ven el resto de la flota ni la BD.
- Nosotros seguimos con firmware, flota "Centinela NN" e integraciones **por detrás**, sin tocar su integración.

---

## 2. Base URL, versión y formato

| Concepto | Valor |
|---|---|
| **Base URL (MVP)** | `https://<project-ref>.supabase.co/functions/v1/api-v1` |
| **Base URL (producción, opcional)** | `https://api.suspensiones.<dominio>/v1` (dominio propio → limpia el prefijo de Supabase) |
| **Versión** | `v1` (en el path). Cambios incompatibles → `v2`; aditivos (campos nuevos) NO rompen `v1`. |
| **Formato** | JSON (`application/json`) en request y response. Errores en `application/problem+json`. |
| **Fechas** | ISO 8601 UTC (`2026-07-20T14:03:11Z`). El `ts` de cada lectura viene **sellado en origen** por el ESP32 (GPS/NTP). |
| **Unidades** | °C · `fan_duty` 0–100 % · `speed_kmph` km/h · `rssi` dBm · `batt_soc` 0–100 % · `power_w` W. |

> En los endpoints de abajo, `{BASE}` = la Base URL. `:id` = UUID de la unidad.

---

## 3. Autenticación y autorización

- **Header obligatorio:** `X-API-Key: sk_live_xxxxxxxx`.
- La key la **emite y revoca Luis**. Se guarda **hasheada** (nunca en claro, nunca en el repo).
- Cada key tiene:
  - **`device_ids[]`** — a qué unidades puede acceder. La key del equipo de computación = **`"*"` (toda la flota)**; se puede acotar a un subconjunto luego **sin cambiar el contrato**. Fuera del scope → `403`.
  - **`scopes[]`** — `read` (monitoreo) y/o `control` (comandos seguros + config). La key del equipo de computación trae **`read` + `control`** desde el día 1.
  - **`rate_limit`** — ver §7.
- **Deny-by-default (OWASP BOLA/BFLA):** el `:id` del path se valida **siempre** contra los `device_ids` de la key. Nunca se confía en un ID de la request para autorizar.
- Sin key, key inválida o revocada → `401`. Key válida pero unidad/acción fuera de scope → `403`.

> `power_cycle` y `reboot` **no son un scope** disponible en `v1`: están **bloqueados a nivel de API**, no solo "no autorizados". Aunque una key tuviera `control`, la API los rechaza (§6.3).

---

## 4. Modelos de dominio

Espejo (traducido y estable) del esquema interno. Los campos opcionales pueden venir `null` mientras el hardware no exista (batería, potencia, Starlink).

### 4.1 `Device` (unidad Centinela)
| Campo | Tipo | Nota |
|---|---|---|
| `id` | uuid | Identificador de la unidad. |
| `name` | string | Nombre visible (ej. `"Centinela 01"`). |
| `fw_version` | string \| null | Versión de firmware que reporta. |
| `thresholds` | object | Umbrales de alarma °C: `{ warn, serious, crit }`. |
| `last_seen` | string \| null | ISO — última telemetría recibida. |
| `status` | enum | `online` \| `stale` \| `offline` — **derivado** de la antigüedad de `last_seen` (mismo criterio que el dashboard). |

### 4.2 `Reading` (una muestra de telemetría)
| Campo | Tipo | Nota |
|---|---|---|
| `ts` | string | ISO, sellado en origen. |
| `temp_c` | number \| null | Temperatura del aire interior (punto principal). |
| `temp_points` | object \| null | Multi-punto futuro: `{ "intake": 31.2, "starlink": 48.9 }`. |
| `fan_on` | bool \| null | Ventilador encendido. |
| `fan_duty` | number \| null | 0–100 %. |
| `fan_rpm` | number \| null | RPM del tach (si disponible). |
| `lat` `lng` | number \| null | Posición GPS. |
| `alt` `speed_kmph` `course` | number \| null | Altitud, velocidad, rumbo. |
| `sats` `hdop` | number \| null | Calidad del fix GPS. |
| `rssi` | number \| null | Señal WiFi al repetidor (dBm). |
| `uptime_s` `heap_free` | number \| null | Salud del ESP32. |
| `batt_soc` | number \| null | % batería EcoFlow (integración futura). |
| `power_w` | number \| null | Consumo (integración futura). |
| `link_obstruction` `link_down_mbps` | number \| null | Métricas Starlink (integración futura). |

### 4.3 `Command` (control enviado a la unidad)
| Campo | Tipo | Nota |
|---|---|---|
| `id` | uuid | Del comando. |
| `ts` | string | Cuándo se envió. |
| `type` | enum | `fan_mode` \| `setpoint` (los seguros; ver §6). |
| `payload` | object | Depende del `type` (§6.2). |
| `status` | enum | `pending` \| `applied` — derivado de si la unidad ya confirmó. |
| `applied_at` | string \| null | ISO — cuándo la unidad lo aplicó (`ack`). |

### 4.4 `Event` (alerta / bitácora)
| Campo | Tipo | Nota |
|---|---|---|
| `id` | number | Del evento. |
| `ts` | string | Cuándo ocurrió. |
| `kind` | enum | `over_temp` \| `fast_heating` \| `offline` \| `gps_lost` \| `geofence` \| `tamper` \| `low_battery` \| `link_obstruction`. |
| `severity` | enum | `info` \| `warning` \| `serious` \| `critical`. |
| `message` | string \| null | Texto legible. |

---

## 5. Endpoints de LECTURA (monitoreo) — scope `read`

### 5.1 `GET {BASE}/devices`
Lista las unidades que la key puede ver (listo para flota).
```json
200 OK
{
  "devices": [
    { "id": "0000…0001", "name": "Centinela 01", "status": "online",
      "last_seen": "2026-07-20T14:03:09Z", "fw_version": "p1-dev",
      "thresholds": { "warn": 33, "serious": 40, "crit": 46 } }
  ]
}
```

### 5.2 `GET {BASE}/devices/:id`
Detalle de una unidad (config + estado).

### 5.3 `GET {BASE}/devices/:id/latest` ← **endpoint principal de polling**
Última lectura (snapshot en vivo). **Recomendado: pedir cada 5 s** — la unidad genera 1 lectura cada 5 s, así que pedir más seguido re-lee la misma fila (inofensivo, solo redundante; el polling NO toca el hardware). El campo `reading.ts` dice qué tan fresca es.
```json
200 OK
{
  "device_id": "0000…0001",
  "status": "online",
  "reading": {
    "ts": "2026-07-20T14:03:09Z",
    "temp_c": 29.2, "fan_on": true, "fan_duty": 59, "fan_rpm": 2210,
    "lat": 10.5007, "lng": -66.8556, "speed_kmph": 0, "sats": 8, "hdop": 1.4,
    "rssi": -63, "batt_soc": null, "power_w": null
  }
}
```

### 5.4 `GET {BASE}/devices/:id/telemetry`
Histórico por rango de tiempo. Query: `from` (ISO), `to` (ISO, def. ahora), `limit` (def. 500, máx. 5000), `order` (`asc`|`desc`).
```
GET {BASE}/devices/0000…0001/telemetry?from=2026-07-20T13:00:00Z&limit=1000
```
```json
200 OK
{ "device_id": "0000…0001", "count": 1000,
  "from": "2026-07-20T13:00:00Z", "to": "2026-07-20T14:03:09Z",
  "readings": [ { "ts": "…", "temp_c": 28.9, "fan_duty": 55, … }, … ] }
```

### 5.5 `GET {BASE}/devices/:id/events`
Bitácora de alertas. Query: `since` (ISO), `severity` (min: `info`|`warning`|`serious`|`critical`), `limit`.

### 5.6 `GET {BASE}/devices/:id/commands`
Historial de comandos con su estado de aplicación (para que confirmen que su comando llegó). Query: `limit` (def. 20), `status` (`pending`|`applied`).

---

## 6. Endpoints de CONTROL (seguro) — scope `control`

> Modelo asíncrono: enviar un comando **encola** una orden; la unidad la aplica en **pocos segundos** (hace polling) y confirma. El `POST` devuelve `202 Accepted` con el `id`; se consulta el estado con §5.6.

### 6.1 `POST {BASE}/devices/:id/commands`
```json
POST {BASE}/devices/0000…0001/commands
{ "type": "fan_mode", "payload": { "mode": "auto" } }
```
```json
202 Accepted
{ "id": "cmd_…", "type": "fan_mode", "status": "pending", "ts": "2026-07-20T14:05:00Z" }
```

### 6.2 Tipos y payloads permitidos en `v1`
| `type` | `payload` | Efecto |
|---|---|---|
| `fan_mode` | `{ "mode": "auto" \| "on" \| "off" }` | Auto = histéresis por temperatura; on/off = override manual. |
| `setpoint` | `{ "on": 40, "off": 35 }` | °C a los que el fan enciende / apaga (on > off). |

### 6.3 `PATCH {BASE}/devices/:id/config`
Umbrales de **alarma** (no controlan el fan; disparan estados/alertas).
```json
PATCH {BASE}/devices/0000…0001/config
{ "thresholds": { "warn": 33, "serious": 40, "crit": 46 } }   // warn < serious < crit
```

### 6.4 Acciones **bloqueadas** en `v1`
`power_cycle` (Starlink/repetidor) y `reboot` (ESP32) **no se aceptan** por esta API. Intentarlo → `403` con error instructivo:
```json
403 Forbidden · application/problem+json
{ "type": "https://api.suspensiones/errors/action-not-available",
  "title": "Acción no disponible en v1",
  "status": 403,
  "detail": "power_cycle y reboot no se exponen vía API por seguridad. Estas acciones quedan en el panel del dueño.",
  "instance": "/devices/0000…0001/commands" }
```

---

## 7. Frescura, latencia y límites de uso

**Frescura de datos:** la unidad postea 1 lectura **cada 5 s** (`TELEMETRY_PERIOD_MS`). Por eso la data nunca es más vieja de ~5 s, y **no tiene sentido pedir más rápido que eso** (se re-lee la misma fila). El polling pega a la nube, **no al ESP32** → no afecta el funcionamiento del hardware.

**Latencia de control:** al enviar un comando, la unidad lo toma en su próximo poll (**cada 5 s**), lo aplica y confirma. O sea, un comando se aplica en **≤5 s**.

**Rate limiting** (por key):

| Scope | Límite por defecto | Nota |
|---|---|---|
| `read` | **30 req/min por unidad** | Polling recomendado (5 s) = 12/min. Permite hasta 2 s si quieren sensación más viva. |
| `control` | **15 req/min** | Evita spam de comandos al hardware. |

Exceso → `429 Too Many Requests` con header `Retry-After`. Ajustable por key.

> ¿Necesitan <5 s de verdad? Dos palancas, **sin romper `v1`**: (a) bajar el periodo de reporte del firmware (cuesta datos de Starlink, que es medido), o (b) **SSE push en `v2`** (el servidor empuja cada lectura al instante, sin polling).

---

## 8. Errores — RFC 9457 (`application/problem+json`)

Todos los errores traen `type` (URL), `title`, `status`, `detail`, `instance`. Esto **no es cosmético**: permite auto-corrección (incluida por agentes LLM).

| HTTP | Cuándo |
|---|---|
| `400` | Body/params inválidos (falla validación Zod). El `detail` dice qué campo. |
| `401` | Falta la API-key, es inválida o está revocada. |
| `403` | Key válida pero unidad fuera de scope, o acción bloqueada (§6.4). |
| `404` | La unidad no existe. |
| `422` | Semántica inválida (ej. `setpoint.off ≥ setpoint.on`). |
| `429` | Rate limit (con `Retry-After`). |
| `503` | La BD interna no responde (transitorio, reintentar con backoff). |

```json
400 · application/problem+json
{ "type": "https://api.suspensiones/errors/validation",
  "title": "Payload inválido",
  "status": 400,
  "detail": "payload.mode debe ser uno de: auto, on, off. Recibido: 'fast'.",
  "instance": "/devices/0000…0001/commands" }
```

---

## 9. Qué NO entra en `v1` (roadmap `v2`)

| Futuro | Por qué después |
|---|---|
| **SSE / streaming** (`GET /devices/:id/stream`) | El polling REST alcanza para monitorear. Se agrega sin romper `v1`. |
| **Webhooks** (avisar a un URL de ellos ante alertas) | Útil para push de eventos; requiere registro/reintentos. |
| **power_cycle / reboot** vía API | Sensibles; se evaluarán con auditoría fina si hace falta. |
| **Escritura multi-tenant / gestión de keys self-service** | Por ahora las keys las emite Luis a mano. |

---

## 10. Notas de implementación (para nosotros, no para el consumidor)

- **Stack:** Hono + TypeScript + Zod + `@hono/zod-openapi`, desplegado como **Supabase Edge Function** (`api-v1`). Docs con **Scalar** sobre el OpenAPI generado.
- **Contrato-primero:** definir los esquemas Zod (§4) antes de las rutas; validar headers/params/query/body en el borde de cada endpoint.
- **`service_role` solo del lado servidor** (Edge Function), nunca en la respuesta ni en el cliente.
- **Tabla nueva `api_keys`** (hash de la key, `device_ids[]`, `scopes[]`, `rate_limit`, `revoked_at`) — migración aparte, no toca las tablas existentes.
- **Reutiliza la BD actual:** lee `readings`/`devices`/`events`, escribe `commands`/`devices` (config). El firmware ya consume `commands` por polling y confirma `ack_ts` → el control seguro funciona sin tocar firmware.
- **"Hecho"** (según skill `api-builder`): Zod validado en el borde · OpenAPI + Scalar sirviendo · errores RFC 9457 · rate limit + authz deny-by-default · typecheck limpio · probado con `curl` real · sin secretos en el repo.

---

## 11. Decisiones acordadas (Luis · 2026-07-20)

1. **Flota completa** — la key del equipo de computación accede a **todas** las unidades (`device_ids: "*"`). Acotable luego sin cambiar el contrato.
2. **Cadencia** — recomendado **5 s** (la data se refresca cada 5 s en origen); el rate limit permite hasta 2 s (§7).
3. **Sin campos derivados** — se entrega lo esencial crudo; ΔT/tendencias las calcula el consumidor. Los campos de integración (batería, potencia, Starlink) van `null` hasta que exista el hardware — se mantienen en el esquema para **no romper el contrato** cuando lleguen.
4. **Control desde el día 1** — la key trae `read` + `control` (seguro) de entrada.
5. **La interfaz es nuestra** — la API entrega **datos y control**, no UI. El equipo de computación construye su propia interfaz (salvo que pidan lo contrario explícitamente). No hay endpoints de branding/UI.

### Handoff al equipo de computación
Además de este contrato, se les entrega el **OpenAPI (`openapi-v1.yaml`) + página Scalar interactiva** para que generen su cliente y prueben contra un **mock**, sin esperar al backend real.
