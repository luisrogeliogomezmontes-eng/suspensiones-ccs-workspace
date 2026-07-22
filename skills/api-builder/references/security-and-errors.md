# Seguridad (OWASP API Top 10) y errores (RFC 9457)

Con agentes autónomos operando en paralelo masivo, la superficie de ataque se dispara.
Esto es obligatorio, no opcional.

## Errores estandarizados — RFC 9457 (Problem Details)

Un `500` en blanco o un string sin formato impide que un LLM (function-calling / MCP)
se auto-corrija. RFC 9457 (moderniza y es retrocompatible con RFC 7807) define el
media type `application/problem+json` con campos formales:

| Campo | Significado |
|---|---|
| `type` | URI que documenta el tipo de fallo. |
| `title` | Resumen corto y estable del error. |
| `status` | Código HTTP. |
| `detail` | Diagnóstico específico de **esta** ocurrencia — hazlo accionable. |
| `instance` | URI/ID de esta ocurrencia (trazabilidad). Añade `timestamp`. |

```ts
function problem(c, { type, title, status, detail }) {
  return c.json(
    { type, title, status, detail, instance: c.req.url, timestamp: new Date().toISOString() },
    status,
    { 'Content-Type': 'application/problem+json' },
  )
}

// uso
return problem(c, {
  type: 'https://api.ej/errors/not-found',
  title: 'Device no encontrado',
  status: 404,
  detail: "device_id 'a1b2' no existe. Lista los válidos en GET /devices y reintenta.",
})
```

Conecta esto al `defaultHook` del scaffold para que **toda** validación fallida salga
en este formato. Para Express/Fastify existen middlewares equivalentes
(`hono-problem-details`, `express-http-problem-details`).

## OWASP API Security Top 10 (2025/2026) — lo que más duele

### A01 — Broken Access Control (BOLA/BFLA) — la #1
Los atacantes acceden a datos de otros cambiando un ID en el body/URL que el servidor
no verifica.
- **Nunca** confíes en un ID que viene en la request para decidir autorización.
- Verifica **en cada request** que el usuario autenticado es dueño/tiene permiso sobre
  ese recurso. **Deny-by-default**: sin regla explícita que permita → se niega.
- BFLA: chequea permisos a nivel de **función/endpoint**, no solo de objeto.

### A02 — Security Misconfiguration (incidencia ~100%)
- Sin defaults inseguros, sin endpoints de nube expuestos indiscriminadamente.
- **Nunca filtres stack traces** al cliente (usa RFC 9457 con `detail` controlado; el
  trace va a logs internos).
- CORS restrictivo, headers de seguridad, TLS.

### API4 — Unrestricted Resource Consumption (crítico con agentes)
Agentes que iteran en bucle pueden colapsar (y facturar) un microservicio con
invocaciones en cadena o loops no intencionales.
- **Rate limiting** obligatorio (por IP / por token / por device).
- Timeouts, límites de tamaño de payload, paginación con tope.
- Cuotas por cliente. Esto también contiene bucles de recuperación descontrolados.

## Checklist de seguridad
- [ ] Authz deny-by-default, ownership verificado por request (no confiar en IDs).
- [ ] Errores en `application/problem+json`, sin stack traces filtrados.
- [ ] Rate limiting + timeouts + límite de payload.
- [ ] Secretos en env vars, nunca en el repo.
- [ ] CORS/headers/TLS configurados; sin defaults inseguros.
- [ ] Validación Zod en el borde de cada endpoint (primera línea de defensa).
