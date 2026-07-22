#include "gps.h"
#include "config.h"
#include <TinyGPSPlus.h>

// Integra el script del equipo, pero SIN delay() ni while(true) que cuelguen el sistema.
static TinyGPSPlus gps;
static GpsFix      g_fix;

void gpsBegin() {
  // Buffer RX amplio: tolera bloqueos breves de otras tareas (p.ej. lectura del
  // DHT22) sin perder sentencias NMEA. Llamar ANTES de begin().
  Serial2.setRxBufferSize(1024);
  // UART2 del ESP32. El módulo del equipo trabaja a 115200 (NEO default = 9600).
  Serial2.begin(GPS_BAUD, SERIAL_8N1, PIN_GPS_RX, PIN_GPS_TX);
}

void gpsService() {
  // Drena el buffer UART y alimenta al parser en cada llamada (no se pierden bytes NMEA).
  while (Serial2.available() > 0) {
    gps.encode(Serial2.read());
  }

  g_fix.charsProcessed = gps.charsProcessed();
  g_fix.linkOk = gps.charsProcessed() > 10;   // reemplaza el while(true) fatal del script original
  g_fix.valid  = gps.location.isValid();

  if (gps.location.isValid())  { g_fix.lat = gps.location.lat(); g_fix.lng = gps.location.lng(); }
  if (gps.speed.isValid())       g_fix.speed_kmph = gps.speed.kmph();
  if (gps.course.isValid())      g_fix.course_deg = gps.course.deg();
  if (gps.altitude.isValid())    g_fix.altitude_m = gps.altitude.meters();
  if (gps.satellites.isValid())  g_fix.satellites = gps.satellites.value();
  if (gps.hdop.isValid())        g_fix.hdop = gps.hdop.hdop();
  g_fix.dateValid = gps.date.isValid();
  g_fix.timeValid = gps.time.isValid();
}

const GpsFix& gpsGet() { return g_fix; }
