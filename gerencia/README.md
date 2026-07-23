# Gerencia · Producción (Centinelas)

Tablero interactivo de **fabricación tratada como comandas** + **disponibilidad de inventario**, con
**Notion como base de datos** y Next.js en Vercel como la página que ve toda la oficina.

- Fuente de verdad: Notion (extiende el hub de trazabilidad D37).
- Lee/escribe Notion vía su API **desde el servidor** (token en env var, nunca en el browser).
- "En vivo": el server repolea Notion y cachea (`/api/state`, TTL 8 s); los cronómetros tictaquean en el browser.
- Diseño y decisiones: [`../docs/plan-gerencia-produccion.md`](../docs/plan-gerencia-produccion.md).

## Correr local
```bash
cp .env.local.example .env.local   # y pega el NOTION_TOKEN real
npm install
npm run dev                        # http://localhost:3000
```
⚠️ Requiere que las BDs de Notion estén **compartidas con la integración** “Rogelio Claude”
(hub → ⋯ → Conexiones → agregar la integración; los hijos heredan acceso).

## Estructura
- `src/lib/notion.ts` — cliente REST de Notion (data sources, v2025-09-03) + parsers.
- `src/lib/data.ts` — `getComandas()`, `getInventario()`, `getBoardState()` (server-only).
- `src/lib/derive.ts` — cálculos en vivo (tiempo real, exceso, % avance) client-safe.
- `src/app/api/state` — endpoint que la página polea (con cache en memoria).
- `src/components/` — Board, ComandaCard, ComandaDetail, InventarioView, Ring, StageStrip.

## Pendiente (Fase 3)
Botones “Empezar/Terminar etapa” → escriben `Inicio`/`Fin`/`Estado` en Notion (con **PIN**), y
**descuento de inventario al crear la comanda**.
