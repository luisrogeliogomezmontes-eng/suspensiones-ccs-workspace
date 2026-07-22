// gps_probe.ino — diagnóstico de GPS: vuelca UART2 CRUDO a la consola USB,
// alternando 9600 y 115200 cada 10 s, para saber si el módulo emite NMEA
// válido ($GPGGA/$GNRMC...) y a qué baud. Pines fijos: RX=16, TX=17 (D26/config).
//
// Interpretación:
//   - Si a un baud ves líneas ASCII tipo "$GPGGA,123519,4807.038,N,..." → ese es
//     el baud correcto y el módulo funciona (mira el campo de nº de satélites).
//   - Si solo ves basura/�� a ambos → cableado (TX del GPS no llega a GPIO16) o
//     nivel lógico.
//   - "$..GGA,,,,,," con campos vacíos = módulo OK pero SIN fix (falta cielo).
//
// Uso: arduino-cli compile --fqbn esp32:esp32:esp32 tests/gps_probe
//      arduino-cli upload -p <puerto> --fqbn esp32:esp32:esp32:UploadSpeed=115200 tests/gps_probe
//      arduino-cli monitor -p <puerto> -c baudrate=115200

constexpr int PIN_GPS_RX = 16;   // <- TX del GPS
constexpr int PIN_GPS_TX = 17;   // -> RX del GPS
const uint32_t BAUDS[] = { 9600, 115200 };
constexpr uint32_t DWELL_MS = 10000;

uint8_t  idx = 0;
uint32_t lastSwitch = 0;
uint32_t byteCount = 0;
uint32_t dollarCount = 0;   // nº de '$' (inicio de sentencia NMEA)

void startBaud(uint32_t b) {
  Serial2.end();
  delay(50);
  Serial2.begin(b, SERIAL_8N1, PIN_GPS_RX, PIN_GPS_TX);
  byteCount = 0;
  dollarCount = 0;
  Serial.println();
  Serial.printf("\n===== Escuchando GPS @ %lu baud (10 s) =====\n", b);
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("\n[GPS PROBE] volcado crudo de UART2 (RX=16 TX=17)");
  lastSwitch = millis();
  startBaud(BAUDS[idx]);
}

void loop() {
  while (Serial2.available() > 0) {
    char c = (char)Serial2.read();
    byteCount++;
    if (c == '$') dollarCount++;
    Serial.write(c);   // eco crudo
  }
  if (millis() - lastSwitch >= DWELL_MS) {
    Serial.printf("\n----- resumen @ %lu baud: %lu bytes, %lu sentencias '$' -----\n",
                  BAUDS[idx], byteCount, dollarCount);
    idx = (idx + 1) % (sizeof(BAUDS) / sizeof(BAUDS[0]));
    lastSwitch = millis();
    startBaud(BAUDS[idx]);
  }
}
