# Scaffold de una API Hono contrato-primero

Objetivo: ninguna ruta se declara sin un esquema Zod que valide entrada y alimente el
documento OpenAPI. El contrato es la fuente de verdad.

## Dependencias

```bash
npm i hono @hono/zod-openapi zod
npm i @scalar/hono-api-reference          # docs (ver documentation.md)
npm i -D typescript @types/node tsx
```

Runtime: Node.js, Bun (`bun add ...`) o Cloudflare Workers (`wrangler`). El código
de rutas no cambia entre ellos.

## Estructura sugerida

```
src/
├── index.ts            # instancia OpenAPIHono, monta rutas y docs, defaultHook
├── schemas/            # esquemas Zod por dominio (fuente de verdad de tipos)
│   └── reading.ts
├── routes/             # una createRoute + handler por endpoint
│   └── readings.ts
└── lib/                # auth, db, helpers
```

## Patrón A — `@hono/zod-openapi` con `createRoute` (recomendado para APIs nuevas)

`createRoute` define metadatos (método, path, tags) y adjunta los esquemas Zod que
**simultáneamente** validan la entrada, infieren tipos y se registran en OpenAPI.

```ts
// src/schemas/reading.ts
import { z } from '@hono/zod-openapi'

export const ReadingSchema = z.object({
  device_id: z.string().uuid().openapi({ example: 'a1b2...' }),
  temp_c: z.number().min(-40).max(125).openapi({ description: 'Temperatura en °C' }),
  ts: z.string().datetime(),
}).openapi('Reading')

export const CreateReadingSchema = ReadingSchema.omit({ ts: true })
```

```ts
// src/routes/readings.ts
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { ReadingSchema, CreateReadingSchema } from '../schemas/reading'

export const readings = new OpenAPIHono()

const createReading = createRoute({
  method: 'post',
  path: '/readings',
  tags: ['Telemetría'],
  request: {
    body: { content: { 'application/json': { schema: CreateReadingSchema } } },
  },
  responses: {
    201: { content: { 'application/json': { schema: ReadingSchema } }, description: 'Creada' },
  },
})

readings.openapi(createReading, (c) => {
  const body = c.req.valid('json')   // ya validado y tipado
  const saved = { ...body, ts: new Date().toISOString() }
  return c.json(saved, 201)
})
```

```ts
// src/index.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import { readings } from './routes/readings'

const app = new OpenAPIHono({
  // Estandariza TODOS los rechazos de validación antes de tocar la lógica.
  // Ver security-and-errors.md para formatear esto como RFC 9457.
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json({ title: 'Validation failed', status: 422,
        detail: result.error.issues }, 422)
    }
  },
})

app.route('/', readings)
app.doc('/openapi.json', { openapi: '3.1.0', info: { title: 'API', version: '1.0.0' } })

export default app   // Cloudflare Workers / Bun. Para Node: usar @hono/node-server.
```

## Patrón B — `hono-openapi` a nivel middleware (modernizar un repo existente)

Si ya tienes rutas idiomáticas `app.get()` y no quieres reescribirlas a `createRoute`,
usa `hono-openapi` con `describeRoute` + validadores injertados. Infiere el esquema en
segundo plano, fricción mínima, y soporta más librerías (Zod, ArkType, TypeBox, Valibot).

```ts
import { describeRoute } from 'hono-openapi'
import { validator as zValidator } from 'hono-openapi/zod'

app.get('/readings',
  describeRoute({ tags: ['Telemetría'], responses: { 200: { description: 'OK' } } }),
  zValidator('query', QuerySchema),
  (c) => c.json(/* ... */))
```

## Reglas
- **Un esquema Zod por modelo de dominio**, reutilizado en request y response.
- Valida las 4 superficies: `header`, `param`, `query`, `json` (body).
- `defaultHook` global → nunca dejes que una carga malformada llegue al handler.
- Rutas calientes: no construyas objetos gigantes; deja que Zod haga el trabajo.
- Corre `curl -X POST localhost:PORT/readings -d '{...}'` antes de dar por hecho nada.
