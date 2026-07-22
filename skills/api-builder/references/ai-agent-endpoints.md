# Diseño de endpoints para agentes / function-calling

Diseñar para un LLM subvierte décadas de intuición del desarrollo web humano. El
agente asimila la información **linealmente por tokens** y carece de la inferencia
pragmática de un usuario biológico. Cada contrato de herramienta va en el contexto
maestro en **cada** invocación → impacta costo (tokens) y latencia. Regla base:
**concisión descriptiva extrema + verbosidad semántica explícita.**

## Los 4 mandatos

### 1. Granularidad: tareas dirigidas, no CRUD crudo
No expongas gateways CRUD de una tabla relacional sin refinar. Un LLM falla al inferir
dependencias entre cien campos variables. Abstrae en **flujos RPC acotados** que
agrupan la lógica de negocio en el núcleo y le presentan al agente un panorama
estrecho y enfocado a un propósito.

- ❌ `POST /rows` con 40 campos libres de la tabla `orders`.
- ✅ `POST /orders/place` que recibe {items, customer_id} y maneja stock, precio,
  impuestos internamente.

### 2. Nombres y descripciones intuitivas
El agente es prisionero del vocabulario con que fue entrenado. Abreviaturas
corporativas enigmáticas → desajuste y rechazo.

- Claves **largas y comprensibles**: `shipping_address_country`, no `sac`.
- Descripciones Markdown ricas en el esquema OpenAPI: explican el propósito **y**
  incluyen **cuándo es imperativo invocar** la función (guía la priorización).

```ts
z.object({
  destination_currency_code: z.enum(['USD', 'EUR', 'VES']).openapi({
    description: 'Código ISO-4217 de la moneda destino. Usa el código, nunca el nombre.',
  }),
}).openapi({ description: 'Convierte un monto. Invocar SIEMPRE que el usuario pida un precio en otra moneda.' })
```

### 3. Restricciones axiomáticas de datos
- `enum` (listas restrictivas) siempre que la lógica lo permita. Obligar al modelo a
  inferir "Dólares Americanos" en vez de dar `USD` colapsa la red subyacente.
- **Idempotencia**: los agentes reintentan en bucles de recuperación. Múltiples
  invocaciones idénticas deben ser seguras (idempotency key donde haya efectos).

### 4. Errores hiper-instructivos (NO "Error 404")
El rechazo hacia un LLM debe inyectar texto que **induzca a reconstruir el intento**:
mecanismos alternativos, parámetros de reparación. Guía la rectificación iterativa sin
suspender la tarea. Formatea en RFC 9457 (ver `security-and-errors.md`) con un `detail`
accionable:

```json
{
  "type": "https://api.ej/errors/invalid-currency",
  "title": "Moneda no soportada",
  "status": 422,
  "detail": "'Dolares' no es válido. Usa un código ISO-4217: USD, EUR o VES. Reintenta con destination_currency_code='USD'."
}
```

## Checklist antes de exponer una tool a un agente
- [ ] ¿Es una tarea acotada, no CRUD crudo?
- [ ] ¿Nombres de parámetros legibles, sin abreviaturas internas?
- [ ] ¿Descripción dice **qué hace** y **cuándo invocar**?
- [ ] ¿Valores restringidos como `enum`?
- [ ] ¿Idempotente ante reintentos?
- [ ] ¿Los errores guían la auto-corrección con un `detail` accionable?
