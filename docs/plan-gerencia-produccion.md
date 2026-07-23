# Plan de Gerencia — Dashboard de Producción (Comandas) + Disponibilidad de Inventario

> Extiende el sistema de trazabilidad (D37, [plan-sistematizacion-gerencia.md](plan-sistematizacion-gerencia.md)).
> Objetivo: tablero interactivo del **proceso de fabricación** tratado como **comandas**, con cronómetro por
> etapa, % de avance, detección de exceso de tiempo y analítica de rendimiento; + **disponibilidad de
> inventario** ("componentes para N centinelas") vinculada al inventario real.
> Arrancado 2026-07-23. Fase 1 (modelo en Notion) **hecha**. Fases 2–5 pendientes.

## 0. Arquitectura (decidida con Luis)

| Pieza | Decisión |
|---|---|
| **Fuente de verdad** | **Notion** (extiende el hub D37). Gerencia edita ahí; reusa Inventario + BOM + rollups. |
| **Página** | **Next.js en Vercel**, pública para la oficina, lee **y** escribe Notion vía su API. App **nueva y separada** del dashboard de telemetría (sin muro de login; separa gerencia de telemetría). |
| **Comanda** | **1 comanda = 1 unidad** Centinela, con fecha/hora de pedido. |
| **Inventario** | **Notion** (donde ya vive). Se agregó "alcance para N centinelas"; el descuento por comanda lo cablea la app (Fase 2/3). |
| **Escritura** | Acciones (marcar etapas) protegidas con **PIN compartido** (uso interno). |
| **Visual 3D del Centinela** | Fase 5 (diferido). Primer paso barato: foto anotada; ambicioso: exploded view en Three.js. |

### Cómo Notion funciona de "base de datos" de la página
- El **servidor** de Next (en Vercel) consulta/escribe Notion con un token de integración interna (env var, **nunca** en el browser).
- **Lectura "en vivo"**: el server repolea Notion cada ~15–30 s y **cachea** (revalidate); todos los browsers leen del cache del server → un solo `server→Notion`, respeta el rate-limit (~3 req/s). Notion **no hace push**.
- **Cronómetro**: tictaquea en el **browser** desde el `Inicio` guardado; no necesita servidor. La bandera de exceso salta cuando `ahora − Inicio > Estimado`.
- **Escritura**: botón "empezar/terminar etapa" → API route de Next → graba `Inicio`/`Fin`/`Estado` en Notion.

## 1. Modelo de datos en Notion (Fase 1 — HECHA)

Dos BDs nuevas colgadas de **📊 Trazabilidad & Gerencia** (`3a470cf60ef18115a24ad4fbed47749b`).

### BD `Comandas` — 1 fila = 1 unidad
- URL: https://app.notion.com/p/bd11f5511f454ea88310b259da077b6f
- **data_source_id:** `0846d8c2-e9e1-4f39-b9d6-4408ccf49942`

| Propiedad | Tipo | Nota |
|---|---|---|
| Comanda | title | ej. "Centinela A2 · Unidad #05" |
| Nº | unique_id `CMD` | correlativo automático |
| Proyecto | relation → Proyectos | apunta a A2 (`3a470cf60ef181bfa119f6bceee868d5`) |
| Fecha pedido | date (datetime) | **cuándo se hizo el pedido** |
| Solicitante | text | quién lo pidió (gerencia) |
| Estado | select | Pendiente / En curso / En pausa / Hecha / Cancelada |
| Etapas | relation (dual) → Fabricación·Etapas | las 7 filas de etapa de esta comanda |
| H estimadas | rollup sum(Estimado) | horas plan del total |
| H hechas | rollup sum(Peso hecho) | horas plan ya completadas (ponderado) |
| Real total (h) | rollup sum(Real) | horas reales acumuladas |
| Excedido total (h) | rollup sum(Excedido) | sobre-tiempo acumulado |
| **% avance** | formula | `round(H hechas / H estimadas * 100)` — **ponderado por horas** (una etapa de 1 h pesa más que una de 0.1 h) |

### BD `Fabricación · Etapas` — join (1 fila = comanda × etapa)
- URL: https://app.notion.com/p/9a2d84445a5743ee89615d25ab6b38cc
- **data_source_id:** `2c5cdca8-15d7-4015-965d-3ec88948f020`

| Propiedad | Tipo | Nota |
|---|---|---|
| Etapa | title | ej. "#05 · E3 Soldadura interna" |
| Comanda | relation → Comandas | a qué unidad pertenece |
| Fase | select (7) | 1 Armado · 2 Corte · 3 Sold. interna · 4 Sold. salidas · 5 Ensamblaje · 6 Montaje · 7 Pruebas |
| Orden | number | 1–7 |
| Estimado (h) | number | el estimado de Luis por fase (ver §2) |
| Inicio | date (datetime) | **se llena al "empezar etapa"** → arranca el cronómetro |
| Fin | date (datetime) | se llena al "terminar etapa" → congela el real |
| Estado | select | Pendiente / En curso / Hecho / Bloqueado |
| Real (h) | formula | horas transcurridas (usa `now()` si no hay Fin → tictaquea) |
| Peso hecho (h) | formula | `if(Estado=="Hecho", Estimado, 0)` (para el % ponderado) |
| Excedido (h) | formula | `max(Real − Estimado, 0)` |
| Estado tiempo | formula | semáforo: ⚪ Sin iniciar / 🔵 En curso·en tiempo / 🔴 En curso·excedido / 🟢 Cerró en tiempo / 🔴 Cerró excedido |

### Inventario — disponibilidad (ds `d4a1e339-14fa-48cb-a39e-e9ea070e2222`)
Se agregaron 2 propiedades (reusa la relación `Consumos` → BOM):
- `Cant/ud (A2)` — rollup sum de `Cant por unidad` del BOM → cuántas de este componente lleva 1 Centinela.
- **`Alcance (uds)`** — formula `if(Cant/ud>0, floor(Comprado / Cant/ud), 0)` → **"con lo comprado alcanza para N centinelas"**.
- Ya existían: `Comprado`, `Asignado` (Σ necesario del lote), `Disponible` (Comprado − Asignado).

## 2. Fases de la línea de producción y estimados (fuente: [[production-line]])

| # | Fase | Estimado (h/hombre) |
|---|---|---|
| 1 | Armado de prueba | 1.0 |
| 2 | Corte de cables | 0.5 |
| 3 | Soldadura interna | 0.5 |
| 4 | Soldadura salidas | 0.5 |
| 5 | Ensamblaje | 0.5 |
| 6 | Montaje | 0.25 |
| 7 | Pruebas finales | 0.1 |
| | **Total** | **≈ 3.35** |

⚠️ **Taxonomía doble sin reconciliar**: la BD preexistente `Proceso de fabricación` (D37) usa **E1–E8**
(Aprovisionamiento…Despliegue), un marco más amplio de I+D. El tracking de comandas usa **estas 7 fases**
de la línea (las que tienen estimados de Luis). Quedan **ambas**; decidir luego si se fusionan o si
`Proceso de fabricación` se retira / pasa a ser catálogo maestro de estimados.

## 3. Analítica (el pago de todo esto)
- **Rendimiento por fase** (agrupar `Fabricación·Etapas` por `Fase` sobre todas las comandas): promedio
  `Real` vs `Estimado`, ratio real/est, % de etapas excedidas → **en cuál rendimos más/menos** → afinar estimados.
- **Por comanda**: `Real total` vs 3.35 h; `Excedido total`; qué fase la atrasó.
- Estos números **ajustan los estimados** de §2 con datos reales (el objetivo que planteó Luis).

## 4. Gotchas de fórmulas de Notion (aprendidos en Fase 1)
- El parser de fórmulas (vía esta API) **rechaza `let()`** → "Type error with formula".
- Una fórmula **no puede referenciar otra fórmula que use `now()`** (además del gotcha D37 de rollup-en-fórmula)
  → **inline todo**: recalcular `dateBetween(if(empty(Fin),now(),Fin), Inicio, "minutes")/60` dentro de cada fórmula.
- `is_datetime` en create/update de páginas va como **número** `1`/`0`, no string.
- Referenciar rollups **directos** desde una fórmula sí se puede (`% avance` lee `H hechas`/`H estimadas`).

## 5. Descuento de inventario por comanda (decisión pendiente para Fase 2)
Hoy `Alcance (uds)` = capacidad de lo **comprado** (no baja solo). El **descuento real** ("hay 2/1",
"quedan para 3 centinelas") necesita un **disparador** — decidir con Luis **cuándo** una comanda consume stock:
- **(a) al abrir la comanda** (reserva materiales apenas entra el pedido), o
- **(b) al llegar a la etapa de armado** (consume cuando físicamente se toman las piezas).

Implementación (Fase 2/3): la app, al disparar el consumo, crea filas de consumo por comanda (Comanda ×
Componente × cant), y un rollup en Inventario hace `Disponible = Comprado − Σ consumido`. Mientras tanto, el
chequeo **"¿alcanza para esta comanda?"** por componente ya se puede calcular en la app con `Cant/ud` vs `Disponible`.

## 6. Roadmap

| Fase | Entregable | Estado |
|---|---|---|
| **1** | Modelo Notion: `Comandas` + `Fabricación·Etapas` + fórmulas de tiempo/exceso + `% avance` + `Alcance` inventario + comanda demo. | ✅ **HECHA** (2026-07-23) |
| **2** | App Next en Vercel (lectura): tablero de comandas por etapa, % avance, cronómetros en vivo, semáforo de tiempo, disponibilidad. Deploy público. | ⬜ |
| **3** | Escritura: botones empezar/terminar etapa → Notion (+ PIN). Descuento de inventario (disparador §5). | ⬜ |
| **4** | Analítica de tiempos (heatmap rendimiento por fase) → afinar estimados. | ⬜ |
| **5** | Visual del Centinela: foto anotada → exploded view 3D (Three.js / model-viewer con `.glb` de la caja). | ⬜ (diferido) |

## 7. Setup que necesita Luis (una vez, por permisos) — para arrancar Fase 2
1. Crear **integración interna** de Notion: https://www.notion.so/my-integrations (guardar el `secret_...`).
2. **Compartir** con esa integración las páginas/BDs: Comandas, Fabricación·Etapas, Inventario, BOM/Consumo, Proyectos.
3. Pasar el token para meterlo como **env var en Vercel** (`NOTION_TOKEN`) — nunca al repo ni al browser.
4. Definir el **PIN** de escritura.

## 8. IDs de referencia (Notion)
| Entidad | data_source_id / page |
|---|---|
| Comandas | `0846d8c2-e9e1-4f39-b9d6-4408ccf49942` |
| Fabricación · Etapas | `2c5cdca8-15d7-4015-965d-3ec88948f020` |
| Inventario | `d4a1e339-14fa-48cb-a39e-e9ea070e2222` |
| BOM / Consumo | `8bc53876-8338-4499-965e-ee79ac10272d` |
| Proyectos | `3b2355da-59a3-4549-a6a8-023293c11be3` (A2 page `3a470cf60ef181bfa119f6bceee868d5`) |
| Proceso de fabricación (E1–E8, preexistente) | `90613a88-fd92-4441-b6fe-5ae5d87d6d04` |
| Comanda demo (CMD-1) | `3a670cf60ef1816f9d3ccc624b17bfcb` |
| Página gerencia (parent) | `3a470cf60ef18115a24ad4fbed47749b` |
