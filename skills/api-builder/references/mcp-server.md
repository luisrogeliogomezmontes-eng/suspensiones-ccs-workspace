# Servidor MCP (Model Context Protocol)

MCP es el estándar "USB-C" para conectar agentes a datos/herramientas, resolviendo el
problema N×M (N modelos × M servicios). Arquitectura tripartita:
- **Host**: el modelo/IDE que orquesta (Claude, Cursor…).
- **Cliente MCP**: incrustado en el host, negocia por **JSON-RPC 2.0**.
- **Servidor MCP**: expone Resources, Tools y Prompts. Es lo que construyes.

## Los 3 tipos de capacidad

| Tipo | Qué es | Efectos | Ejemplo |
|---|---|---|---|
| **Resource** | Solo-lectura, referenciado por URI. Contexto estático. | Ninguno. | Leer un SOP, un informe, filas de una DB. |
| **Tool** | Operación con parámetros (Zod). Muta/acciona. | Sí (transacciones). | Crear incidencia Jira, escribir en PostgreSQL. |
| **Prompt** | Plantilla conversacional reutilizable. | — | Pre-configurar variables de un flujo. |

## Implementación (TypeScript)

```bash
npm i @modelcontextprotocol/sdk zod
```

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const server = new McpServer({ name: 'telemetria', version: '1.0.0' })

// Tool: valida SIEMPRE la entrada con Zod antes de causar efectos.
server.registerTool(
  'get_latest_reading',
  {
    description: 'Última lectura de temperatura de un device. Invocar cuando pidan el estado térmico actual.',
    inputSchema: { device_id: z.string().uuid() },
  },
  async ({ device_id }) => {
    const r = await db.latest(device_id)
    return { content: [{ type: 'text', text: JSON.stringify(r) }] }
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
```

## Reglas de producción (críticas)

1. **NUNCA `console.log()` / `print()` en transporte STDIO.** Contamina el JSON-RPC
   serializado y **rompe el protocolo** → desconexiones. Manda logs a **`stderr`**
   (`console.error`) o a un archivo. Esto es la causa #1 de servidores MCP rotos.
2. **Responsabilidad única.** Un servidor por dominio. Un macro-servidor con todos los
   accesos atrofia al agente (no encuentra la aguja en el pajar).
3. **Docker** para reproducibilidad, aislamiento de dependencias y límites de recursos.
4. Diseña las Tools con las mismas reglas de `ai-agent-endpoints.md`: tareas acotadas,
   nombres legibles, `enum`, idempotencia, errores accionables.

## HTTP/SSE vs STDIO
- **STDIO**: servidor local (mismo host que el agente). Simple, default para dev.
- **HTTP + SSE**: servidor remoto/multi-cliente. Ver `streaming-sse.md` para el transporte.
