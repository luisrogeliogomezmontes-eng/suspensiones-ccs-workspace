# PLAN — Interfaz & Telemetría · Proyecto 1
**Unidad móvil de monitoreo para maleta de conectividad (ESP32 + Starlink + EcoFlow)**
*Documento de planificación. No es implementación. Fecha: 2026-07-09.*

---

## 0. Resumen ejecutivo (TL;DR)
Construir un **dashboard web propio** (Next.js + Supabase, PWA) que muestre en tiempo real la salud de una maleta de conectividad montada en moto: **temperatura interna**, **estado del ventilador** (encendido/apagado **automático por temperatura**), **ubicación GPS** y — si el equipo lo aprueba — **energía (EcoFlow)**, **calidad de enlace (Starlink)** y **movimiento (IMU)**.

- **Principio rector:** el lazo de control del fan vive en el **firmware** (autónomo). El dashboard **monitorea, ajusta y sobre-controla**, pero el enfriamiento nunca depende de internet.
- **Conectividad:** la telemetría sale por la **misma Starlink** de la maleta → tiempo real de verdad, sin celular.
- **Alcance del MVP:** temperatura + fan + GPS. Todo lo demás está priorizado como fases/propuestas.

---

## 1. Contexto y replanteo
| Antes suponíamos | Ahora sabemos | Implicación |
|---|---|---|
| Quizá banco de pruebas fijo | **Móvil, en moto**, dentro de maleta ~40×60×70 cm | Vibración, golpes, lluvia/polvo, GPS real en movimiento |
| Conectividad por decidir | **Starlink** dentro de la maleta | Internet en campo → dashboard remoto en tiempo real |
| Energía por decidir | **EcoFlow** (batería grande) alimenta todo | Presupuesto de energía holgado; el ESP32 va por un USB 5V del EcoFlow |
| Temp = dato "nice to have" | Maleta **sellada** con Starlink (50–75 W) + repetidor + batería, en calor de Caracas | **Riesgo térmico real**: Starlink hace throttling/apaga ~50 °C; la batería se degrada con calor → enfriar es proteger la inversión |

**Qué es realmente este proyecto:** un *datalogger + gestor térmico + rastreador* para una unidad de conectividad móvil, que se auto-reporta usando su propio enlace satelital.

---

## 2. Arquitectura de datos (flujo de la interfaz)
```
   [ MALETA ]                                   [ NUBE ]                 [ USUARIO ]
  ┌──────────────────────┐                     ┌───────────┐           ┌──────────┐
  │ Sensores → ESP32      │  WiFi (repetidor)  │ Supabase  │  Realtime │ Dashboard│
  │  temp, GPS, fan, …    │ ───────────────►   │ Postgres  │ ────────► │ Next.js  │
  │  (lazo de fan LOCAL)   │   vía STARLINK     │ + Realtime│  (WS)     │ PWA/móvil│
  │  Web local (respaldo) │ ◄───────────────   │ + Auth/RLS│ ◄──────── │ controles│
  └──────────────────────┘   comandos (poll)   └───────────┘  insert   └──────────┘
                                                     │
                                             n8n (VPS): alertas → Telegram/email
```
- **Subida (telemetría):** ESP32 → `HTTPS POST` a Supabase cada N s (MVP). Fase 2: MQTT (Mosquitto en VPS) para menor latencia/bandwidth.
- **Bajada (control):** dashboard escribe en tabla `commands`; el ESP32 hace **polling** (MVP) o se suscribe por MQTT (Fase 2). Ej.: `fan_mode=auto|on|off`, `setpoint=55`.
- **Respaldo local:** el ESP32 sirve una **web mínima por su propio AP/LAN** (WebSocket) para ver/controlar sin internet (si Starlink cae).
- **Marca de tiempo en origen:** el ESP32 sella cada lectura con hora de **GPS/NTP** (no en el ingest), para que la serie sea correcta aunque haya reintentos.

---

## 3. Qué datos tenemos y qué podemos DERIVAR (con lo actual: temp + GPS + fan + ESP32)
Muchísimo más de lo que parece. No hace falta comprar nada para lo siguiente:

### 3.1 Directos
| Fuente | Señales |
|---|---|
| Temp (DS18B20) | °C instantáneo |
| GPS | lat, lng, altitud, **velocidad**, **rumbo**, nº satélites, **HDOP** (precisión), fecha/hora UTC, validez de fix |
| Fan | estado ON/OFF (y % duty si PWM) |
| ESP32 (interno) | **RSSI WiFi** (calidad de enlace al repetidor), uptime, heap libre, temperatura del chip, razón de reinicio, voltaje de alimentación (si se mide por ADC) |

### 3.2 Derivados (cálculo, cero hardware extra) — **aquí está el valor**
| Derivado | De qué | Para qué |
|---|---|---|
| **dT/dt** (velocidad de calentamiento) | temp en el tiempo | Detectar *thermal runaway* antes de que sea crítico |
| Min/máx/promedio y **tiempo sobre umbral** | temp | Estrés térmico acumulado del equipo |
| **% de tiempo con fan encendido** (duty demand) | fan | ¿El enfriamiento está sobre-exigido? ¿Fan subdimensionado? |
| **Eficacia del enfriamiento** | temp vs fan | ¿Bajar el fan realmente baja la temp? (desempeño del lazo) |
| Nº de ciclos ON/OFF del fan | fan | Desgaste del relé / vida del ventilador |
| **Odómetro / distancia recorrida** | integrar GPS | Km del día, por ruta |
| **Trail / breadcrumb** (ruta) | histórico GPS | Dónde anduvo la unidad |
| Velocidad prom/máx, **detección de paradas** (idle) | GPS | ¿Calienta más **detenida** (sin flujo de aire) que en marcha? Correlación clave |
| **Geofencing** (entra/sale de zona) | GPS + polígono | Alertas de zona, "llegó/salió de base" |
| **Correlación temp ↔ velocidad/ubicación** | temp + GPS | Mapa de calor: qué tramos/paradas recalientan |
| Calidad de enlace en el tiempo | RSSI | Zonas con mal WiFi al repetidor |

---

## 4. Integraciones sugeridas al equipo (priorizadas)
Ordenadas por **valor / costo**. Marca ⭐ = alto impacto para *esta* maleta.

| # | Integración | Qué aporta | HW | Costo | Prioridad |
|---|---|---|---|---|---|
| A ⭐ | **Multi-punto de temperatura** (varios DS18B20 en el mismo bus 1-Wire) | Temp de entrada de aire, salida, junto a Starlink, junto a EcoFlow → detectar *hotspots* y ΔT | 3–4 sondas | $ | **MVP+** |
| B ⭐ | **Ambiente: temp + humedad** (SHT31/DHT22) | ΔT interior-exterior real; **humedad → riesgo de condensación** (moto bajo lluvia) | 1 módulo | $ | **MVP+** |
| C ⭐ | **Relé de power-cycle remoto** (Starlink / repetidor) | **Reiniciar el equipo a distancia** si se cuelga → evita ir hasta la moto | 1–2 relés | $ | **Alta** |
| D ⭐ | **Telemetría de Starlink** (gRPC en `192.168.100.1`) | Obstrucción %, throughput, latencia, cortes, temp del plato | Solo software | $0 | **Alta** |
| E ⭐ | **Estado del EcoFlow** (BLE/WiFi API) | **% de batería, watts, autonomía restante**, temp de batería | Solo software (ESP32 BLE) | $0 | **Alta** |
| F ⭐ | **Sensor de corriente/potencia** (INA226) | Consumo real (W) del sistema, presupuesto de energía, anomalías | 1 módulo | $ | **Alta** |
| G | **IMU / acelerómetro** (MPU6050) | Movimiento, **vibración**, caídas/golpes, vuelco, "moto en marcha vs estacionada", **antirrobo** | 1 módulo | $ | Media-alta |
| H | **Fan PWM + doble ventilador** (intake+exhaust) + control PID de velocidad | Enfriamiento más silencioso y eficiente; usa tu base de control | 2 fans | $ | Media |
| I | **Sensor de apertura de tapa** (reed switch) | Tamper/seguridad + afecta el modelo térmico (tapa abierta = flujo) | 1 imán+reed | ¢ | Media |
| J | **Buzzer + LED de estado** | Alarma local audible/visual por sobre-temp o falla | ¢ | ¢ | Media |
| K | **Log en microSD** (black-box) | Store-and-forward si Starlink cae; caja negra ante incidente | 1 módulo | $ | Media |
| L | **Sensor de gas/humo** (MQ-2) | Seguridad ante recalentamiento/fuego en caja sellada con batería | 1 módulo | $ | Baja-media |

> **Combo estrella para una maleta Starlink:** D (calidad de enlace) + C (reinicio remoto) + E (batería) + A/B (térmico fino) + G (antirrobo/golpes). Con eso el dashboard deja de ser "un termómetro bonito" y se vuelve un **panel de operaciones** de la unidad.

---

## 5. La interfaz (dashboard)

### 5.1 Principios
1. **Autonomía del control:** fan automático en firmware (histéresis/PID). El dashboard ajusta setpoints y permite *override manual*, pero **no** es quien enfría.
2. **Tiempo real por defecto:** Supabase Realtime (WebSocket). Latencia objetivo < 2 s.
3. **Móvil-first / PWA:** se monitorea desde el teléfono, en la calle, al sol → instalable, legible con brillo, **modo oscuro real**.
4. **Roles:** *viewer* (solo mira) vs *operator* (manda comandos: power-cycle, setpoint). Auth + RLS.
5. **Degradación elegante:** si la unidad está offline, la UI lo dice claro y muestra el último dato con su antigüedad — nunca datos "muertos" disfrazados de vivos.

### 5.2 Dirección visual (propuesta — *frontend-design*)
Evitamos el look "SaaS genérico". La maleta es equipo de campo montado en moto → estética de **panel de instrumentos / mission-control de rally**, no de landing page.

| Token | Propuesta | Por qué |
|---|---|---|
| **Superficies** | Grafito/slate muy oscuro (#0E1116) con paneles #161B22; modo claro alterno | Legible bajo sol y de noche; sensación de instrumento |
| **Tinta** | Alto contraste, texto en grises fríos | Datos primero |
| **Acentos UI** | Un azul "señal" (enlace/Starlink) usado con moderación | Identidad sin ruido |
| **Estados (reservados, NO decorativos)** | Verde OK · Ámbar advertencia · Naranja serio · Rojo crítico — **siempre con ícono+etiqueta**, nunca solo color | Regla de *dataviz*; daltónicos |
| **Tipografía** | Display técnico condensado (p.ej. *Saira/Space Grotesk*) + **mono para lecturas numéricas** (*IBM Plex Mono*/*JetBrains Mono*) + body limpio (*Inter*) | Los números se leen como en un tablero |
| **Elemento firma** | Una **"tira de testigos"** tipo tablero (fan · GPS · enlace · batería · temp) siempre visible, como luces de advertencia de un vehículo | Memorable y funcional |

> En la construcción: generar el sistema con `skills/design.md` (DESIGN.md) y **validar la paleta categórica con `dataviz/scripts/validate_palette.js`** (CVD ≥ 12) antes de escribir CSS.

### 5.3 Pantallas y wireframes
**(1) Overview / En vivo** — la pantalla que el 90 % del tiempo estará abierta:
```
┌───────────────────────────────────────────────────────────────┐
│  UNIDAD-01   ● en línea  hace 3s     ⚙        ◐ tema   [Operator]│
│  [🌡 54°C ⚠] [🌀 FAN ON] [📍 fix 9 sat] [🔋 82%] [⚡ 61W] [📶 -58dBm]│  ← testigos/KPI
├───────────────────────────────────┬───────────────────────────┤
│  Temperatura (última 1h)           │   Ubicación                │
│   °C   ┌───────────────────────┐   │   ┌───────────────────┐    │
│    70 ─┤     zona roja          │   │   │   mapa + trail    │    │
│    60 ─┤~~~~~~~/\~~ámbar~~~~~~~ │   │   │      ● aquí       │    │
│    50 ─┤__/  \_/  \__ verde     │   │   │   velocidad 0km/h │    │
│        └──[fan on: bandas]──────┘   │   └───────────────────┘    │
├───────────────────────────────────┴───────────────────────────┤
│  Ventilador (timeline ON/OFF)   ████░░░░████████░░░  duty 47%    │
└───────────────────────────────────────────────────────────────┘
```
**(2) Mapa** — pantalla completa: posición viva, ruta/trail, color por velocidad, geocercas, paradas.
**(3) Histórico** — rango de tiempo (1h/24h/7d), series temp/potencia/RSSI/velocidad, min/máx/prom, **export CSV**.
**(4) Control** *(operator, protegido)* — modo del fan (Auto/On/Off), sliders de setpoint e histéresis, botones de **power-cycle** (Starlink/repetidor con confirmación), edición de umbrales.
**(5) Alertas / Eventos** — bitácora (sobre-temp, GPS perdido, offline, geocerca, tamper, batería baja) + configuración de umbrales y canal de notificación.
**(6) Dispositivo / Ajustes** — nombre, versión de firmware, calibración de sensores, config WiFi.

### 5.4 Componentes y visualizaciones (*dataviz* — forma según el trabajo del dato)
| Dato | Forma correcta | Notas de dataviz |
|---|---|---|
| Temp actual | **Stat tile / número héroe** + color de estado | "No siempre es un gráfico"; ícono+etiqueta, no solo color |
| Temp en el tiempo | **Línea** (1 eje °C) con **bandas de umbral** de fondo y **bandas de fan-ON superpuestas** | ⚠ **Nunca doble eje**: el fan va como banda sombreada, no como 2º eje |
| Multi-punto de temp | Línea **multi-serie** (orden categórico fijo, ≤4 con etiqueta directa, leyenda siempre) | Correr el validador de paleta |
| Estado del fan | **Timeline categórico** ON/OFF (2px de separación entre bloques) | — |
| Duty del fan (si PWM) | Línea 0–100 % | — |
| Ubicación | **Mapa** (Leaflet/MapLibre + OSM), no gráfico | Trail + marcador vivo |
| Velocidad | Línea + stat tile | Color de ruta por velocidad en el mapa |
| Satélites / HDOP | Stat tiles | HDOP = confianza del fix |
| Potencia (W) / batería (%) | Línea + **gauge/stat** con estado de batería | — |
| RSSI / enlace | Sparkline en KPI | — |
| KPI row | **Stat tiles con sparkline** | Texto en tinta, no en color de serie |

**Umbrales de temperatura (estado reservado + ícono):** OK `✓ <50°C` · Advertencia `⚠ 50–60` · Serio `▲ 60–70` · Crítico `⛔ >70`. *(Calibrar con el equipo real: Starlink empieza a hacer throttling ~50 °C.)*

**Interacción (por defecto):** crosshair + tooltip en líneas; hover por marca en timeline; filtros de rango en una fila sobre los gráficos; **vista de tabla** disponible (accesibilidad).

### 5.5 Estados vacíos / error / offline
- **Offline:** banner claro + "último dato hace X min", congelar sin mentir.
- **Sin fix GPS:** "Enlace de módulo OK, buscando satélites (N)…" (distingue *módulo caído* de *sin cielo*).
- **Errores de comando:** decir qué pasó y cómo reintentar; el botón mantiene su nombre en todo el flujo ("Reiniciar Starlink" → toast "Starlink reiniciado").

---

## 6. Stack técnico (decidido + razón)
| Capa | Elección | Por qué |
|---|---|---|
| Frontend | **Next.js (App Router) + TypeScript + Tailwind** → Vercel (PWA) | Tu fortaleza; server components + realtime |
| Datos en vivo | **Supabase Realtime** (WebSocket) | Ya es tu stack; suscripción a `readings` |
| Auth / permisos | **Supabase Auth + RLS** por dispositivo/rol | viewer vs operator |
| Gráficos | **uPlot** (series grandes, liviano) o ECharts | Miles de puntos sin lag |
| Mapa | **MapLibre GL** o **Leaflet + OSM** | Gratis, trail, geocercas |
| Alertas | **n8n en tu VPS** → Telegram/email | Reusas lo que dominas |
| Telemetría | HTTPS→Supabase (MVP) → **MQTT** (Fase 2) | Migrar cuando pese latencia/bandwidth |

---

## 7. Modelo de datos (borrador)
```
devices(  id, name, fw_version, last_seen, created_at )
readings( id, device_id, ts,                       -- ts sellado en origen (GPS/NTP)
          temp_c, temp_points jsonb,               -- multi-punto (integración A)
          fan_on bool, fan_duty,
          lat, lng, alt, speed_kmph, course, sats, hdop,
          rssi, uptime_s, heap_free,
          batt_soc, power_w,                        -- integraciones E/F
          link_obstruction, link_down_mbps )        -- integración D
commands( id, device_id, ts, type, payload jsonb, issued_by, ack_ts )
events(   id, device_id, ts, kind, severity, message, ack_by )  -- alertas
```
- **Frecuencia de telemetría:** proponer **1–5 s** en marcha, **15–30 s** en reposo (ahorra filas y datos de Starlink si es medido). Decisión abierta.
- **Retención:** cruda 7–30 días; luego *downsample* a 1 min/1 h (rollups). Decisión abierta.
- **Índices:** `(device_id, ts)`. Considerar particionar `readings` por tiempo si crece.

---

## 8. Control automático del ventilador (lo que pediste)
- **En firmware (autónomo):** histéresis `TEMP_ON`/`TEMP_OFF` (ya implementado). Enciende/apaga solo, **sin depender de internet**. Fase 4: PID de velocidad (fan PWM) para mantener setpoint fino y bajar ruido.
- **En el dashboard:** ver estado + **ajustar setpoint/histéresis** + **override manual** (Auto/On/Off). Todo cambio viaja por `commands` y el firmware confirma (`ack`).
- **Fail-safe:** si el sensor falla (NaN) o se pierde comunicación → fan a **estado seguro (ON)**. Nunca "sin enfriar por duda".

---

## 9. Alertas y notificaciones
| Evento | Disparo | Canal |
|---|---|---|
| Sobre-temperatura | temp > umbral crítico X min | Telegram/email (n8n) |
| Calentamiento rápido | dT/dt alto | Telegram |
| Unidad offline | sin heartbeat > X min | Telegram |
| GPS perdido / módulo caído | `linkOk=false` o sin fix prolongado | Telegram |
| Geocerca | entra/sale de zona | Telegram |
| Batería baja (EcoFlow) | SoC < umbral | Telegram |
| Tamper (tapa abierta) | reed switch | Telegram (alta prioridad) |
| Obstrucción Starlink | obstrucción > % | Telegram |

---

## 10. Seguridad
- **RLS** por dispositivo y rol; `service_role` solo en servidor/Edge Functions.
- **Comandos peligrosos** (power-cycle, cambio de setpoint) solo para *operator*; con **confirmación** en UI y registro de `issued_by`.
- Rate-limit de comandos; validar payloads.
- La web local del ESP32: contraseña + solo lectura por defecto.
- Nada de secretos en el cliente; el device usa *anon key* con RLS estricta (o token propio por dispositivo).

---

## 11. Roadmap de la interfaz (por fases)
| Fase | Entrega | Depende de |
|---|---|---|
| **I0** | Esquema Supabase + POST desde ESP32 (temp/fan/GPS) | firmware Fase 2 |
| **I1** | **Overview read-only** en vivo (KPIs + gráfico temp + timeline fan + mini-mapa) | I0 |
| **I2** | Mapa completo + histórico + export CSV | I1 |
| **I3** | **Control** (fan mode/setpoint, override) + Auth/roles | I1 + `commands` |
| **I4** | Alertas (n8n) + PWA instalable + modo oscuro pulido | I2 |
| **I5** | Integraciones aprobadas (Starlink/EcoFlow/IMU/power-cycle) | propuestas §4 |
| **I6** | **Último status conocido por centinela** (graceful offline: resumen de cierre, hace cuánto se apagó, última pos/temp, uptime de la sesión) — 0 campos en blanco. Plan: [`plan-last-known-status.md`](plan-last-known-status.md) | I1 |

---

## 12. Cosas por mejorar / tips / consejos
- **Un eje por gráfico.** Temp y fan en el mismo tiempo → fan como banda sombreada, no 2º eje. (Error #1 de dashboards.)
- **Sella la hora en el ESP32** (GPS/NTP), no en el ingest.
- **Batchea/comprime** telemetría si la Starlink es de datos medidos; sube en lotes.
- **Watchdog + reconexión con backoff** en el firmware; la unidad debe recuperarse sola.
- **Colas offline (microSD):** guarda cuando no hay enlace y sincroniza al volver.
- **Térmica de la maleta (¡crítico!):** definir **camino de aire** (entrada baja/fría → salida alta/caliente), tamaño de fans vs ~75 W a disipar, y el **tradeoff sellado (IP) vs enfriamiento**: en moto entra lluvia/polvo → usar **entradas con filtro/laberinto** o intercambiador, no huecos abiertos.
- **Ubicación de sensores:** uno en la **entrada de aire** (referencia ambiente) y otro **pegado a la Starlink/EcoFlow** (punto caliente). El ΔT es el dato que manda.
- **Vibración:** conectores con retención, cableado con alivio de tensión, y considerar montar el ESP32 sobre espuma.
- **PWA** instalable en el teléfono del operador; probar con brillo de sol.

## 13. Preguntas abiertas / dudas (decidir con el equipo)
1. **Uso real de la maleta**: ¿internet móvil para eventos/campo? ¿una unidad o **flota** de maletas? (flota → multi-dispositivo desde el día 1 en el modelo de datos).
2. **Usuarios**: ¿quién mira y quién manda comandos? (define roles/auth).
3. **Frecuencia de telemetría** y si la **Starlink es de datos medidos** (afecta costo y diseño).
4. **Retención** de histórico (días/meses).
5. **Canal de alertas**: ¿Telegram, WhatsApp, email?
6. **Alcance de integraciones**: ¿arrancamos con Starlink+EcoFlow+power-cycle o mantenemos MVP apretado?
7. **Umbrales térmicos reales**: medir a qué °C empieza a sufrir *este* equipo (Starlink/EcoFlow) para calibrar estados.
8. **Seguridad de power-cycle**: ¿quién puede reiniciar la Starlink remotamente?

## 14. Riesgos
| Riesgo | Mitigación |
|---|---|
| Recalentamiento de la maleta (Starlink throttling / batería) | Fan autónomo + alertas + diseño de flujo de aire + multi-punto |
| Ingreso de agua/polvo (moto) por las ventilaciones | Entradas con filtro/laberinto; IP en electrónica sensible |
| Starlink medido / datos caros | Batchear, bajar frecuencia en reposo, downsample |
| Enlace intermitente | Colas offline (SD) + reconexión + heartbeat |
| Comando remoto peligroso (power-cycle) | Roles + confirmación + auditoría |
| Robo de la unidad (equipo caro) | IMU (movimiento en reposo) + geocerca + tamper |

---
*Próximo paso sugerido:* cerrar §13 (1, 3 y 6 son las que más mueven el diseño) y arrancar **I0 + I1** en paralelo con la Fase 1 del firmware.
