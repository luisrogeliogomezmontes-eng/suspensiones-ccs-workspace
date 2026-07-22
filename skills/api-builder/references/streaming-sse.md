# Streaming asíncrono con SSE

## Por qué SSE y no WebSockets

El modelo HTTP request→response estática es letal para cargas de IA: tareas largas
(builds, cadenas de agentes, generación) tienen latencia extrema y variable. El cliente
espera minutos sin feedback.

- **WebSockets**: bidireccional simétrico, pero coreografía compleja, sensible a
  balanceadores de carga en el edge, sobrecarga de conexión. Overkill para flujo
  **unidireccional** servidor→cliente.
- **SSE (Server-Sent Events)**: HTTP ordinario con `Content-Type: text/event-stream`.
  La conexión se sostiene y el backend bombea impulsos asíncronos al suscriptor.
  Simple, edge-friendly. **Es el default** para reportar avance de tareas y streaming
  de tokens de un LLM.

## Implementación en Hono (`streamSSE`)

```ts
import { streamSSE } from 'hono/streaming'

app.get('/tasks/:id/stream', (c) => {
  return streamSSE(c, async (stream) => {
    const taskId = c.req.param('id')
    while (true) {
      const state = await pollTask(taskId)          // máquina de estados / cola
      await stream.writeSSE({
        event: 'progress',
        data: JSON.stringify({ pct: state.pct, msg: state.msg }),
      })
      if (state.done) {
        await stream.writeSSE({ event: 'done', data: 'SUCCESS' })  // cierre explícito
        break
      }
      await stream.sleep(1000)
    }
  })
})
```

## Reglas
- Cada mensaje es un objeto con `event` (categoría) + `data` (payload), separado por
  saltos de línea estandarizados. El framework abstrae el buffering.
- **Siempre cierra con un evento de estado final** (`done`/`SUCCESS`/`error`). Sin él,
  el cliente queda colgado esperando.
- El cliente consume con `EventSource` (browser) o un lector de stream (agente).
- Para tokens de un LLM: emite un `event: token` por chunk, `event: done` al final.
- No confundas con MCP-over-SSE: ahí el SSE transporta JSON-RPC (ver `mcp-server.md`).
