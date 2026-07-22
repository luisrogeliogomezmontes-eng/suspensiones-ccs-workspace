---
name: api-builder
description: >-
  Build modern, AI/agent-consumable APIs from scratch or extend existing ones,
  using Hono + TypeScript + Zod with OpenAPI/Scalar docs, MCP servers, SSE
  streaming, RFC 9457 error responses, and OWASP-hardened security. Use this
  skill WHENEVER the user wants to create, design, scaffold, or expose an API,
  a backend service, HTTP/REST endpoints, an RPC layer, an MCP server, a
  function-calling / tool-use interface for an LLM, streaming endpoints, or API
  documentation — even if they don't name Hono or say "API" explicitly (e.g.
  "quiero exponer estos datos", "un endpoint para el dashboard", "que un agente
  pueda consultar esto", "servidor MCP", "webhook", "type-safe client").
  Trigger on both English and Spanish phrasings.
---

# API Builder — APIs modernas para la era de los agentes

Guía para construir APIs desde cero (o modernizar existentes) pensadas para que las
consuman **tanto humanos como agentes LLM**. El stack por defecto es **Hono +
TypeScript + Zod**, elegido por portabilidad edge-native y type-safety end-to-end.

## Filosofía (por qué, no solo qué)
El consumidor primario de una API moderna ya no es solo un frontend: es un **agente
autónomo** que lee tokens linealmente, sin inferencia pragmática humana. Eso cambia
las prioridades: **contratos explícitos > elegancia**, **errores auto-correctivos >
un simple 404**, **tareas acotadas > CRUD crudo**. No es *vibe coding*: se especifica
el contrato primero (Zod), se valida en el borde, y toda salida se trata como no
confiable hasta verificarla.

## Cuándo NO usar Hono
Antes de scaffoldear, chequea el contexto del repo. Si el proyecto ya tiene un stack
de API establecido (FastAPI/Python, Express legacy, un backend Supabase Edge
Functions, Next.js Route Handlers), **no lo reemplaces**: adapta los principios
(contrato-primero, RFC 9457, diseño para agentes, seguridad) al stack existente.
Hono es el default para APIs **nuevas** e independientes. Marca este supuesto al usuario.

## Workflow

Sigue estas fases en orden. Cada una tiene una referencia con el detalle; **léela
justo antes de ejecutar esa fase**, no todas de golpe.

1. **Capturar el contrato antes de escribir rutas.** Define los modelos de dominio
   con Zod primero. Decide: ¿quién consume? (frontend propio, terceros, agentes
   LLM, todos). Eso define si necesitas RPC type-safe, OpenAPI público, o MCP.

2. **Elegir framework y capa RPC.** Default: Hono. Si el consumidor es solo tu
   propio monorepo → Hono RPC client. Si hay terceros/móvil → OpenAPI + contrato.
   → lee `references/framework-selection.md` si hay duda sobre el framework o la
   capa de tipos.

3. **Scaffold del proyecto.** Instancia Hono con `@hono/zod-openapi`, define rutas
   con `createRoute` (o `hono-openapi` a nivel middleware si modernizas un repo
   existente con `app.get()` idiomático). Todo endpoint valida headers, params,
   query y body con un esquema Zod. `defaultHook` estandariza los rechazos.
   → lee `references/scaffold-hono.md`.

4. **Documentación.** Monta **Scalar** (`@scalar/hono-api-reference`) sobre el JSON
   de OpenAPI — no Swagger UI. Si la consumen agentes, genera además **`llms.txt`**
   (`@scalar/openapi-to-markdown`).
   → lee `references/documentation.md`.

5. **Diseño para agentes / function-calling** (si aplica). No expongas CRUD crudo:
   abstrae en tareas dirigidas. Nombres de parámetros largos y legibles, `enum`
   para valores restringidos, descripciones Markdown ricas con "cuándo invocar",
   idempotencia, y **errores hiper-instructivos** que guíen la reparación del LLM.
   → lee `references/ai-agent-endpoints.md`.

6. **Servidor MCP** (si el usuario quiere que un agente acceda vía MCP). Usa
   `@modelcontextprotocol/sdk`. Resources (solo-lectura), Tools (mutación, valida
   con Zod), Prompts. Un servidor = una responsabilidad. **Nunca `console.log` en
   transporte STDIO** (rompe el JSON-RPC → a `stderr`).
   → lee `references/mcp-server.md`.

7. **Streaming** (si hay tareas largas: builds, cadenas de agentes, generación).
   Usa **SSE** (`streamSSE` de Hono), no WebSockets, para flujo unidireccional
   servidor→cliente. Cierra con un evento de estado final ("SUCCESS").
   → lee `references/streaming-sse.md`.

8. **Seguridad y errores.** Obligatorio, no opcional:
   - Errores en formato **RFC 9457** (`application/problem+json`: type/title/status/
     detail/instance). Esto NO es cosmético: los agentes lo decodifican para auto-corregir.
   - **OWASP API Top 10 (2025/2026)**: deny-by-default en autorización (BOLA/BFLA —
     nunca confíes en un ID de la request), sin stack traces filtrados, rate limiting
     contra consumo ilimitado (crítico con agentes que iteran en bucle).
   → lee `references/security-and-errors.md`.

## Definición de "hecho"
Contrato Zod definido → validación en el borde de cada endpoint → OpenAPI + Scalar
sirviendo → errores en RFC 9457 → rate limiting + authz deny-by-default → typecheck
limpio → probado con una request real (`curl` o el cliente RPC). Sin secretos en el
repo (env vars). Si es para agentes: `llms.txt` generado y una tool probada end-to-end.

## Anti-patrones (rechaza estos, explica por qué)
- Exponer CRUD de una tabla directo al LLM → falla al inferir dependencias entre campos.
- Swagger UI en proyectos grandes → lento, sin búsqueda para agentes. Usa Scalar.
- Abreviaturas corporativas en nombres de parámetros → el agente no las reconoce.
- Devolver `500` en blanco o strings sin formato → el agente no puede reintentar.
- `String` de errores sin `type`/`instance` → sin trazabilidad ni auto-corrección.
- Confiar en un ID que viene en el body para autorizar → BOLA, la vulnerabilidad #1.
