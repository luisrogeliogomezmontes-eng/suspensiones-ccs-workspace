# Prueba: Fan PWM con interfaz web

Prueba **standalone** del control de velocidad de los fans 4-hilos PWM (D26), con una
interfaz web servida por el propio ESP32. **No** usa GPS, DHT22, Supabase ni tu red WiFi.

- **Sketch**: [fan_pwm_web.ino](fan_pwm_web.ino)
- **Esquema de conexiones**: [../../docs/informes/F_arquitectura.html](../../docs/informes/F_arquitectura.html) §3
- **Estado**: ✅ validada en hardware el 2026-07-19 (fan gira, tach lee ~2200 RPM @ 30%).

## Conexiones (recordatorio)

| Hilo del fan | Va a | Nota |
|---|---|---|
| **rojo** (+12V) | riel de 12V | potencia — la da el EcoFlow, **NO** el ESP32 |
| **negro** (GND) | GND común | ⚠️ el **mismo** GND del ESP32 (imprescindible) |
| **azul** (PWM) | **GPIO26** | directo, sin resistencia. Los 2 fans al mismo pin |
| **amarillo** (tach) | **GPIO27** | directo (pull-up interno). Solo Fan A; opcional |

> El **azul de los dos fans** va al mismo GPIO26 → giran al mismo duty. El tach solo se lee de Fan A.

## Cargar

Puerto típico: `/dev/cu.usbserial-XX` (cambia al reconectar — verifica con `arduino-cli board list`).
Subir a **115200 baud** (el 921600 da "invalid head of packet" en esta placa).

```bash
# desde la raíz del repo
arduino-cli compile --fqbn esp32:esp32:esp32 tests/fan_pwm_web
arduino-cli upload -p /dev/cu.usbserial-XX --fqbn "esp32:esp32:esp32:UploadSpeed=115200" tests/fan_pwm_web
```

## Usar la interfaz

1. Con el ESP alimentado, conecta el teléfono/laptop al WiFi:
   - **red**: `FanTest`  ·  **clave**: `fan12345`
2. Abre el navegador en **http://192.168.4.1**
3. Controla la velocidad:
   - **Slider** grande (0–70%) + número en vivo + **RPM**.
   - Botones rápidos: **Off · Bajo (30%) · Medio (50%) · Máx (70%)**.
   - Arranca en **30%** con soft-start (rampa suave, evita el pico de arranque).

## Parámetros (arriba del sketch)

| Constante | Valor | Qué hace |
|---|---|---|
| `FAN_MAX_DUTY` | `70` | ⚠️ **tope por corriente**: 2 fans (~2.7A c/u) deben sumar <5A en el conector 2.1mm. Súbelo solo si pruebas **1 fan** aislado |
| `START_DUTY` | `30` | velocidad inicial (baja) |
| `SLEW_STEP` | `3` | %/tick de la rampa (soft-start) |
| `PWM_FREQ_HZ` | `25000` | 25 kHz, fuera del audible |

## Verificar la corriente (antes de dejarlo fijo)

- Multímetro en **modo corriente DC (10A)** en serie con el **Nodo +12V** → con los 2 fans al tope debe leer **< 5A** (objetivo ~4A). ⚠️ no excedas el fusible de 10A del tester.
- Deja los 2 fans al tope 10–15 min y toca el **conector**: debe quedar **apenas tibio**.
- Si mide alto → baja `FAN_MAX_DUTY` y reflashea.

## Si el fan no gira

1. **GND común** (causa #1): si el ESP se alimenta por USB y el fan por el EcoFlow, une el **negativo del EcoFlow con el GND del ESP32**.
2. **12V ON**: el rojo del fan debe tener 12V reales (mide).
3. **Azul en GPIO26**: si quedó suelto, el fan corre a full fijo (pull-up interno del fan) sin obedecer el PWM.

## Volver al firmware real

Este sketch es aparte. Para volver a la unidad de campo, reflashea `firmware/` (perfil según `GPS_ONLY` en `config.h`).
