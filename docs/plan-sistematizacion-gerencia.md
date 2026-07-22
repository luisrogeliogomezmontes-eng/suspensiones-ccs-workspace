# Plan de Sistematización & Gerencia — Depto. Eléctrica/Electrónica

> Sistema de trazabilidad y gerencia en **Notion**, extendiendo el hub "Electronica - Suspensiones Caracas".
> Construido 2026-07-21. Este doc es la **spec de referencia** (modelo, IDs, gotchas, rutina).
> El sistema vivo está en Notion, no aquí. Aquí queda el mapa para retomarlo o extenderlo.

## 1. Qué es y por qué Notion
Capa de **gerencia** (no telemetría): inventario compartido, costo por unidad, tiempos de fabricación,
necesidades de personal (horas-hombre) y bloqueos — relacional, multi-proyecto, con el total del depto
por *rollup*. Notion (no HTML/app) porque el requisito central es una base **relacional, editable por
varios y con rollups** que se llena a diario; el hub ya existía y el equipo ya está dentro. Los HTML
autocontenidos (estilo `respaldo-electrico/`) quedan para *presentar* cosas de solo-lectura, no para la
base viva. Híbrido posible: vista ejecutiva HTML encima de Notion para el jefe.

## 2. Estructura de proyectos (2 macros)
- **Centinelas** (Macro) — datalogger + telemetría en maleta de moto para rescatistas de La Guaira
  (post-terremoto 24-jun-2026). Meta del lote inicial: **4 unidades de A2** (1 desplegada + 3).
  - **A1 · Autocarga** (Meta 1) — recarga EcoFlow desde alternador de la moto (módulo LVD/VSR autónomo).
  - **A2 · Centinela / Telemetría** (Meta **4**) — ESP32+GPS+DHT22+fan+dashboard+API. *El que se fabrica ×4.*
  - **A3 · Plug externo INPUT** (Meta 1) — puerto estanco para cargar la EcoFlow sin abrir la maleta.
  - **A4 · Plug externo OUTPUT** (Meta 1) — regleta externa para usar/cargar desde la EcoFlow sin sacarla.
- **Respaldo Eléctrico** (Macro, Giovanni) — comparador inversores/baterías (SW). Independiente.

⚠️ Solo **A2** lleva Meta 4 (las 4 cajas iniciales = solo Centinela + ventilación; A1/A3/A4 NO van en ellas,
son subproyectos en desarrollo → Meta 1 = prototipo). Si a futuro los plugs entran en N cajas, subir su Meta.

## 3. Modelo de datos (11 bases)
**Compartidas (depto):** `Inventario`, `Herramientas`, `Roles / Perfiles`, `Proyectos` (ya existía, +jerarquía).
**Enlace N:N:** `BOM / Consumo` (Componente×Proyecto), `Uso de Herramienta` (Herramienta×Proyecto),
`Necesidades por etapa` (Rol×Proyecto×Etapa).
**Ejecución:** `Proceso de fabricación`, `Bloqueos / Dependencias`, `Mejoras / Recomendaciones`.
**Preexistentes:** `Tareas` (Kanban), `Gastos / Compras`, `Bitácora`.

### Cálculos automáticos (rollups + fórmulas)
- **BOM/Consumo:** `Precio ud`, `Comprado (inv)`, `Meta lote` (rollups desde Inventario/Proyecto) →
  `Necesario (lote)` = Cant/ud × Meta · `Costo lote ($)` = Cant/ud × Meta × Precio ·
  `Faltante` = max(Necesario − Comprado, 0) · `Faltante $` = Faltante × Precio.
- **Inventario:** `Asignado` = Σ Necesario de todos los proyectos · `Disponible` = Comprado − Asignado.
- **Proyectos:** `Costo materiales $` (Σ Costo lote) · `Costo unitario $` = materiales ÷ Meta ·
  `Costo faltante $` (Σ Faltante $) · `Horas-hombre est` · `Nº bloqueos` · `H-h bloqueadas`.
- **Herramientas:** `Incidencia media` (avg de la incidencia 1–10) · `Nº usos`.

### Rúbrica de incidencia de herramienta (1–10)
10 = crítica (sin ella el proyecto se detiene) · 7–9 = muy usada, difícil de reemplazar ·
4–6 = útil, reemplazable · 1–3 = comprada pero casi ociosa · (vacío) = no aplica.

### Atribución de retraso (Bloqueos)
`Origen` (Mecánica/Compras/Externo/Propio/Otro depto) + `Tipo de retraso` (**Inducido** = ajeno / **Propio**)
+ `Horas-hombre impactadas` + `Días de retraso`. Evidencia objetiva de retrasos que no son de tu depto.

## 4. Mapa de IDs (Notion) — para retomar/extender
Workspace: **Electronica - Suspensiones Caracas** `2c270cf6-0ef1-8166-bfed-0003c7b60b24`.
Hub: https://app.notion.com/p/39e70cf60ef1813eb957c571580b5010
Página de gerencia: https://app.notion.com/p/3a470cf60ef18115a24ad4fbed47749b

| Base | data_source_id (collection) |
|---|---|
| Proyectos | `3b2355da-59a3-4549-a6a8-023293c11be3` |
| Tareas | `e8708966-6367-4841-9f90-fe2b4fa125ea` |
| Gastos / Compras | `d752d1e5-1bb0-4f6d-9ec2-21b1248b1424` |
| Bitácora | `0c20a2e9-a4e8-4279-9bb6-3e9a37cfcfb9` |
| Inventario | `d4a1e339-14fa-48cb-a39e-e9ea070e2222` |
| Herramientas | `04c2e819-1d41-4775-a124-901171c1ad63` |
| Roles / Perfiles | `8a517e22-5d8a-4bdc-b6d1-7bf0489b4316` |
| BOM / Consumo | `8bc53876-8338-4499-965e-ee79ac10272d` |
| Uso de Herramienta | `a3ad9c45-28b0-4983-918f-51642ebcda89` |
| Necesidades por etapa | `e4da84ea-42de-4341-b52b-ff07ed02a58b` |
| Proceso de fabricación | `90613a88-fd92-4441-b6fe-5ae5d87d6d04` |
| Bloqueos / Dependencias | `afa10ab9-6b31-433c-90a1-32d7c056c3f7` |
| Mejoras / Recomendaciones | `e5d11b37-326e-4a37-bb24-32b9ed2723ff` |

Proyectos (page IDs): Centinelas `39e70cf60ef1814aa14ecbb8a44c1588` · A1 `3a470cf60ef18189b24ad7a4153db897`
· A2 `3a470cf60ef181bfa119f6bceee868d5` · A3 `3a470cf60ef181798288f340de88afda`
· A4 `3a470cf60ef1816e82dbc121d09954e2` · Respaldo `3a470cf60ef1810197bcfa09cefabd0f`.

## 5. Gotchas de la API de Notion (aprendidos en el build)
- **Self-relation duplicada:** una relación DUAL entre tablas distintas crea *una* reversa; pero en una
  **auto-relación** (Proyecto↔Subproyecto) agregar ambas caras a mano crea 4 columnas. Solución: agregar
  **una sola** cara con DUAL (crea el par) y dropear las duplicadas. Dropear una cara NO arrastra a su pareja.
- **Fórmula no puede referenciar otra fórmula que contenga un rollup** ("Type error with formula"). Sí puede
  leer rollups y números directos. Solución: **recalcular inline** desde las bases (número × rollup × rollup),
  no encadenar fórmula→fórmula.
- No referenciar en el **mismo batch** de `ADD COLUMN` una columna recién creada en ese batch → separarlo.
- Rollups **sí** pueden agregar columnas-fórmula de la tabla relacionada.
- `query_data_sources` está en trial (rate-limited) en este plan — usar `fetch` para leer esquema; los
  rollups computan nativo (no necesitan query).

## 6. Sesión de inventario (próximo paso) — qué cargar y en qué orden
1. **Inventario:** reconciliar `docs/compras-electronica.csv` (29 ítems, $184.80 reales) + `docs/PRESUPUESTO.csv`.
   Por cada componente: Categoría, Precio ud $, Comprado (total), Estado. ⚠️ Deduplicar: DHT22 comprado 2×
   (filas 18 y 27 = 4 uds, para las 4 cajas). Marcar descartados (ZY12PDN, IRF520, opto-MOSFET) como Repuesto/Descartado.
2. **Herramientas:** cautín ($15), destornilladores ($14), alicates ($20), multímetro + software (KiCad,
   arduino-cli, Supabase, Claude Code). Tipo + costo + estado.
3. **BOM/Consumo (A2):** por cada componente que va en el Centinela → fila (Componente + Proyecto=A2 +
   Cant/unidad). Con Meta=4 salen `Necesario`, `Costo lote`, `Faltante` y el **costo unitario** solos.
4. **Uso de Herramienta:** calificar 1–10 cada herramienta por proyecto (rúbrica §3) + etapa + imprescindible.
5. **Proceso de fabricación (A2):** los pasos E1–E8 con tiempo est/real, rol y herramientas → tiempo por unidad.
6. **Necesidades por etapa:** back-fill del diseño (qué roles/horas-hombre necesitó el prototipo) + forward
   del ensamblaje (microsoldadura, etc.). Estado cubierto/falta.
7. **Bloqueos:** los abiertos hoy (p. ej. fans definitivos que compra mecánica; cajas/pasamuros de A3/A4).
8. **Mejoras:** migrar R1/R2/R3 de `docs/RECOMENDACIONES.md`.

## 7. Ritmo (que no se muera)
- Al comprar → Inventario. Al usar → BOM. Al calificar herramienta → Uso. Al trabarse → Bloqueos.
- Vistas por audiencia: cockpit (Luis) · ejecutiva (jefe) · handoffs/bloqueos (mecánica).
- Enganchar al **protocolo de cierre** (CLAUDE.md §0.1): actualizar el hub junto con MEMORY/BITACORA.

## 8. Límites conocidos / próximos
- Costos en $0 hasta cargar el BOM (esqueleto vacío por diseño).
- Sin rollup macro↔subproyectos (el macro Centinelas no suma solo a sus 4 subs; se ve por vista/agrupación).
  Se puede añadir rollup-de-rollup por la self-relation si se necesita.
- Vista "Faltantes" ordena por Faltante $ (sin filtro > 0 por límite del DSL) — los faltantes quedan arriba.
- Sin costo de mano de obra ($/hora) por decisión de Luis: se mide **horas-hombre**, no dinero.
- Falta (opcional): vista ejecutiva HTML para el jefe; formularios de captura rápida.
