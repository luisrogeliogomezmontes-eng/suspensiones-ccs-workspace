/**
 * Suspensiones Caracas — Proyecto 1   (Arduino-ESP32 / arduino-cli)
 * Firmware unificado de la flota. Un flag de build (GPS_ONLY en config.h) elige el perfil:
 *   • GPS_ONLY 1 → RTU de rastreo puro (una por Starlink): solo GPS (UART2) +
 *     telemetría HTTPS→Supabase. NO inicializa temp ni fan; el POST envía solo
 *     ubicación + salud (GPS/WiFi). Perfil de ESTA unidad.
 *   • GPS_ONLY 0 → unidad completa: DHT22 (GPIO4) + fan PWM 4-hilos
 *     (GPIO26 PWM / GPIO27 tach) + GPS + telemetría (ver D26).
 * Loop NO bloqueante (scheduler por millis). Ver CLAUDE.md §4.
 */
#include <Arduino.h>
#include <math.h>
#include "config.h"
#include "gps.h"
#include "net.h"
#include "temp.h"

#if !GPS_ONLY
// ---- Estado (unidad completa) ----
static float    g_temp_c   = NAN;
static int      g_fan_duty  = 0;   // velocidad del fan 0–100 %
static uint32_t g_fan_rpm   = 0;   // RPM medido por el tach (0 si no está conectado)

// ---- Tach del fan (ISR cuenta pulsos; el RPM se calcula en report) ----
static volatile uint32_t g_tachPulses = 0;
static portMUX_TYPE      g_tachMux     = portMUX_INITIALIZER_UNLOCKED;
static uint32_t          g_tachLastMs  = 0;
static void IRAM_ATTR tachISR() {
  portENTER_CRITICAL_ISR(&g_tachMux);
  g_tachPulses++;
  portEXIT_CRITICAL_ISR(&g_tachMux);
}

// ---- PWM del fan (API LEDC según el core: 2.x liga por canal, 3.x por pin) ----
static void fanPwmInit() {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcAttach(PIN_FAN, FAN_PWM_FREQ_HZ, FAN_PWM_RES_BITS);
#else
  ledcSetup(FAN_PWM_CHANNEL, FAN_PWM_FREQ_HZ, FAN_PWM_RES_BITS);
  ledcAttachPin(PIN_FAN, FAN_PWM_CHANNEL);
#endif
}
static void fanPwmWrite(int duty_pct) {
  if (duty_pct < 0) duty_pct = 0;
  else if (duty_pct > FAN_MAX_DUTY) duty_pct = FAN_MAX_DUTY;          // tope duro: nunca exceder la corriente del conector
  const int raw = (duty_pct * ((1 << FAN_PWM_RES_BITS) - 1)) / 100;   // 0–100% → 0–255
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWrite(PIN_FAN, raw);
#else
  ledcWrite(FAN_PWM_CHANNEL, raw);
#endif
}

// ---- Prototipos (unidad completa) ----
static float readTemperatureC();        // DHT22 real (temp.cpp); simulado solo si HAS_TEMP_SENSOR 0
static void  applyFanControl(float t);  // banda proporcional + fail-safe → duty PWM
static void  updateFanRpm();            // calcula RPM desde los pulsos del tach
#endif  // !GPS_ONLY

static void report();

// ---- Scheduler no bloqueante ----
#if !GPS_ONLY
static void taskSample()  { g_temp_c = readTemperatureC(); }
static void taskControl() {
  applyFanControl(g_temp_c);
  // Alimenta la tarea de telemetría. La TEMP se reporta solo si hay sensor real y
  // la lectura es válida (DHT22 caído → NaN → envía null, no basura). El FAN, en
  // cambio, SIEMPRE se reporta en la unidad completa: aunque el sensor esté muerto
  // el fan gira en fail-safe (FAN_SAFE_DUTY) → mostrar ese duty es diagnóstico útil
  // (se ve "temp=null, fan=70%" = sensor caído, no fan apagado).
  const bool tvalid = (HAS_TEMP_SENSOR != 0) && !isnan(g_temp_c);
  const bool fan_on = g_fan_duty > 0;
  netSetSnapshot(tvalid, g_temp_c, /*hasFan=*/true, fan_on, g_fan_duty);
}
#endif
static void taskReport()  { report(); }

struct Task { uint32_t last; uint32_t period; void (*fn)(); };
static Task tasks[] = {
#if !GPS_ONLY
  { 0, SAMPLE_PERIOD_MS,  taskSample  },
  { 0, CONTROL_PERIOD_MS, taskControl },
#endif
  { 0, REPORT_PERIOD_MS,  taskReport  },
};
// GPS_ONLY: el snapshot de red queda en su default (sin temp/fan) → el POST
// envía solo ubicación + salud. No hace falta taskSample/taskControl.

void setup() {
  Serial.begin(SERIAL_BAUD);
#if !GPS_ONLY
  fanPwmInit();
  g_fan_duty = 0;
  fanPwmWrite(0);                          // arranca apagado; el control rampa al objetivo (soft-start, evita inrush)
  pinMode(PIN_FAN_TACH, INPUT_PULLUP);     // tach open-collector (+ pull-up externo 3.3V recomendado)
  attachInterrupt(digitalPinToInterrupt(PIN_FAN_TACH), tachISR, FALLING);
#endif
#if HAS_TEMP_SENSOR
  pinMode(PIN_DHT22_PWR, OUTPUT);
  digitalWrite(PIN_DHT22_PWR, HIGH);       // 3.3V de repuesto para el DHT22 (pin 3V3 del header dañado). ~1.5mA ≪ 40mA
  delay(1000);                             // el DHT22 pide ~1s tras energizar antes de la 1ª lectura (setup, no el loop)
  tempBegin();                             // DHT22
#endif
  gpsBegin();
  netBegin();                              // WiFi + NTP + tarea de telemetría (core 0)
#if GPS_ONLY
  Serial.println(F("\n[BOOT] Suspensiones — RTU GPS (solo ubicación) + telemetría"));
#else
  Serial.println(F("\n[BOOT] Suspensiones P1 — temp + fan PWM + GPS + telemetría"));
#endif
}

void loop() {
  gpsService();                            // cada iteración: no perder bytes NMEA
  const uint32_t now = millis();
  for (auto &t : tasks)
    if (now - t.last >= t.period) { t.last = now; t.fn(); }
}

// ---- Implementación (unidad completa) ----
#if !GPS_ONLY
static float readTemperatureC() {
#if HAS_TEMP_SENSOR
  return tempReadC();                                // DHT22 real (NaN si no responde)
#else
  return 25.0f + 10.0f * sinf(millis() / 5000.0f);   // simulado (sin sensor)
#endif
}

static void applyFanControl(float t) {
  // Modo fijado por comandos remotos (I3.2): override manual (on/off) o auto.
  const int mode = netFanMode();
  int target;                                // duty objetivo 0–100 %
  if (mode == FAN_ON) {
    target = FAN_MAX_DUTY;                    // "on" remoto = máximo permitido por el conector
  } else if (mode == FAN_OFF) {
    target = 0;
  } else {                                   // FAN_AUTO: banda proporcional con piso
    const float on  = netTempOn();
    const float off = netTempOff();
    if (isnan(t))             target = FAN_SAFE_DUTY;            // sensor caído → fail-safe
    else if (t <= off)        target = 0;                       // frío → apagado
    else if (t >= on)         target = FAN_MAX_DUTY;            // caliente → máximo permitido
    else if (on - off < 0.5f) target = (t >= on) ? FAN_MAX_DUTY : 0;
    else {                                                      // dentro de la banda → rampa lineal
      const float frac = (t - off) / (on - off);                // 0..1
      target = FAN_MIN_DUTY + (int)(frac * (FAN_MAX_DUTY - FAN_MIN_DUTY));
    }
  }
  if (target > FAN_MAX_DUTY) target = FAN_MAX_DUTY;             // tope duro por corriente del conector (recorta fail-safe)
  // Slew-rate: acerca el duty al objetivo poco a poco (soft-start; evita el inrush de 2 fans en el conector).
  if      (target > g_fan_duty) g_fan_duty = min(target, g_fan_duty + FAN_SLEW_PER_TICK);
  else if (target < g_fan_duty) g_fan_duty = max(target, g_fan_duty - FAN_SLEW_PER_TICK);
  fanPwmWrite(g_fan_duty);
}

static void updateFanRpm() {
  const uint32_t now = millis();
  const uint32_t dt  = now - g_tachLastMs;
  if (dt < 1000) return;                       // ventana ≥1s para buena resolución
  portENTER_CRITICAL(&g_tachMux);
  const uint32_t pulses = g_tachPulses; g_tachPulses = 0;
  portEXIT_CRITICAL(&g_tachMux);
  g_tachLastMs = now;
  g_fan_rpm = (pulses * 60000UL) / (dt * FAN_TACH_PPR);   // 2 pulsos/vuelta
}
#endif  // !GPS_ONLY

static void report() {
#if !GPS_ONLY
  updateFanRpm();
#endif
  const GpsFix& f = gpsGet();
  const uint32_t age = netLastOkAgeMs();
#if GPS_ONLY
  Serial.printf(
    "[t=%lus] RTU-GPS | GPS link=%s fix=%s sat=%lu pos=%.6f,%.6f %.1fkm/h | "
    "WiFi=%s %ddBm ntp=%s post=%s\n",
    (unsigned long)(millis() / 1000),
    f.linkOk ? "ok" : "--", f.valid ? "OK" : "--",
    (unsigned long)f.satellites, f.lat, f.lng, f.speed_kmph,
    netInPortal() ? "PORTAL" : (netOnline() ? "ok" : "--"),
    netRssi(), netTimeSynced() ? "ok" : "--",
    age == UINT32_MAX ? "nunca" : (age < 15000 ? "ok" : "viejo"));
#else
  // Temp interna del die del ESP32 (sensor on-chip). ⚠️ Imprecisa y sesgada alta
  // (mide el die + autocalentamiento, no el aire); útil solo como SALUD del MCU y
  // contraste grueso con el DHT22, NO como medida ambiente. Aún no va a telemetría.
  const float esp_c = temperatureRead();
  Serial.printf(
    "[t=%lus] temp=%.1fC fan=%d%% rpm=%lu espC=%.0f | GPS link=%s fix=%s sat=%lu pos=%.6f,%.6f %.1fkm/h | "
    "WiFi=%s %ddBm ntp=%s post=%s\n",
    (unsigned long)(millis() / 1000), g_temp_c, g_fan_duty, (unsigned long)g_fan_rpm, esp_c,
    f.linkOk ? "ok" : "--", f.valid ? "OK" : "--",
    (unsigned long)f.satellites, f.lat, f.lng, f.speed_kmph,
    netInPortal() ? "PORTAL" : (netOnline() ? "ok" : "--"),
    netRssi(), netTimeSynced() ? "ok" : "--",
    age == UINT32_MAX ? "nunca" : (age < 15000 ? "ok" : "viejo"));
#endif
}
