# gps_probe — diagnóstico de baud y salud del GPS

Vuelca el **UART2 crudo** del GPS a la consola USB, alternando **9600** y **115200**
cada 10 s. Sirve para decidir, sin adivinar, si un módulo GPS habla, a qué baud, y si
emite NMEA válido con o sin fix.

## Cuándo usarla
El GPS no da posición y no sabes si es **baud**, **cableado** o **falta de cielo**.
El firmware normal solo muestra `link`/`sat`; esto muestra los **bytes reales**.

## Conexiones (mínimas)
| GPS | ESP32 | Nota |
|---|---|---|
| TX | GPIO16 | ← el ESP escucha aquí (RX) |
| RX | GPIO17 | opcional (comandos al GPS) |
| VCC | 5V/VIN | ⚠️ NUNCA a un GPIO |
| GND | GND | común obligatorio |

## Cargar y ver
```bash
arduino-cli compile --fqbn esp32:esp32:esp32 tests/gps_probe
arduino-cli upload -p /dev/cu.usbserial-XX --fqbn "esp32:esp32:esp32:UploadSpeed=115200" tests/gps_probe
arduino-cli monitor -p /dev/cu.usbserial-XX -c baudrate=115200
```

## Cómo interpretar
Cada ventana imprime un resumen: `resumen @ <baud>: <N> bytes, <M> sentencias '$'`.

| Observación | Diagnóstico |
|---|---|
| A un baud ves líneas ASCII `$GPGGA,...`/`$GNRMC,...` y **M>0** | **ese es el baud correcto**, el módulo funciona |
| `$..GGA,,,,,,0,00,...` (campos vacíos, fix 0, 00 sats) | módulo OK pero **sin fix** → falta cielo |
| `$GPTXT,...,ANTENNA OK` | la antena conecta bien |
| `$GPGSV,...` lista satélites visibles | ve satélites; necesita **≥4** para posición |
| Basura/`��` y **M=0** a **ambos** bauds | **cableado** (TX del GPS no llega a GPIO16) o nivel lógico |

## Resultado real (Centinela 02, 2026-07-22)
`115200` → 4160 bytes, **120 sentencias válidas**, `ANTENNA OK`. `9600` → 345 bytes, **0
sentencias** (basura). Conclusión: **115200 es el baud correcto** (como Centinela 01);
el módulo de repuesto estaba sano — solo faltaba cielo. Con vista despejada enganchó
`fix=OK sat=7`.
