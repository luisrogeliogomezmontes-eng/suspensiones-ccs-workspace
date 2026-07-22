#pragma once
#include <Arduino.h>

// Telemetría de red (Fase 2): WiFi + HTTPS POST a Supabase.
// El envío corre en una tarea FreeRTOS propia (core 0) para NO bloquear el
// loop() (core 1), que debe seguir alimentando el GPS sin perder bytes NMEA.

// Arranca WiFi + NTP + la tarea de telemetría. Llamar una vez en setup().
void netBegin();

// Publica el último estado local (temp/fan) que la tarea incluirá en el POST.
// Llamar desde el loop cada ciclo de control. Protegido por mutex.
void netSetSnapshot(bool hasTemp, float temp_c, bool hasFan, bool fan_on, int fan_duty);

// Estado (para report()/fail-safe). Seguros de leer desde el loop.
bool     netInPortal();      // en modo portal de configuración (AP de setup)
bool     netOnline();        // WiFi asociado
bool     netTimeSynced();    // hora NTP lista (ts válido)
int      netRssi();          // dBm
uint32_t netLastOkAgeMs();   // ms desde el último POST correcto (UINT32_MAX si nunca)

// ── Control remoto (I3.2): estado fijado por los comandos de la nube ──────────
// El loop lee esto para decidir el fan. Modo: 0=auto (histéresis), 1=on, 2=off.
enum FanMode { FAN_AUTO = 0, FAN_ON = 1, FAN_OFF = 2 };
int   netFanMode();          // modo actual del fan (comando fan_mode)
float netTempOn();           // setpoint enciende (°C) — comando setpoint
float netTempOff();          // setpoint apaga (°C)
