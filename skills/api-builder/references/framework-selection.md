# Selección de framework y capa RPC

## Framework HTTP

Default por defecto en 2026: **Hono**. Razón única: se abstrae sobre la API nativa
`Request`/`Response` (Fetch estándar), así que el mismo código corre en Node.js, Bun,
Deno, Cloudflare Workers y AWS Lambda **sin cambiar una línea de lógica**. Núcleo
<14 kB → arranque en frío casi nulo en serverless.

| Framework | Cuándo elegirlo en su lugar |
|---|---|
| **Hono** | Default. APIs nuevas, edge-native, portabilidad, serverless. |
| **Fastify** | Procesamiento masivo **acoplado a Node.js**; ya tienes ecosistema Fastify. Motor JSON Schema para serialización ultrarrápida. |
| **ElysiaJS** | Solo si el runtime es **exclusivamente Bun** y quieres su DX de tipos. |
| **Express** | Solo sistemas heredados existentes. No para APIs nuevas (no corre en edge). |

⚠️ No migres un backend existente a Hono solo por moda. Hono es para lo **nuevo**.

## Capa de type-safety cliente↔servidor (RPC)

La decisión depende de **quién controla los extremos**:

| Opción | Elegir cuando | Trade-off |
|---|---|---|
| **Hono RPC** (`hono/client`) | Default con Hono. Extrae tipos de las rutas; RESTful, universal, sin codegen. | Mejor equilibrio: type-safe + HTTP convencional + agilidad de deploy. |
| **tRPC** | Monorepo cerrado (Next.js), controlas ambos extremos, **no** hay terceros. | Sin semántica REST → inservible para terceros/móvil/LLMs. |
| **ts-rest** | Equipos distribuidos, móvil, necesitas contratos OpenAPI precisos. Esquemas Zod compartidos. | Más ceremonia (contrato maestro). |
| **oRPC** | Quieres equilibrio DX + docs nativas + compatibilidad REST. | Emergente, menos maduro. |

### Regla práctica
- ¿La API la consume **solo tu propio frontend/monorepo**? → **Hono RPC** (o tRPC si ya es tu stack).
- ¿La consumen **terceros, móvil o agentes LLM**? → OpenAPI público (`@hono/zod-openapi`) + Scalar. El cliente interno puede seguir usando Hono RPC en paralelo.

El punto clave: RPC puro (tRPC) **no expone semántica REST estándar**, así que no sirve
para consumidores externos. Hono te da ambos mundos: rutas REST tipadas + cliente RPC.
