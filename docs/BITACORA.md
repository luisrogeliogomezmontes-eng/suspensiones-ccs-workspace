# BITÁCORA — Proyecto 1 (Suspensiones Caracas)

> Registro cronológico de sesiones: qué se hizo, decisiones y qué quedó pendiente.
> El **estado vivo** (arquitectura, decisiones, roadmap, to-do) está en [MEMORY.md](../MEMORY.md).
> Aquí se agrega **una entrada por sesión** (arriba lo más reciente).

---

## 2026-07-22 — Dashboard multi-centinela: selector en header + vista de flota + hallazgo de token en git

**Objetivo:** Luis reportó que "no se visualiza nada" en el dashboard pese a tener un **Centinela 02 encendido y posteando** a Supabase, y preguntó si la interfaz permite cambiar entre centinelas.

**Hecho:**
- **Diagnóstico (era arquitectura, no un bug de datos):** el dashboard estaba **clavado a un solo `device_id` horneado en build** (`NEXT_PUBLIC_DEVICE_ID` = `…0001`, Centinela 01). Las 5 pantallas filtraban por esa constante; **cero selector**. Verificado contra datos reales vía la **API v1** (key del equipo de computación, `.env.cs-team-key`): `GET /devices` mostró la flota — **Centinela 01 offline** (last_seen 2026-07-20) y **Centinela 02 online** (posteando hace minutos: temp 27.4°C, fan 36%, rssi −44, sin fix GPS bajo techo, 3 sats). El dashboard solo le preguntaba a la unidad muerta → pantalla vacía. (La FK `readings→devices` confirma que 02 sí tiene fila y sus lecturas entran.)
- **Soporte multi-centinela (commiteado + pusheado, en producción):**
  - `DeviceProvider` (`dashboard/src/lib/devices.tsx`): carga la flota autenticado, persiste la elección en `localStorage` y **auto-selecciona la unidad de señal más reciente** (la viva) cuando no hay elección previa. Sondeo cada 30 s (la tabla `devices` no está en la publicación realtime).
  - `DeviceSelector` en el header: desplegable con punto de estado por unidad; con una sola unidad se ve como el título de siempre.
  - **Vista de flota** (`/flota`): grid de cards (temp protagonista con color por umbral, fan/rssi/uptime) en vivo por realtime de `readings`; clic → enfoca esa unidad y va a Overview. Pestaña visible **solo con >1 centinela**.
  - Overview/Histórico/Mapa/Control/Alertas ahora siguen al centinela en foco vía `useDeviceId()`.
  - Verificado: `tsc`, `eslint` y `next build` **los tres limpios** (12 rutas). Sin captura headless (no había Playwright/Puppeteer local; se dejó dev server para que Luis lo viera logueado).
- **Commit + push a `main`** (dispara auto-deploy Vercel). El push chocó con divergencia; se **rebasó** el trabajo local sobre `origin/main` (subieron también los commits de API v1 que estaban local sin pushear).

**⚠️ Hallazgo de seguridad:** en el remoto había un commit ajeno **`279762f "Add Supabase access token to environment file"`** que metió `SUPABASE_ACCESS_TOKEN=sbp_35…` en **`.env.supabase`**. El archivo hoy está git-ignored, pero **se commiteó igual → el token quedó en el historial de GitHub** y además **`.env.supabase` sigue TRACKED** (se seguiría commiteando). No se reescribió historial ni se forzó push (destructivo + compartido).

**Pendiente / próximo:**
- ⚠️ **Rotar/revocar el token `sbp_...`** en [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) — es el fix real (ya estaba pendiente; ahora urgente por estar en el repo).
- **Untrack `.env.supabase`** (`git rm --cached` + commit) — propuesto, NO ejecutado (requiere commit; queda a decisión de Luis). No borra el token del historial (para eso, scrub + force-push, solo con su OK y **después** de rotar).
- Confirmar visualmente en producción (Vercel) el selector + `/flota` logueado.
- Cosmético de Centinela 02: `fw_version` null ("fw ?") — flashear/registrar versión.
- Posible **vista de flota como landing** si crece la flota (hoy Overview sigue siendo `/`).

**Decisiones:** **D35** (soporte multi-centinela en el dashboard; ver MEMORY §3).

---

## 2026-07-21 (cierre 2) — Subproyecto de Giovanni: comparador de respaldo eléctrico (inversores + baterías)

**Objetivo:** ayudar a Giovanni (eléctrica del depto) con un proyecto suyo aparte de P1. Tenía 2 CSV/Excel (matriz comparativa de inversores y baterías) y pidió organizarlos en una vista clara, comparar equipos de la misma capacidad por **precio y costo-beneficio**, que fuera **escalable**, y con un **módulo futuro de paneles solares**. Todo desde su transcripción textual.

**Hecho:**
- **Parseo de los 2 CSV** (volcado tipo celdas-combinadas, campos dispersos en columnas + celdas multilínea) con script Python (`csv` module para las comillas/saltos) → JSON limpio: **15 inversores + 39 baterías**, precios normalizados (11 inv / 28 bat con precio; `---`/vacío → "Cotizar"). Bug detectado y corregido: `clean()` colapsaba dobles espacios de 2 etiquetas ("Maxima corriente de  Carga/Descarga") → salían vacías.
- **Herramienta** [`respaldo-electrico/index.html`](../respaldo-electrico/index.html): **un solo HTML autocontenido** (doble clic, sin internet, datos embebidos y editables con plantilla comentada). Estética "panel de instrumentos" (numéricos monoespaciados tabulares, línea ámbar, barras de valor). Pestañas **Baterías / Inversores / Paneles (placeholder)**; stat tiles; **mapa de valor** (dispersión capacidad × $/unidad, mejor-de-grupo en verde); filtros (búsqueda/marca/origen/orden/solo-con-precio); **vista Tarjetas** agrupada + **vista Tabla** ordenable; light/dark; responsive.
- **Cumple lo pedido**: agrupación de inversores en **bandas 1–2 / 3–4 / 5–6 / 10–12 kW·kVA** (tal cual), baterías por kWh; métrica **$/kWh** y **$/kW** con "mejor valor" por grupo. Insight que emergió: el $/kWh cae con el tamaño (Rarlon 20 kWh = **$64/kWh** vs. baterías chicas a $230–291); y en inversores el costo-beneficio contradice el precio (Victron $746 rinde mejor $/kW que el de $646).
- **Diseño validado**: paleta corrida por el validador del skill `dataviz` (CVD-safe, light y dark); guías `frontend-design` + `artifact-design` aplicadas. Verificado por **screenshots headless** (Chrome) en baterías/inversores/tabla/tema-claro — no solo a ojo.
- **Orden del repo**: CSV originales (nombres con espacios/acentos) **borrados de la raíz**; copias limpias en `respaldo-electrico/fuentes/`. `README.md` + `PLAN-EDICION.md` en la carpeta.
- **Publicado como artifact** (link privado `claude.ai/code/artifact/ec0513f5-...`) para que Luis lo comparta con el jefe.
- **Plan de continuación** ([`respaldo-electrico/PLAN-EDICION.md`](../respaldo-electrico/PLAN-EDICION.md)): Giovanni pidió **agregar/editar/borrar equipos e imágenes desde la UI**. NO se implementó (Luis sin tokens) — se dejó plan de ingeniería detallado: Fase 1 (localStorage + export/import JSON + imágenes base64 con compresión canvas), Fase 2 (Vercel + Supabase para multiusuario). ⚠️ Gotcha clave documentado: el **CSP del link de artifact bloquea Supabase e imágenes externas** → backend solo funciona en local o Vercel, no en el artifact.

**Pendiente / próximo:**
- **Giovanni** implementa la edición-desde-UI + imágenes en **su** sesión/cuenta (Luis le pasa avance + plan).
- Luis: compartir el link de artifact desde el menú de la página si quiere que el jefe lo vea.
- Módulo de **paneles solares** ($/Wp) cuando lleguen los datasheets.

**Decisiones:** **D34** (subproyecto comparador eléctrico — no es P1, mismo repo; ver MEMORY §3). Sin cambios de firmware/hardware/backend de P1.

---

## 2026-07-21 (cierre 1) — API pública v1 para terceros: contrato, deploy y verificación end-to-end

**Objetivo:** el equipo de computación de Suspensiones CCS (Giovanni y compañía) quiere integrar monitoreo y control de los Centinela en su propia app, "a través de una API mía". Luis pidió construirla y dejarla clara: qué le entregan, qué NO, y cómo se protege el hardware. En paralelo: pulido del dashboard y limpieza de la BD.

**Hecho:**
- **Pulido del dashboard** (sesión previa a la API, mismo día lógico): quitados marcadores internos de roadmap (`I1`/`I2`/`I3.x`) y jerga de backend (`firmware`, `polling`, `n8n`, nombres de variable de entorno) de todo el copy visible — footers de Overview/Histórico/Control/Alertas, banner de modo demo, login. **Rename a "Centinela 01"** en título/demo/seed (y luego Luis corrió el `UPDATE` real en `devices.name`, verificado). **2 bugs reales encontrados y arreglados**: (1) el mapa Leaflet (Overview y `/mapa`) no renderizaba — el contenedor resolvía `height:100%` contra un padre `min-h-*` → colapsaba a `height:0`; fix `absolute inset-0`, confirmado por instrumentación CDP (`h:0→791px`, tiles `6→28`); (2) hydration mismatch del script anti-flash de tema (`suppressHydrationWarning` en `<html>`). Bandas de umbral de temperatura con opacidad graduada (antes casi invisibles). Verificado con Chrome headless vía CDP (captura en tema claro/oscuro, no solo `curl`).
- **Contrato de API v1** (`docs/api/CONTRATO-v1.md`): decidido con Luis — **flota completa** (no solo Centinela 01), cadencia **5 s** (calza con `TELEMETRY_PERIOD_MS`/`COMMAND_POLL_MS` del firmware; pedir más rápido solo re-lee la misma fila), **sin campos derivados** (se entrega lo esencial crudo), **control desde el día 1**, y **la interfaz queda de Luis** (la API da datos+control, no UI). Decisión de seguridad explícita: `power_cycle`/`reboot` **bloqueados a nivel de API** — ni con scope `control` se pueden mandar; quedan solo en el panel propio.
- **OpenAPI 3.1** (`docs/api/openapi-v1.yaml`) — validado con `redocly lint` (0 errores) — + página **Scalar** interactiva (`docs/api/index.html`, verificada por screenshot: navegación, auth de prueba, generación de cliente en 5 lenguajes).
- **Edge Function `api-v1`** (`backend/supabase/functions/api-v1/index.ts`, Hono+Zod+Deno): 8 endpoints (`GET /devices`, `/:id`, `/:id/latest`, `/:id/telemetry`, `/:id/events`, `/:id/commands`; `POST /:id/commands`; `PATCH /:id/config`). Auth `X-API-Key` deny-by-default (scope por unidad y por acción), errores RFC 9457, rate limiting, `power_cycle`/`reboot` rechazados con `403` aunque el payload sea válido. **Modo MOCK integrado** (`MOCK=1`) para probar sin tocar Supabase real — útil también como referencia para el equipo de computación.
- **Migración `0009_api_keys.sql`**: tabla de keys hasheadas (sha256), sin policies (solo la Function, vía `service_role`, la lee). Corrida por Luis en el SQL editor.
- **Deploy real**: instalado el CLI de Supabase (`brew install supabase/tap/supabase`), creado `backend/supabase/config.toml` (`verify_jwt=false` — la auth es la `X-API-Key` propia, no el JWT de Supabase), `supabase functions deploy api-v1`. **Desplegada en producción**: `https://ntqdrkbzntcfwwenawxy.supabase.co/functions/v1/api-v1`.
- **Key emitida** para "Computacion CCS" (flota `*`, scopes `read`+`control`, 30 req/min) — generada local con `openssl`, solo el hash insertado en la BD, la key cruda entregada fuera del repo (`.env.cs-team-key`, git-ignored).
- **Verificación end-to-end contra Supabase real** (11 escenarios `curl`, no solo el mock): sin key → 401, key inválida → 401, key OK → 200 con datos reales de Centinela 01 (temp 25.5°C, `status: offline`), `power_cycle` → 403 con RFC 9457, payload inválido → 400, unidad inexistente → 404.
- **Limpieza de BD**: 120 filas demo (`uptime_s=0`, sembradas por 0002) borradas vía Management API; verificado 0 restantes, 3752 lecturas reales.
- **Handoff armado y ENVIADO**: contrato (link artifact) + spec (`openapi-v1.yaml`) + URL base por correo; la API-key por WhatsApp aparte (canal separado, nunca junto al resto). Ambos mensajes confirmados enviados por Luis.

**Pendiente / próximo:**
- ⚠️ **Revocar el Supabase access token `sbp_...`** usado para el deploy (ya cumplió su función) — [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens). Sin confirmar aún.
- Confirmar que el equipo de computación efectivamente integra y les responde bien (primera llamada real de su lado) — ya tienen todo lo necesario, falta su parte.
- Seguir rotando los otros 2 secretos viejos expuestos en chat (anon key 10/7, `service_role` 20/7).
- `v2` de la API cuando haga falta: SSE/webhooks, evaluar `power_cycle`/`reboot` con auditoría fina.
- Dominio propio para la API (cosmético).

**Decisiones:** **D33** (API pública v1 — arquitectura, alcance, seguridad; ver MEMORY §3 para el detalle completo). Sin cambios de firmware/hardware esta sesión.

---

## 2026-07-20 (cierre 2) — Umbrales finales del fan + diagnóstico del piso PWM + estudio de control remoto + despliegue en calle

**Objetivo:** Luis pidió subir el umbral del fan (prendía muy frío), diagnosticar por qué giraba "muy rápido", dejar la unidad lista para auto-conectar, y estudiar si se puede editar el Centinela en remoto.

**Hecho:**
- **Umbrales del fan ajustados y flasheados** (varias iteraciones → final **`TEMP_OFF_C=30` / `TEMP_ON_C=40`** en `config.h`). Build completa (`GPS_ONLY=0`), compila limpio (70% flash), subida a `/dev/cu.usbserial-10` @115200 (⚠️ forzar `UploadSpeed=115200` vía FQBN; 921600 da "invalid head of packet"). Verificado por serial: 22 °C→`fan=0%`, GPS `fix=OK`, build completa.
- **Diagnóstico del fan "muy rápido"** → **D31**: no era firmware. Con los **vatios del EcoFlow** (0%→18W, 30%→23W, 50%→27W, 70%→33W, monótono) se probó que el PWM funciona bien y NO está invertido, pero el fan tiene un **piso físico ~3900 RPM / 16-19 W a 0% duty** que el software no puede bajar. El tach lee crosstalk (~741k = 25kHz×60÷2), inútil. La causa real del exceso: **Luis sobre-alimentaba el banco** (5V extra por MacBook + fans por otra entrada). Apagado total en frío = **cortar 12V con MOSFET** (pendiente; IRLZ44N repuesto + GPIO25).
- **Test aislado** `tests/fan_pwm_web` reflasheado y usado para la prueba de vatios; luego se restauró el firmware de producción.
- **Estudio de control remoto** (pedido de Luis): **YA existe** (I3.3/D27). `net.cpp::applyCommand` acepta `setpoint`/`fan_mode`/`reboot`/`power_cycle` vía poll de `commands` cada 5 s con `x-device-token`; los umbrales se editan en vivo desde `/control` **sin reflashear**. ⚠️ NO persisten reboot (RAM → vuelven a 30/40); OTA no existe (Fase 4).
- **Nombre de la unidad = Centinela** (Luis ya la llama así, desplegada en la calle, apagada por ahora; auto-conecta a `Rescate` cuando la enciendan, self-healing D22).
- **NVS de umbrales IMPLEMENTADO (D32)**: `net.cpp` `loadControl()`/`saveControl()` (namespace "control") → los `setpoint` de `/control` **persisten al reboot** en toda unidad con este firmware. Modo del fan NO persiste (fail-safe → AUTO al bootear). Compila limpio (70%). Centinela 01 NO estaba conectada por USB → queda con firmware viejo (30/40, sin NVS); el nuevo queda listo para el próximo flasheo.
- **Defaults de fábrica → 25/40** (`config.h`, para las próximas unidades). Luis quiere que la rampa empiece a los 25 °C.
- **Temp interna del ESP32** (`temperatureRead()`) agregada al **log serial** (`espC=`) como salud del MCU (die, sesgada alta, NO ambiente). Pipeline a BD/dashboard pendiente (R3).
- **Backlog de recomendaciones creado**: [`RECOMENDACIONES.md`](RECOMENDACIONES.md) con **R1** (alerta sobre-temp con fans saturados, pedida por Luis), **R2** (OTA para la flota — la respuesta real al "cambiar cualquier cosa en remoto"), **R3** (pipeline temp interna).
- **MOSFET de corte DESCARTADO**: Luis confirmó que el mínimo del fan le sirve → no se hará el apagado total en frío.

**Pendiente / próximo:**
- ⭐ **Reflashear Centinela 01** con el firmware NVS+25/40 **si Luis se cruza con ella** por USB; si no, se queda en 30/40.
- **R2 OTA** — siguiente gran paso para control remoto de código arbitrario en la flota.
- **R1** alerta de saturación térmica (regla en `deriveAlerts`).
- Afinar umbrales en vivo por `/control` según cómo enfríe en campo.

**Decisiones:** **D31** (fan: piso PWM ~3900 RPM; el "muy rápido" era sobre-alimentación del banco, no código) + **D32** (NVS de umbrales + defaults 25/40 + backlog R1-R3). Refuerza [[feedback-hardware-autonomy]].

---

## 2026-07-20 (cierre) — Primer apagón real en la calle validado + token del device + plan I6 (graceful offline)

**Objetivo:** Luis reportó que el Centinela 01 (montado en la calle) no aparecía activo en el dashboard publicado. Verificar si se está recibiendo señal desde algún dispositivo.

**Hecho:**
- **Diagnóstico de visibilidad:** la lectura anón está cerrada (0008) → el dashboard sin sesión recibe `[]` (`content-range: */0`, confirmado). Ver "vacío" ≠ "no llega data".
- **Verificación con `service_role`** (key efímera, no guardada): el device **SÍ reportaba impecable** — **3872 readings** (128 en la última hora), `last_seen` al día, temp **25.5°C**, fan 0%, **GPS 15–16 sats** moviéndose por Caracas (~10.461, −66.830), **RSSI −21 dBm**, uptime ~19 min, heap 221 KB. `events` y `commands` vacíos.
- **Causa del apagón:** apagaron la **EcoFlow** → cayó **Starlink** → cayó el **ESP32** (corte limpio, sin "goodbye"). El monitor en vivo (background, 6 min) confirmó silencio total tras `22:36:31Z`. **Primer end-to-end real en campo: la telemetría FUNCIONA.**
- **`device_tokens` estaba VACÍA** (nunca se corrió el insert de 0007) → **insertado** el token de `secrets.h` para `…0001` (upsert vía service_role, sin exponerlo). El panel de Control ya puede autenticar comandos; falta probarlo con el device online. **No afectaba la telemetría** (readings entra por `anon_insert`).
- **Planificado I6 — "último status conocido" (graceful offline)** a pedido de Luis (no implementado): tarjeta de cierre por centinela con hace-cuánto-se-apagó, última pos/temp, uptime de la sesión. Doc: [`plan-last-known-status.md`](plan-last-known-status.md). Insight: la última `reading` ya trae todo (`ts`≈apagado, `uptime_s`=sesión); el fix real es que `useTelemetry` solo trae 60 min → pedir también la última lectura sin ventana. Enganchado en `PLAN-INTERFAZ.md` §11 (I6) y MEMORY (roadmap + to-do).

**Pendiente / próximo:**
- Confirmar que el Control llega al hardware (probar un comando cuando el device vuelva online).
- Implementar I6 cuando toque (plan listo).
- ⚠️ **Rotar la `service_role` key** — Luis la pegó en el chat de esta sesión (además de la anón vieja pendiente).

**Decisiones:** sin decisiones nuevas numeradas. Refuerza [[dashboard-auth-wall]] (vacío = falta login / device apagado, no falta de data).

**Objetivo:** cargar y desplegar en la unidad "que tiene todo" (GPS + temp + fan) y conectarla al WiFi `Rescate`.

**Hecho:**
- **Build COMPLETA flasheada** (`GPS_ONLY 1→0`): compila limpio (70% flash), subida a `/dev/cu.usbserial-10` @115200. WiFi `Rescate` ya estaba en `secrets.h` (idéntico al que pasó Luis).
- **Diagnóstico por serial** (protocolo §7): al arrancar, de los 3 subsistemas solo respondía el fan (y en *fail-safe*). `temp=nan`, `GPS link=--`, `rpm` ruido. Patrón = **fallo de modo común** (alimentación/tierra), no sensores individuales malos.
- **Causa raíz: el pin 3V3 del header del ESP32 está físicamente dañado** (perdió el pad). Se resolvió cada periférico según su voltaje:
  - **GPS** → VCC a **5V/VIN** (no al 3V3 muerto) → `link=ok` al instante.
  - **DHT22** → VCC alimentado desde **GPIO32 en HIGH** ("3.3V de repuesto", ~1.5mA ≪ 40mA máx/pin; **D28**), DATA en GPIO4. Tras confirmar VCC=3.3V y **GND común**, lee **29.2°C**.
- **Lazo temp→fan validado en vivo**: a 29.2°C el fan queda en **59%** = exactamente la banda proporcional (`30% + (29.2−27)/(30−27)×(70−30)`), no el 70% de fail-safe. El control por temperatura **cierra en hardware**.
- **Telemetría viva**: `WiFi=ok · ntp=ok · post=ok` a Supabase. **Resuelta la contradicción D28/D29**: la build flasheada es la COMPLETA (no solo-GPS).
- **Autoevaluación de cierre** (nuevo paso §0.1): borré 11 `.DS_Store` (git-ignored), moví 2 archivos sueltos de la raíz a carpetas nuevas (`docs/referencias/`, `hardware/fotos/`) + actualicé referencias.

**Pendiente / próximo:**
- **Tach (RPM) lee ruido** (~735k, crosstalk del PWM 25 kHz en GPIO27) — cosmético; pull-up 3.3V firme al amarillo + separarlo del azul.
- **Prueba con yesquero** para ver el fan subir al tope 70% y bajar a 0%.
- ⚠️ **Restaurar umbrales reales 55–60°C** antes de producción (hoy 30/27 de banco).
- ⚠️ Riesgo residual del truco GPIO-como-3.3V: ~3.2–3.3V al filo del mínimo del DHT22 → a futuro tomar 3.3V del regulador AMS1117 o reparar el pad del 3V3.
- Firmware sin commitear (`config.h`: `GPS_ONLY=0` + `PIN_DHT22_PWR=32`; `firmware.ino`: power-pin HIGH en setup).

**Decisiones:** valida **D28** (build completa + reparación del DHT22) en hardware; sin decisiones nuevas numeradas. **Protocolo de cierre**: se agregó el paso **5 — Autoevaluación del workspace** a CLAUDE.md §0.1 (pedido de Luis: proponer mejoras de orden/estructura/eficiencia y aplicar directo las no invasivas).

---

## 2026-07-19 (noche) — Fan PWM (D26): control por velocidad, gestión de corriente y prueba en hardware

**Objetivo:** cerrar el subsistema del ventilador. Luis aclaró que su fan es **PWM de 4 hilos
(12V, ~2.7A)** — no el fan simple de 2 hilos que asumía el driver MOSFET (D19).

**Hecho:**
- **Rediseño del fan a 4-hilos PWM (D26)**: se **elimina el MOSFET IRLZ44N** del fan (el fan trae
  driver interno). El ESP32 solo manda **velocidad** por el hilo azul (PWM 25 kHz, GPIO26) y lee
  **RPM** por el amarillo (tach, GPIO27). Firmware: `applyFanControl` pasa de on/off a **banda
  proporcional** con piso + tach por ISR + guard de API LEDC (`ESP_ARDUINO_VERSION_MAJOR`, core
  2.0.14). El control va **directo del pin al fan** (la señal es µA); la potencia (2.7A) nunca toca
  el ESP32.
- **Gestión de corriente para 2 fans**: el jack del EcoFlow da 6.9A pero el **conector DC 2.1mm
  aguanta 5A**; 2 fans a tope = 5.4A → se **capa el duty a `FAN_MAX_DUTY=70%`** (≈4.1A peor-caso
  lineal, real ~3–3.3A) + **soft-start** anti-inrush. Ambos fans comparten GPIO26 (entrada alta-Z).
- **Colores confirmados** por Luis (rojo+negro a 12V → gira a full): rojo=+12V, negro=GND;
  azul=PWM, amarillo=tach.
- **Esquemas C y F actualizados** (2 fans, tope de corriente, **pin-por-pin** en F §3) y **verificados
  por render** con Chrome headless. Label del fan en el SVG de F corregido (ya no dice MOSFET).
- **Prueba en hardware ✅**: sketch standalone con **interfaz web** (el ESP32 crea el AP `FanTest`
  → slider en `http://192.168.4.1`, arranca en 30%, soft-start, tope 70%). El fan **gira y responde
  al PWM**; tach lee **~2200 RPM @ 30%**. El `rpm=0` inicial era **GND no común** entre EcoFlow y
  ESP32; al unirlo, todo OK.
- **Carpeta `tests/` nueva** (a pedido de Luis): sketches + guías de pruebas aisladas.
  `tests/README.md` (índice + convención) y `tests/fan_pwm_web/` (`fan_pwm_web.ino` + `GUIA.md`).

**Pendiente / próximo:**
- Prueba de **conmutación por temperatura** (yesquero, DHT22, umbral 30/27°C) — el control de
  velocidad ya quedó validado; falta cerrar el lazo temp→fan.
- **Medir la corriente real** de los 2 fans en el Nodo +12V (multímetro) y ajustar `FAN_MAX_DUTY`.
- Rehacer el **KiCad `fan-driver`** (quedó desactualizado con el MOSFET viejo).
- Fans **definitivos** los compra mecánica → revalidar si cambian de modelo.

---

## 2026-07-19 (tarde) — Hub del depto en Notion + diagrama de arquitectura + MCP de Figma

**Objetivo:** Rogelio y Giovanni Ruiz piden estructurar el "departamento" improvisado de
Eléctrica/Electrónica (Kanban, responsabilidades, proyectos, gastos) en Notion; por separado,
piden un Figma del proyecto para presentarlo al jefe.

**Hecho:**
- **Hub departamental en Notion** (workspace aparte "Electronica - Suspensiones Caracas",
  separado de NodIA): 4 bases de datos enlazadas por relación DUAL a Proyectos — Tareas
  (Kanban por Estado), Gastos/Compras, Bitácora. Rollups de gasto total y nº de tareas.
  Sembrado con datos reales: **P1 · Telemetría ESP32**, **30 gastos = $184.80** (fusión de
  `docs/compras-electronica.csv` + `docs/PRESUPUESTO.csv`, verificado por SUM), **15 tareas**
  del roadmap repartidas Rogelio (firmware/backend/dashboard) / Giovanni (hardware/compras).
  Vistas: Tablero Kanban, Por responsable, Calendario, Por estado/categoría, Cronología.
  Dashboard home con callout de misión, tabla de responsabilidades y las 4 BDs embebidas.
- **Diagrama de arquitectura para presentar**: `docs/informes/F_arquitectura.svg` (detallado:
  flujo de telemetría + energía D23 + carga D24/D25 en un solo lienzo) + `F_arquitectura.html`
  (presentación, chips de estado, abierto en el navegador) + `F_arquitectura_simple.svg`
  (~39 elementos, para arrastrar a Figma sin fricción). Agregado a `docs/informes/index.html`.
- **MCP "Talk to Figma" instalado** (a pedido explícito de Luis, para que Claude edite Figma en
  vivo): `bun` instalado, repo `sonnylazuardi/cursor-talk-to-figma-mcp` clonado en `~/tools/`,
  servidor MCP registrado en Claude Code (`TalkToFigma`, verificado "Connected"), servidor
  WebSocket local probado end-to-end en `:3055`. ⚠️ Bug encontrado y evitado: el script `bun
  socket` del repo falla (`bun: command not found`) por resolución de PATH — usar
  `bun run src/socket.ts` directo. Luis instaló el plugin de Figma y confirmó conexión.

**Pendiente / próximo:**
- ⚠️ **Cerrar la conexión del MCP de Figma**: los MCP solo cargan al arrancar Claude Code — falta
  reiniciar y pasar el **Channel ID** del plugin en la próxima sesión para que Claude haga
  `join_channel` y edite el archivo de Figma en vivo (crear/ajustar el diagrama como frames reales).
- Confirmar que Giovanni ve el hub de Notion (permisos de la página raíz).
- Ajustar con Giovanni el reparto de responsabilidades en la tabla del dashboard home.

**Decisiones nuevas:** D30 en [MEMORY.md §3](../MEMORY.md).

---

## 2026-07-19 — Diagnóstico "no veo el device en la app" + aplicar 0007/0008 + hardening

**Objetivo:** Luis reporta que la unidad está andando con código pero no la ve en el dashboard.
Verificar dónde se corta el flujo ESP32 → Supabase → Vercel, o decir qué hacer.

**Hecho:**
- **Diagnóstico completo del flujo** (todo por curl a la REST de Supabase + inspección del bundle
  desplegado): el ESP **SÍ reportaba perfecto** — 3208 readings, `devices.last_seen` al día,
  con `temp_c`/`fan_duty`/GPS/`rssi` reales. **Vercel bien configurado**: URL, anon key y
  `device_id` horneados en el bundle son **idénticos** a `.env.local`, y la key desplegada leía
  62 filas en la ventana de 60 min. → Ni telemetría, ni Supabase, ni Vercel eran el problema.
- **Causa raíz encontrada: el `AuthGate` de I3** (`Providers.tsx`) — en modo live exige sesión
  para ver cualquier pantalla salvo `/login`, y **no había ninguna cuenta creada** (`profiles`
  vacío) → redirección a `/login`, Overview nunca visible. El gate solo pide **sesión** (no rol),
  así que con cualquier login se ve el Overview.
- **Luis creó 2 usuarios admin** desde la interfaz → login resuelto (no hizo falta service_role).
- **Endurecí `0008_lock_anon_reads.sql`**: ahora re-garantiza (idempotente) las policies
  `authenticated_read_*` ANTES de dropear las `anon_read_*` → el panel logueado no puede quedar
  vacío aunque 0001 estuviera parcial. Ya no hace falta el "verificar primero".
- **Luis corrió 0007 y 0008** en el SQL editor. **Verificado por curl**: lectura anón de
  readings/devices/events = `[]` (cerrada 🔒); INSERT de telemetría intacto (HTTP 400 por body
  incompleto, no 401/403 → RLS pasó, solo faltó `ts`). BOLA de lectura (D13) cerrado.

**Hallazgos colaterales:**
- ⚠️ **El ESP se calló ~18:39Z del 2026-07-18** (uptime 3091s ≈ 51 min y luego silencio) — offline
  por power/WiFi, no por el dashboard. Revisar en campo.
- **120 filas demo** (`uptime_s=0`, sembradas 2× por 0002) ensucian el histórico → se dio el
  `delete from public.readings where uptime_s=0` (pendiente correr).
- **Inconsistencia con D28**: `config.h` actual tiene `GPS_ONLY=0` y la telemetría incluye
  temp/fan → esta unidad corre la build COMPLETA, no la "solo-GPS" que dice D28. Confirmar.

**Pendiente/próximo:**
- Revisar por qué el ESP dejó de postear (power/WiFi/rango de `Rescate`).
- Confirmar en el dashboard **logueado** que el Overview muestra datos (única verificación posible
  ya que la lectura anón quedó cerrada).
- Correr el DELETE de las filas demo; insertar el token del device si no se hizo con 0007.
- Rotar la secret key de Supabase (sigue pendiente del 2026-07-10); 0009 para gatear el INSERT.

**Decisiones nuevas:** D29 (diagnóstico login-wall + 0007/0008 aplicadas + BOLA de lectura cerrado).

---

## 2026-07-18 — I3 (Auth + Control real) + I4 (Alertas + PWA) — dashboard entregable completo

**Objetivo:** cerrar I3 con el modelo de acceso que eligió Luis (todo tras login + roles),
hacer que el panel de Control mueva el hardware de verdad (no solo la UI), y sumar I4
(alertas + app instalable) para tener el dashboard "terminado" y pasarle la API al equipo.

**Hecho:**
- **I3.1 — Auth**: contexto de sesión (`lib/auth.tsx`, bypassa en modo demo), gate de rutas
  (`Providers`/`AuthGate`, redirige a `/login` sin sesión), página de login (sign in/up), roles
  `viewer`/`operator`/`admin` vía tabla `profiles` + funciones `is_operator()`/`is_admin()`
  (migración `0005`). Verificado end-to-end: Luis se logueó y confirmó rol `admin`.
- **Gestión de usuarios desde la interfaz** (pedido explícito de Luis, no estaba en el plan
  original): página `/usuarios` (admin-only, pestaña visible solo para admin) con tabla de
  perfiles y selector de rol inline (migración `0006`, policy `admin_update_profiles`). Flujo:
  nuevos usuarios se auto-registran en `/login` (quedan `viewer`) y el admin los promueve ahí.
  Crear cuentas por terceros (con clave, sin auto-registro) requeriría una Edge Function con
  `service_role` — no se hizo, queda anotado como límite conocido.
- **I3.3 — Panel de Control**: página `/control` (gateada a `operator`) con fan mode
  (Auto/On/Off), setpoint (histéresis), edición de umbrales de alarma, power-cycle Starlink y
  reboot (con confirmación), y **log de comandos en vivo** con estado de ack. `viewer` ve el log
  en solo lectura.
- **I3.2 — El firmware CONSUME los comandos de verdad** (antes el panel solo escribía en la
  tabla `commands`, nada los aplicaba): se le dio a la unidad un **token propio**
  (`x-device-token`, migración `0007`, tabla `device_tokens` + `device_token_ok()`/
  `device_id_from_token()` security-definer) para leer/confirmar SUS comandos sin depender del
  acceso `anon` amplio. `net.cpp::pollCommands()` hace GET de pendientes cada 5s, aplica
  (`fan_mode`→`netFanMode()`, `setpoint`→`netTempOn/Off()`, `reboot`→ack primero y luego
  `ESP.restart()` para no entrar en bucle) y confirma con PATCH `ack_ts`. `applyFanControl`
  en `firmware.ino` ahora respeta el modo remoto antes de caer a la banda proporcional
  automática. **Compila limpio (70%)**. El ESP estaba desconectado de la Mac al momento del
  build → **queda flasheado el código, pendiente de subirlo** la próxima vez que esté a mano
  (Luis luego confirmó por su cuenta "ya probé que sí funciona", en una sesión de flasheo propia).
- **Cierre del BOLA de lectura**: migración `0008` (separada de `0007` a propósito — la 0007 es
  aditiva/riesgo-cero, la 0008 hace el `DROP` de las policies `anon_read_*` de 0002 como paso
  deliberado y verificable, con un re-guarantee idempotente de las policies autenticadas antes
  de tocar nada). El INSERT de `readings` sigue con `anon` (telemetría) — gatearlo también queda
  para una `0009` futura.
- **I4 — Alertas**: `lib/alerts.ts::deriveAlerts()` deriva alertas activas del estado en vivo
  (sobre-temperatura por umbral warn/serio/crít, enlace offline/intermitente, sin fix GPS,
  batería baja) — sin esperar a que nada las escriba, se calculan del último `reading` +
  `linkState`. Página `/alertas` (activas + bitácora `events` en vivo, lista para que
  n8n/firmware empiecen a escribir ahí) + banner de la alerta más severa en el Overview.
- **I4 — PWA**: `manifest.ts` (instalable, `standalone`), iconos PNG generados con Pillow
  (192/512/512-maskable/apple-touch), service worker **deliberadamente mínimo** (`sw.js`: NO
  cachea requests normales — solo intercepta navegaciones fallidas y sirve `offline.html` — para
  no arriesgar servir contenido viejo de un dashboard que vive de datos en vivo).
- **Deploy**: cada sub-entrega (I3.1, gestión de usuarios, I3.3, I3.2+backend, I4) se commiteó y
  empujó por separado; el auto-deploy (webhook, ver D21) llevó cada una a producción y se
  verificó por HTTP que las rutas nuevas respondieran 200 antes de seguir.
- **Nombre de la unidad**: Luis pidió ideas para nombrar el chip antes de meterlo en la cajita
  3D. Se dieron opciones técnicas reales (RTU/*Remote Terminal Unit*, TCU/*Telematics Control
  Unit*, RMU/*Remote Monitoring Unit*) + nombre propio (Centinela/Vigía/Baliza). **Sin decidir**
  — Luis no respondió esa parte antes de pasar a "seguimos con el siguiente paso".

**Pendiente / próximo:**
- ⚠️ **Correr `0007_device_token.sql` y `0008_lock_anon_reads.sql`** en Supabase — verificado
  al cierre de esta sesión que **ninguna de las dos corrió** (`device_tokens` da 404 vía REST;
  la lectura `anon` de `devices` sigue en 200). Sin esto, enviar un comando desde `/control` no
  mueve el hardware (el firmware no puede autenticar el polling).
- Insertar la fila de `device_tokens` con el token real (vive en `firmware/secrets.h`, no en el
  repo) — instrucción exacta dejada en `MEMORY.md` §6.
- ⚠️ **El ESP32 no está posteando** al cierre de esta sesión (última lectura con horas de
  atraso) — verificar en campo si es de red (el self-healing debería reconectarlo solo) o quedó
  desconectado de energía otra vez.
- Decidir el nombre final de la unidad (pendiente de esta sesión, ver arriba).
- I5 (integraciones Starlink/EcoFlow/power-cycle real) es lo próximo del roadmap de interfaz.
- Se detectó (por notas de sistema, no por trabajo propio de esta sesión de chat) que el
  firmware evolucionó en paralelo a un **build de flota** (`GPS_ONLY` en `config.h`: esta unidad
  hoy corre en perfil RTU-solo-GPS, sin DHT22/fan activos) y se reparó el VCC del DHT22 (pin 3V3
  físicamente dañado → alimentado desde GPIO32). Documentado como **D28** en `MEMORY.md` a
  partir de lo que dice el código; no hay contexto de sesión para el "por qué" completo —
  confirmar con Luis si falta algo.

**Decisiones nuevas:** D27–D28 en [MEMORY.md §3](../MEMORY.md).

---

## 2026-07-15/16 — Hardware comprado, KiCad instalado, y el subsistema de carga rediseñado a 100% autónomo

**Objetivo:** cerrar la compra de hardware con un informe de gastos, producir esquemáticos
profesionales en KiCad, y terminar de definir el subsistema de control de carga del EcoFlow.

**Hecho:**
- **BOM mapeada por subsistema** (A–E) sobre el listado ya comprado, con recomendaciones de
  arquitectura de energía (USB-C+PD trigger vs. jack directo; hub USB descartado) y alternativas
  de MOSFET cuando el IRLZ44N escaseaba localmente (IRLZ34N, IRLB8721, IRL540N).
- **Informe de gastos** (`docs/informes/E_informe-gastos.html`, nuevo, mismo sistema visual que
  C/D): cruce de la hoja de compras del usuario contra la BOM planificada. Total real **$184.80**
  (29 ítems). Alertas encontradas: **DHT22 comprado 2 veces** (4 unidades, revisar si es multi-punto
  o error), estado desactualizado del IRLZ44N, LM2596/trimmer/módulo de carga sin asignar en la
  BOM original.
- **Esquemas C/D verificados de verdad**: renderizados con Chrome headless (no a ciegas) →
  se encontraron y corrigieron **3 bugs reales** en el esquema D (colisión de texto GPIO34/título,
  1N4007 cortado fuera del canvas, cable de la bobina del relé sin conectar a ningún nodo).
- **KiCad 10.0.4 instalado** (Homebrew cask; 1er intento falló por timeout de red, 2do por sudo
  interactivo — se le pidió al usuario correrlo él mismo). Se generaron **2 esquemáticos KiCad
  reales** (`docs/kicad/fan-driver/`, `docs/kicad/carga-relay/`) con un script Python que extrae
  los símbolos exactos de la librería estándar de KiCad, arma el `.kicad_sch`, y lo valida con
  `kicad-cli sch erc` (0 errores) + exporta SVG + captura de pantalla para revisión visual. En el
  camino: bug de inversión del eje Y al posicionar símbolos, y un pin del divisor sin conectar —
  ambos corregidos y re-verificados.
- **D23 — Energía**: pivote de USB-C+PD trigger a **jack 12V DC directo** del EcoFlow (el usuario
  confirmó que su EcoFlow da 12V por jack sin negociación) → ZY12PDN descartado, LM2596 se queda
  para el ESP32. "Y" en bornera: fan directo al riel + buck 5V al ESP32.
- **D24 → D25 — Subsistema de carga, iterado 2 veces**: primera pasada (D24) cerró umbrales
  13.5/13.0V, XL4016 a CC≈3A, sense post-fusible y un jumper de bypass para el "deadlock"
  (si el EcoFlow se vacía, el ESP32 que lo controla se queda sin energía y no puede reactivar la
  carga). El usuario objetó correctamente: **¿por qué tiene que controlar el ESP32 la carga de la
  batería?** — el diseño se rehzo por completo (D25): el control pasa a ser **100% autónomo**, a
  cargo del módulo comprado (fila 29 de la compra), alimentado directo de la batería de la moto
  vía llave ACC. El ESP32 queda degradado a **telemetría pasiva** (2 divisores → GPIO34 `vbat_v` +
  GPIO35 `charge_on`, sin GPIO25 ni control). El deadlock desaparece de raíz. El esquema D fue
  **reescrito completo** con la nueva arquitectura, tabla "qué componente hace qué", y una sección
  nueva de **procedimiento de calibración exacto** (banco de pruebas con el ZY12PDN+LM2596 como
  "batería falsa" ajustable 12–14.5V, cómo medir continuidad en el contacto seco del relé sin
  riesgo, cómo identificar cuál trimmer hace qué).
- **Foto del módulo analizada**: relé SONGLE SRD-12VDC-SL-A (10A/30VDC) + 2× trimmer W203 + LM393
  sin display → compatible con función VSR, pero falta la prueba física (dirección de la lógica)
  para confirmarlo.
- **Higiene**: `.gitignore` ampliado para artefactos de KiCad (`*.kicad_prl`, `~*.lck`,
  `.history/`) — se detectó que un plugin de VSCode había creado un **repo git anidado** dentro de
  `docs/kicad/carga-relay/.history/`, que habría corrompido un `git add -A` futuro.

**Pendiente / próximo:**
- ⚠️ **Prueba física del módulo** (la más importante): confirmar dirección de la lógica y calibrar
  ON 13.5V / OFF 13.0V con el procedimiento del esquema D §05. Sin esto no se puede cerrar el
  diseño ni rehacer el KiCad `carga-relay`.
- Armar la "Y" del jack (energía, D23) — sin riesgo, se puede hacer ya.
- `firmware/charge.{h,cpp}` pasivo (lectura GPIO34/GPIO35), pines a `config.h`.
- Identificar amperaje real de los fans instalados vs. los definitivos (los compra mecánica).
- Probar que el EcoFlow acepte 3A sin ciclar (su entrada pide ~6.9A medido EcoFlow→EcoFlow).
- Nada pendiente de compra para el subsistema de carga — todo con lo que ya se tiene.
- Se detectaron cambios en `dashboard/src/app/alertas/` y archivos relacionados **no generados en
  esta sesión** (probable trabajo en paralelo del usuario en I4) — no tocados, quedan para que el
  usuario los retome.

---

## 2026-07-13 (tarde) — Deploy Vercel + I2 (Histórico/Mapa/CSV) + API endurecida + firmware self-healing

**Objetivo:** dejar la app entregable para el equipo de programación: desplegada, con
histórico/mapa/CSV, la API documentada, y el ESP32 reportando de forma robusta.

**Hecho:**
- **Temperatura recalibrada** a T° de **aire interior** (el DHT22 mide aire, no superficie):
  umbrales **33/40/46** (antes 50/60/70). Centralizados (`thresholdsOf`), etiquetas "T° aire",
  mock reescalado. Migración `0003` aplicada en Supabase.
- **API para el equipo** (`docs/API.md`): contrato completo (tablas/unidades/ingesta/lectura/
  Realtime). Contrastado con la skill **`api-builder`** → agregado: errores reales de PostgREST
  `{code,message,details,hint}` + tabla HTTP/SQLSTATE, seguridad OWASP (anon = **BOLA A01** +
  sin rate-limit **API4**), y roadmap de la capa Edge (RFC 9457, Zod al borde, deny-by-default).
- **Deploy en Vercel** (por API, no había GitHub App): corregido **framework=nextjs** (daba 404 al
  no detectar Next) y **desactivada la Deployment Protection** (SSO) → público. **En producción**:
  https://suspensiones-esp32-telemetria.vercel.app
- **I2 — Histórico + Mapa + CSV**: navegación por pestañas; `/historico` (rangos 1h/6h/24h/7d,
  stats mín/prom/máx, series temp+bandas/velocidad/RSSI/potencia, **export CSV**, tabla) y `/mapa`
  (pantalla completa con trail). Hook `useHistory` con downsampling. Build/lint/typecheck limpios.
- **Auto-deploy sin GitHub App**: **Deploy Hook de Vercel** + **webhook de GitHub** (push→hook→build).
  No depende del token (persiste si se revoca). ⚠️ Requirió corregir el **email de git** a un
  `noreply` asociado a GitHub (el `@usb.ve` no se asociaba → Vercel bloqueaba el build). Ver **D21**.
- **Firmware self-healing (D22)**: **bug de campo** — tras un reboot con la red no disponible en
  25s, el ESP caía al **portal bloqueante para siempre** (`WiFi=PORTAL`, dejaba de reportar). Con
  credenciales ahora **reintenta la red por siempre** (vuelve solo, sin resetear). Compilado +
  **reflasheado**. Confirmado por serial: ya no entra a portal.
- **`bfix` diagnóstico ESP**: por serial se vio `WiFi=PORTAL post=nunca` (estaba atascado). Última
  lectura en Supabase 19:04 UTC; tras el fix reintenta pero **`Rescate` no está en rango ahora**
  → cuando la red reaparezca, conecta y postea solo.

**Pendiente / próximo:**
- ⚠️ **`Rescate` fuera de rango**: verificar que la red esté encendida/cerca del ESP (o re-provisionar).
- ⚠️ **Revocar el token de Vercel** (ya no hace falta: el auto-deploy es por hook, no por token).
- **Watchdog** (Fase 4): el self-heal cubre WiFi/red, pero un cuelgue de tarea aún necesitaría WDT.
- Arrancar **I3**: control (fan auto/manual, setpoint) + **Auth + RLS por dueño + token por device**
  (cierra el BOLA de la API).

**Decisiones nuevas:** D21 (auto-deploy webhook + email git), D22 (firmware self-healing) en [MEMORY.md §3](../MEMORY.md).

---

## 2026-07-13 — Arquitectura de energía + BOM + esquema visual + subsistema de control de carga

**Objetivo:** cerrar cómo se alimenta y se conmuta el hardware, dejar la lista de compras y un
mapa de conexiones; plantear el nuevo subsistema que regula la carga moto→EcoFlow.

**Hecho:**
- **Energía por un solo USB-C** (D18): el Type-C del EcoFlow da 12V PD nativo → **PD trigger
  ZY12PDN** fija 12V (fan directo del riel) + **buck MP1584** 12V→5V para el ESP32 (por VIN).
  Se evaluó y descartó el booster; el EcoFlow expone USB 5V-2A, Type-C 5/9/12/15V-3A y QC 3.0.
- **Driver del fan = IRLZ44N pelado** (D19): + 220Ω gate + 10k pulldown (fail-safe) + 1N4007.
  **Descartados:** módulo MOSFET opto-aislado (**$80**, sin stock → no rentable) y **módulo
  IRF520** (no es logic-level: Vgs(th) 2–4V → no satura a 3.3V de gate, el fan podría no arrancar).
  No hace falta aislamiento: fan y ESP32 comparten el mismo 12V limpio.
- **Nuevo subsistema — control de carga del EcoFlow (LVD con histéresis)** (D20): ESP32 lee
  **VBAT por divisor 100k/22k a ADC1 (GPIO34)** con clamp Zener 3.3V + RC, y controla un
  **relé Bosch 5-pin 12V 40A** (vía IRLZ44N, GPIO25) en serie con la entrada del **XL4016**.
  Histéresis + debounce ~3s. ⚠️ Umbrales a fijar con datos reales (≈corta 13.0 / reanuda 13.6).
  Se registrará en telemetría para el estudio de eficiencia RPM/amperaje.
- **BOM consolidada** en `docs/PRESUPUESTO.csv` (18 ítems por comprar, cantidades unificadas por
  valor, + "ya se tiene" + descartados) y **esquema visual** del núcleo ESP32 en
  `docs/informes/C_esquema-nucleo-esp32.html` (SVG, rieles por color, tabla de conexiones + BOM).
- **Manual C** §3.1 enlaza el esquema HTML; timestamp a 2026-07-13.

**Pendiente / próximo:**
- **Comprar** los componentes (completar precios/lugar/link en `PRESUPUESTO.csv`).
- **Definir umbrales reales de VBAT** a distintas RPM; crear `firmware/charge.{h,cpp}` + pines
  (GPIO34/25) en `config.h` + columnas `vbat_v`/`charge_on` en `readings`.
- Agregar al esquema la vista del subsistema de carga (relé + sense + XL4016).
- ⚠️ Sigue pendiente: **rotar la secret key** de Supabase; **soldar** sensores + probar fan con
  yesquero; **restaurar umbrales reales** del fan (55–60°C) antes de producción.
- ⚠️ El artefacto en claude.ai no scrolleaba bien para Luis → se entregó **HTML local** en el repo.
- Nada commiteado esta sesión (a pedido; ver flujo de commits en hitos).

**Decisiones nuevas:** D18–D20 en [MEMORY.md §3](../MEMORY.md).

---

## 2026-07-12 — WiFi conectado + telemetría end-to-end viva + pruebas de fan/GPS

**Objetivo:** dejar el ESP32 listo para soldar y probar la lógica (temp→fan) en hardware;
conectar el WiFi; mejorar el mapa del dashboard.

**Hecho:**
- **Cableado definido** (para soldar): DHT22 DATA→**GPIO4** (VCC 3.3V), GPS TX→**GPIO16** /
  RX→**GPIO17** (VCC 5V/VIN, TX 3.3V-safe), control del fan = **2 cables: GPIO26 (señal) + GND**
  (van al driver aún por definir). El ESP32 nunca toca los 12V.
- **WiFi CONECTADO** ✅ (red `Rescate`, 2.4 GHz): hardcodeado en `secrets.h` (`WIFI_SSID/PASSWORD`).
  Se **invirtió la prioridad** en `net.cpp::loadCreds()` → el pre-seed de `secrets.h` gana sobre
  la NVS (antes una clave errada guardada por el portal bloqueaba la conexión). Ver **D16**.
- **Telemetría end-to-end viva:** `WiFi=ok -50dBm · ntp=ok · post=ok` cada 5 s → Supabase.
  **GPS con fix real** `sat=5 pos=10.4558,-66.8431` (Caracas). **DHT22 real** ~24.5°C.
- **Umbrales de fan bajados para prueba de banco** (yesquero, ambiente ~25°C): 60/50 → 35/30 →
  **30/27** (ON/OFF, banda 3°C). Comentado en `config.h` que son valores de PRUEBA (subir en prod).
- **Dashboard — mapa arreglado:** los tiles oscuros de CartoDB no cargaban (mapa "vacío" aunque
  daba coordenadas). Cambiado a **OpenStreetMap** estándar + más reintentos de `invalidateSize`.
  `LocationPanel` ahora muestra **Latitud/Longitud numéricas** y el mapa aparece con **solo** tener
  lat/lng (ya no exige ≥4 sat); coordenadas superpuestas + aviso "señal débil". Zoom control ON.
- Limpieza de comentarios viejos en `firmware.ino` (decían "simulado/DS18B20" → ya es DHT22 real).

**Pendiente / próximo:**
- **Soldar** DHT22 + GPS + los 2 cables del fan; confirmar modelo del GPS para cerrar VCC (5V vs 3.3V).
- **Probar conmutación del fan** con yesquero: a 30°C el tester debe marcar ~3.3V en GPIO26, 0V bajo 27°C.
- Opcional dashboard: vista **satélite Esri** (look Google, sin API key) si se quiere más visual.
- ⚠️ **Rotar la secret key** de Supabase (quedó en chat del 10). Todo el trabajo sigue **sin commitear**.
- ⚠️ Antes de producción: **restaurar umbrales reales** (55-60°C) en `config.h`.

---

## 2026-07-11 — Cierre: toolchain resuelto + reconciliación de docs

**Hecho:**
- ⚠️ **Workaround del core ESP32 (importante):** la **3.x da HTTP 500** al bajar el toolchain
  (servidor de Espressif); se instaló **`esp32:esp32@2.0.14`** → **compila limpio**
  (flash 20%, RAM 6%, 0 warnings). Si 3.x vuelve a fallar, usar 2.0.14.
  Board = ESP32-WROOM DevKit (chip **CH340**, `/dev/cu.usbserial-110`); upload con `UploadSpeed=115200`.
- **Docs reconciliados** (protocolo de cierre): pinout y BOM `DS18B20`→**`DHT22`** (sensor actual);
  quitados to-dos duplicados/obsoletos (flasheo y "crear Supabase" ya estaban hechos).

**Pendiente:** todo el trabajo del 10/11 (dashboard, backend, `net`/`temp`) sigue **sin commitear** (a pedido).

---

## 2026-07-10/11 — Interfaz I0+I1 + Telemetría Fase 2 (WiFi/portal) + DHT22

**Objetivo:** arrancar la interfaz (paso 1 del plan) y avanzar la telemetría del ESP32.

**Hecho:**
- **Backend (I0):** esquema Supabase `backend/supabase/migrations/0001_init.sql`
  (devices/readings/commands/events + enums + RLS + realtime + trigger `last_seen`) y
  `0002_mvp_public_access.sql` (acceso `anon` MVP para leer/insertar + 60 filas demo).
  **Aplicado en el proyecto real** `ntqdrkbzntcfwwenawxy`.
- **Dashboard (I1):** app Next.js 16 + TS + Tailwind v4 en `dashboard/`. Overview con
  tira de testigos (temp/fan/GPS/batería/potencia/enlace), gráfica de temperatura con
  bandas de umbral + bandas de fan-ON (un solo eje), timeline del fan, mini-mapa (Leaflet),
  header con estado de enlace, tema claro/oscuro y degradación offline. Hook `useTelemetry`
  (realtime Supabase, con **fallback a mock** si no hay backend). **En vivo** (`.env.local`).
  Build/lint/typecheck limpios; verificado por screenshot.
- **Firmware Fase 2:** módulo `net.{h,cpp}` — WiFi + HTTPS POST a Supabase en **tarea
  FreeRTOS (core 0)** para no bloquear el `loop()` (GPS); WiFi con backoff; `ts` sellado por
  NTP; **portal cautivo** de configuración WiFi (AP `SuspensionesP1-XXXX`, creds en NVS),
  con escaneo cacheado, campo manual y pre-seed opcional vía `secrets.h`.
- **Firmware sensores:** módulo `temp.{h,cpp}` (DHT22, Adafruit DHT lib). `HAS_TEMP_SENSOR=1`,
  PIN_DHT22=4. Guarda NaN → envía `null` si el sensor no está conectado. Buffer RX del GPS a 1024.
- **Hardware/flasheo:** compila sin warnings; **flasheado** a `/dev/cu.usbserial-110`
  (⚠️ con `UploadSpeed=115200`; 921600 falla por ruido serial). Serial confirma
  **GPS con fix** (`sat=5`, coords de Caracas) y DHT en NaN (aún sin cablear).

**Pendiente / próximo (al retomar):**
- ⛔ **Conectar el ESP32 a un WiFi 2.4 GHz** (queda en `PORTAL`). Opciones: hardcodear en
  `firmware/secrets.h` (descomentar WIFI_SSID/PASSWORD) y reflashear, o completar el portal.
- Cablear el **DHT22** (VCC→3.3V, DATA→GPIO4, GND→GND) → temperatura real.
- Comprar **driver del fan** (MOSFET IRLZ44N recomendado, o módulo relé 3.3V) + diodo 1N4007
  + fuente 12V. El firmware ya maneja el on/off en GPIO26.
- ⚠️ **Rotar la secret key** de Supabase (se expuso en el chat).
- Borrar filas demo cuando entre telemetría real: `delete from public.readings where uptime_s=0;`
- Siguientes fases interfaz: I2 (mapa completo + histórico + CSV), I3 (control + Auth), I4 (alertas/PWA).

**Decisiones nuevas:** D10–D15 en [MEMORY.md §3](../MEMORY.md) (stack dashboard, mock, tarea
FreeRTOS de telemetría, acceso anon MVP, no reportar simulados, portal de provisioning).

---

## 2026-07-09 — Scaffold inicial + GPS + toolchain (pre-interfaz)

- Repo independiente + GitHub privado; skills mapeadas (CLAUDE.md §9).
- Toolchain **arduino-cli** + estructura `.ino` (D7). GPS del equipo integrado como
  **módulo no bloqueante** `gps.{h,cpp}` (se quitó el `delay()`/`while(true)` fatal del script original).
- `sketch.yaml` con `default_fqbn` esp32 + setup del toolchain.
- Escrito el plan de interfaz/telemetría `docs/PLAN-INTERFAZ.md`.
- *(Commits: 3fe235d, dcc713e, 653ecaf, 0bed2b8)*
