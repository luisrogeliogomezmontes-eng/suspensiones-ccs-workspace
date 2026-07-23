#pragma once
#include <Arduino.h>
// Configuración central: pines y umbrales. Cero números mágicos en el código.
// ⚠️ Todo el I/O del ESP32 es 3.3V y NO tolera 5V. Ver CLAUDE.md §6.

// ---- Serial ----
constexpr uint32_t SERIAL_BAUD = 115200;

// ---- GPS (UART2) ----
constexpr uint32_t GPS_BAUD = 115200;   // ⚠️ módulo del equipo configurado a 115200 (NEO default = 9600)

// ---- Pines ----
constexpr int PIN_FAN      = 26;  // PWM 25kHz → hilo AZUL del fan 4-pin (velocidad). Driver interno del fan; MOSFET eliminado (D26)
constexpr int PIN_FAN_TACH = 27;  // tach (hilo AMARILLO) → RPM. Open-collector: pull-up a 3.3V (⚠️ NUNCA 5V/12V → fríe el pin)
constexpr int PIN_DHT22    = 4;   // DATA del DHT22 (hilo de señal en D4; módulo de 3 patas trae pull-up)
// ⚠️ El pin 3V3 del header se dañó físicamente (perdió el pad). Alimentamos el DHT22
// desde un GPIO puesto en HIGH: sale 3.3V del MISMO riel interno (vivo, el ESP corre en 3.3V).
// DHT22 ≈1.5mA ≪ 40mA (máx abs por pin). SOLO para el DHT22 — el GPS (5V, ~30mA) va a 5V/VIN, NUNCA a un GPIO.
constexpr int PIN_DHT22_PWR = 32;  // salida HIGH = "3.3V de repuesto" para el VCC del DHT22 (cableado a D32)
constexpr int PIN_GPS_RX  = 16;  // UART2 RX  (<- TX del GPS)
constexpr int PIN_GPS_TX  = 17;  // UART2 TX  (-> RX del GPS)

// ---- Fan PWM (4 hilos: +12V, GND, TACH, PWM) — D26 ----
// El fan (12V, ~2.7A) trae driver interno: NO se corta la potencia con MOSFET.
// El ESP32 manda la velocidad por el hilo azul a ~25 kHz (fuera del audible).
// +12V y GND van directos al riel de 12V. Ver esquemas C/F.
constexpr uint32_t FAN_PWM_FREQ_HZ  = 25000;  // spec Intel 4-wire (21–28 kHz); <20k → chilla
constexpr uint8_t  FAN_PWM_RES_BITS = 8;      // resolución del duty: 0–255
constexpr uint8_t  FAN_PWM_CHANNEL  = 0;      // canal LEDC (solo core 2.x; en 3.x se liga al pin)
constexpr int      FAN_MIN_DUTY     = 30;     // % mínimo para que el rotor arranque (piso de la rampa)
constexpr int      FAN_MAX_DUTY     = 70;     // ⚠ TOPE por corriente: 2 fans (~2.7A c/u) deben sumar <5A en el conector DC 2.1mm (D26). Ajustar tras medir con multímetro
constexpr int      FAN_SLEW_PER_TICK = 20;    // %/tick de control (1s): soft-start; evita el pico de arranque (inrush) de 2 fans en el conector
constexpr int      FAN_SAFE_DUTY    = 100;    // fail-safe si cae el sensor/comms → lo recorta FAN_MAX_DUTY (nunca excede el conector)
constexpr uint8_t  FAN_TACH_PPR     = 2;      // pulsos de tach por vuelta (estándar 4-wire)

// ---- Control de temperatura (banda proporcional con piso) ----
// ⚠️ Umbrales de PRUEBA (yesquero, temp ambiente ~25°C). En producción subir
// a los valores reales del equipo (Starlink/EcoFlow ~55-60°C).
// ⚠️ DEFAULTS de FÁBRICA (config.h). En unidades ya desplegadas, un `setpoint`
// remoto por /control los sobrescribe y **persiste en NVS** (net.cpp::saveControl)
// → estos valores solo aplican en el primer arranque o tras borrar la NVS.
constexpr float TEMP_ON_C  = 40.0f;    // ≥ este valor → FAN_MAX_DUTY (70% = tope real "100%")
constexpr float TEMP_OFF_C = 25.0f;    // ≤ este valor → 0% (mínimo); >25 empieza a acelerar. Rampa 25→40 °C

// ---- Periodos del scheduler (ms) ----
constexpr uint32_t SAMPLE_PERIOD_MS  = 1000;
constexpr uint32_t CONTROL_PERIOD_MS = 1000;
constexpr uint32_t REPORT_PERIOD_MS  = 2000;

// ---- Perfil de build (mismo código para toda la flota) ------------------
// GPS_ONLY 1 → RTU de rastreo puro (una por Starlink): SOLO GPS (UART2) +
//   telemetría HTTPS→Supabase. No inicializa DHT22 ni fan; el POST envía solo
//   ubicación + salud (GPS/WiFi). Es el perfil de ESTA unidad (solo GPS cableado).
// GPS_ONLY 0 → unidad completa: DHT22 (GPIO4) + fan PWM 4-hilos + GPS (ver D26).
#define GPS_ONLY 0

// ---- Sensores presentes (activar cuando se instale el hardware real) ----
// Con 0: la telemetría NO reporta temp/fan (envía null) para no ensuciar la BD
// con datos simulados. 1 = DHT22 real conectado en PIN_DHT22.
#if GPS_ONLY
  #define HAS_TEMP_SENSOR 0   // RTU solo-GPS: no hay DHT22 cableado
#else
  #define HAS_TEMP_SENSOR 1
#endif

// ---- Telemetría (Fase 2): ESP32 → HTTPS POST → Supabase ----
constexpr uint32_t TELEMETRY_PERIOD_MS = 5000;   // 1 fila cada 5 s (ajustar por costo Starlink)
constexpr uint32_t COMMAND_POLL_MS     = 5000;   // I3.2: revisa comandos pendientes cada 5 s
constexpr uint32_t HTTP_TIMEOUT_MS     = 8000;   // corta si el POST cuelga

// device_id de esta unidad → vive en secrets.h (git-ignored, POR-UNIDAD) junto al
// DEVICE_TOKEN: son un PAR (el token corresponde a este device_id en device_tokens).
// NO se hornea aquí a propósito → reflashear otra unidad desde el repo NO le pone el
// ID de otra (evita colisión de datos entre Centinelas). Ver secrets.h.example.
// NO es secreto, pero sí per-unidad. La compilación falla ruidoso si falta (net.cpp).

// ---- WiFi (reconexión no bloqueante con backoff) ----
constexpr uint32_t WIFI_RETRY_MIN_MS = 2000;
constexpr uint32_t WIFI_RETRY_MAX_MS = 30000;

// ---- Provisioning WiFi (portal cautivo si no hay credenciales guardadas) ----
// Al arrancar sin creds (o si no logra conectar), el ESP32 abre un AP con un
// formulario web para elegir la red. Las creds se guardan en NVS (Preferences).
constexpr const char* WIFI_AP_PREFIX       = "SuspensionesP1-";
constexpr const char* WIFI_AP_PASSWORD     = "config1234";   // ≥8 chars para el AP de setup
constexpr uint32_t    WIFI_CONNECT_TIMEOUT_MS = 25000;       // sin conectar en este tiempo → abre portal

// ---- NTP: sella la hora en origen (ts) si el GPS aún no tiene fecha/hora ----
constexpr const char* NTP_SERVER_1 = "pool.ntp.org";
constexpr const char* NTP_SERVER_2 = "time.google.com";
