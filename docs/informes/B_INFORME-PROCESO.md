# Informe de Proceso y Desarrollo — Proyecto 1

> **Documento B de 3.** El CAMINO: prototipos, pruebas, decisiones y cómo se llegó a las
> conclusiones. Se nutre de [docs/BITACORA.md](../BITACORA.md) y de las decisiones D1–D15
> de [MEMORY.md](../../MEMORY.md). Complementa la memoria técnica ([A](A_MEMORIA-TECNICA.md)).
>
> _Estado: borrador · Autor: Luis Rogelio Gómez · Última actualización: 2026-07-11_

---

## 1. Introducción
- Propósito de este documento (trazabilidad del desarrollo, no manual ni entregable formal).

## 2. Metodología de trabajo
- Enfoque iterativo (prototipo que funciona > elegante sin probar).
- Herramientas (arduino-cli, Supabase, dashboard Next.js, control de versiones).

## 3. Línea de tiempo del desarrollo
_Tabla cronológica desde la BITÁCORA (sesión → objetivo → resultado)._

## 4. Decisiones de diseño y su justificación
_Destilar D1–D15 de MEMORY. Para cada una: contexto → alternativas → decisión → por qué._
| # | Decisión | Alternativas descartadas | Por qué |
|---|---|---|---|
| D1 | ESP32 | Arduino Uno/Nano | … |
| … | … | … | … |

## 5. Prototipos y pruebas
### 5.1 Firmware (evolución)
- GPS bloqueante → módulo no bloqueante; telemetría en tarea FreeRTOS; portal cautivo WiFi.
### 5.2 Subsistema de control de carga
- **Pruebas a distintas RPM**: montaje, qué se midió, instrumentos.
- Cómo se eligieron los umbrales de voltaje a partir de los datos.
- Iteraciones del driver (relé vs MOSFET → por qué relé).
### 5.3 Gestión térmica
- Elección de sensor, ajuste de la banda de histéresis.

## 6. Problemas encontrados y soluciones
_Tabla: síntoma → causa raíz → solución._ (ej: upload 921600 → "invalid head of packet" → bajar a 115200; WiFi 5GHz → ESP32 es 2.4GHz only; etc.)

## 7. Análisis de datos y obtención de conclusiones
- Cómo se procesaron las mediciones del estudio de eficiencia.
- Criterio para las gráficas y los umbrales finales.

## 8. Lecciones aprendidas
- Qué se haría igual, qué distinto.

## Anexos
- Enlaces a la BITÁCORA, commits relevantes, datos crudos.
