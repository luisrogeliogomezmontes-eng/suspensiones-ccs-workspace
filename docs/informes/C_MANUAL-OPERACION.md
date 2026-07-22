# Manual de Operación y Esquemáticos — Proyecto 1

> **Documento C de 3.** Referencia OPERATIVA para quien usa/mantiene el equipo en campo.
> Cómo se conecta, cómo se enciende, cómo se diagnostica. Para el fundamento ver la
> memoria técnica ([A](A_MEMORIA-TECNICA.md)).
>
> _Estado: borrador · Autor: Luis Rogelio Gómez · Última actualización: 2026-07-13_

---

## 1. Descripción del equipo
- Qué hace, dónde se instala (maleta de moto), de qué se compone.

## 2. Especificaciones
- Alimentación, consumo, rangos de temperatura, voltajes de operación.

## 3. Esquemático y conexiones
### 3.1 Diagrama de conexionado
**Núcleo ESP32 (GPS + temp + fan):** ver diagrama visual en
[`C_esquema-nucleo-esp32.html`](C_esquema-nucleo-esp32.html) — abrir en el navegador (rieles
codificados por color: 12V rojo · 5V ámbar · 3.3V verde · señal azul · GND ⏚). Incluye tabla de
conexiones y BOM consolidada. Alimentación: **un solo USB-C** del EcoFlow → PD trigger 12V →
buck 5V al ESP32; fan directo del riel 12V, conmutado por MOSFET IRLZ44N (low-side, GPIO26).
_(Pendiente: agregar la vista del subsistema de carga del EcoFlow — relé + sense VBAT + XL4016.)_
### 3.2 Pinout (refleja `firmware/config.h`)
| Función | GPIO | Nota |
|---|---|---|
| DHT22 DATA | 4 | temp/humedad |
| Fan (driver) | 26 | on/off histéresis |
| GPS RX/TX | 16/17 | UART2 |
| Sense VBAT | 34 | ADC1, divisor + clamp 3.3V |
| Relé de carga | 25 | vía IRLZ44N; contacto NO = carga |
### 3.3 ⚠️ Advertencias eléctricas
- Todo el I/O es 3.3V (NO tolera 5V). Fusible en la línea de carga. Flyback en la bobina del relé. Fail-safe: relé desenergizado = NO carga.

## 4. Puesta en marcha
1. Alimentar el ESP32 (USB 5V desde EcoFlow).
2. Provisioning WiFi (portal cautivo `SuspensionesP1-XXXX`, clave `config1234`).
3. Verificación por Serial (GPS link, fix, WiFi, telemetría).
4. Confirmar lectura de VBAT y estado del relé de carga.

## 5. Operación normal
- Qué indica cada estado, dónde se ven los datos (dashboard live/local).
- Umbrales configurados (temp fan ON/OFF; carga VBAT ON/OFF).

## 6. Mantenimiento
- Revisiones periódicas (conexiones, fusible, socket del relé, antena GPS).

## 7. Solución de problemas (troubleshooting)
| Síntoma | Causa probable | Acción |
|---|---|---|
| No conecta WiFi | Red 5GHz / clave errada | Usar 2.4GHz; reabrir portal |
| Upload falla ("invalid head of packet") | Baud alto | Flashear a 115200 |
| No carga el EcoFlow | VBAT < umbral / fusible | Verificar voltaje y fusible |
| GPS sin fix | Sin cielo despejado | Reubicar antena |

## 8. Configuración de parámetros
- Dónde se cambian umbrales (`firmware/config.h`) y qué significa cada uno.

## Anexos
- Esquemático en alta resolución · Fotos del montaje · Contacto de soporte.
