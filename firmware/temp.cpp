#include "temp.h"
#include <DHT.h>
#include "config.h"

// DHT22 en PIN_DHT22 (config.h). Módulo de 3 patas ya trae pull-up en DATA.
static DHT s_dht(PIN_DHT22, DHT22);

void tempBegin() {
  s_dht.begin();
}

float tempReadC() {
  return s_dht.readTemperature();  // Celsius; NaN si el sensor no responde
}

float tempReadHumidity() {
  return s_dht.readHumidity();
}
