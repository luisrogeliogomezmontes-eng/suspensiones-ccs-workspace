# tests/ — Pruebas de hardware y firmware

Sketches **standalone** y guías para probar subsistemas de forma aislada, sin cargar el
firmware completo (`firmware/`). Cada prueba valida **una cosa** con lo mínimo conectado.

> Los sketches de Arduino necesitan que la **carpeta se llame igual que el `.ino`**.
> Por eso cada prueba vive en su propia carpeta `nombre/nombre.ino` + una `GUIA.md`.

## Índice de pruebas

| Prueba | Qué valida | Estado | Guía |
|---|---|---|---|
| [fan_pwm_web](fan_pwm_web/) | Control de velocidad de los fans 4-hilos PWM (D26) con interfaz web (AP `FanTest` → slider) | ✅ validada 2026-07-19 | [GUIA.md](fan_pwm_web/GUIA.md) |
| [gps_probe](gps_probe/) | Baud y salud del GPS: vuelca UART2 crudo a 9600/115200 y muestra si hay NMEA válido | ✅ usada 2026-07-22 (Centinela 02) | [GUIA.md](gps_probe/GUIA.md) |

## Convención para agregar una prueba

1. Carpeta nueva `tests/<nombre>/` con `<nombre>.ino` dentro.
2. Una `GUIA.md` al lado: qué prueba, conexiones, cómo cargar, cómo usar, cómo verificar.
3. Agrega una fila a la tabla de arriba.

## Comandos base

```bash
# compilar
arduino-cli compile --fqbn esp32:esp32:esp32 tests/<nombre>

# puerto (cambia al reconectar el ESP)
arduino-cli board list

# cargar (⚠️ 115200 baud en esta placa; 921600 falla)
arduino-cli upload -p /dev/cu.usbserial-XX --fqbn "esp32:esp32:esp32:UploadSpeed=115200" tests/<nombre>

# monitor serie
arduino-cli monitor -p /dev/cu.usbserial-XX -c baudrate=115200
```
