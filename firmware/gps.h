#pragma once
#include <Arduino.h>

// Snapshot del último estado del GPS (no bloqueante).
// Lo consumen la telemetría, el control y el dashboard.
struct GpsFix {
  bool     linkOk         = false; // el módulo envía datos (cableado/baud OK)
  bool     valid          = false; // hay fix de posición válido
  double   lat            = 0.0;
  double   lng            = 0.0;
  double   speed_kmph     = 0.0;
  double   course_deg     = 0.0;
  double   altitude_m     = 0.0;
  uint32_t satellites     = 0;
  double   hdop           = 0.0;
  bool     dateValid      = false;
  bool     timeValid      = false;
  uint32_t charsProcessed = 0;
};

void          gpsBegin();    // arranca Serial2 con la config de config.h
void          gpsService();  // llamar en CADA loop(): NO bloqueante, alimenta el parser
const GpsFix& gpsGet();      // último snapshot conocido
