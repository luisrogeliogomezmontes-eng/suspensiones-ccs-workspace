# Dashboard — Proyecto 1 (Overview / I1)

Panel de operaciones en tiempo real de la maleta de conectividad móvil
(ESP32 · Starlink · EcoFlow). Next.js (App Router) + TypeScript + Tailwind v4 +
Supabase Realtime. Estética de tablero de instrumentos (ver `docs/PLAN-INTERFAZ.md` §5).

## Correr en local

```bash
cd dashboard
npm install
npm run dev        # http://localhost:3000
```

Sin credenciales de Supabase arranca en **modo DEMO** (telemetría simulada,
`src/lib/mock.ts`) — totalmente funcional para desarrollar la UI.

## Conectar a datos reales (I0)

1. Aplica el esquema `backend/supabase/migrations/0001_init.sql` en tu proyecto
   Supabase (SQL editor o `supabase db push`).
2. Copia `.env.local.example` → `.env.local` y completa
   `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. `npm run dev`. El badge del header pasa de **demo** a **live** y se suscribe a
   `readings` por WebSocket.

## Estructura

```
src/
  app/            layout (fuentes+tokens), globals.css (design system), page.tsx (Overview)
  components/
    telltale/     tira de testigos (elemento firma)
    charts/       TemperatureChart (bandas umbral + fan-ON), FanTimeline, Sparkline
    map/          MiniMap (Leaflet, client-only)
    Header, LocationPanel, OfflineBanner, ThemeToggle
  lib/            useTelemetry (realtime + fallback mock), status, format, types, supabase
```

## Decisiones de diseño

- **Un eje por gráfico**: el ventilador va como banda sombreada, nunca como 2º eje.
- **Estados reservados** (verde/ámbar/naranja/rojo) siempre con ícono+etiqueta.
- **Degradación elegante**: si la unidad está offline, se congela el último dato
  con su antigüedad; nunca datos "muertos" disfrazados de vivos.
