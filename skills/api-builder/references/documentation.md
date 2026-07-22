# Documentación: Scalar + llms.txt

La documentación es la puerta de entrada a la API — para humanos **y** para agentes.

## Scalar (no Swagger UI)

Swagger UI en 2026: lento con esquemas grandes, sin personalización moderna, agrupa
mal los modelos, y **sin soporte para búsqueda/análisis por agentes**. Usar **Scalar**:
UI pulida, tema claro/oscuro, cliente de prueba de requests, búsqueda ultrarrápida.
Es solo la capa de presentación; respeta el contrato OpenAPI que ya generó Hono.

```bash
npm i @scalar/hono-api-reference
```

```ts
import { Scalar } from '@scalar/hono-api-reference'

// app ya expone app.doc('/openapi.json', ...) del scaffold
app.get('/docs', Scalar({ url: '/openapi.json' }))
```

Visita `/docs`. No dupliques el contrato: Scalar apunta al JSON de OpenAPI vivo.

## llms.txt — documentación para agentes

Cuando agentes descubren la API por búsqueda web, la UI gráfica es redundante. El
estándar emergente **`llms.txt`** compila todo el OpenAPI a Markdown plano: el agente
entiende la topología del servidor con sobrecarga computacional casi nula.

```bash
npm i @scalar/openapi-to-markdown
```

```ts
import { createMarkdownFromOpenApi } from '@scalar/openapi-to-markdown'

app.get('/llms.txt', async (c) => {
  const spec = await (await fetch(new URL('/openapi.json', c.req.url))).json()
  const md = await createMarkdownFromOpenApi(JSON.stringify(spec))
  return c.text(md)
})
```

## Regla
Si la API la consumen (o podrían consumirla) agentes → sirve `/llms.txt` **además** de
`/docs`. Es barato y multiplica la usabilidad para LLMs.
