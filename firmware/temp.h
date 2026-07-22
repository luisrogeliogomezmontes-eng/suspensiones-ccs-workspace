#pragma once
// Sensor de temperatura/humedad DHT22 (AM2302).
// Lectura no bloqueante en la práctica: la librería cachea ~2 s internamente,
// así que se puede llamar en cada ciclo sin penalizar.

void  tempBegin();
float tempReadC();         // °C  (NaN si falla o no está conectado)
float tempReadHumidity();  // %HR (NaN si falla) — bonus del DHT22 (riesgo de condensación)
