#include "ota.h"
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Update.h>
#include "config.h"

// Aplica la imagen descargada desde `url`. Ver ota.h para el contrato/seguridad.
bool otaApplyFromUrl(const char* url, const char* expectedMd5) {
  Serial.printf("[OTA] v-actual=%s → descargando %s\n", FW_VERSION, url);

  WiFiClientSecure client;
  client.setInsecure();                 // MVP: no valida cert (igual que la telemetría). TODO: root CA.
  client.setTimeout(20);                // segundos

  HTTPClient https;
  https.setConnectTimeout(15000);
  https.setTimeout(20000);
  https.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);  // Storage puede redirigir
  if (!https.begin(client, url)) { Serial.println("[OTA] begin() falló"); return false; }

  int code = https.GET();
  if (code != HTTP_CODE_OK) {
    Serial.printf("[OTA] HTTP %d\n", code);
    https.end();
    return false;
  }

  int len = https.getSize();            // -1 si el servidor no manda Content-Length
  if (len <= 0) {
    Serial.printf("[OTA] tamaño inválido (%d) → aborto\n", len);
    https.end();
    return false;
  }

  if (!Update.begin(len)) {             // reserva la partición OTA inactiva; falla si no cabe
    Serial.printf("[OTA] Update.begin(%d) falló: %s\n", len, Update.errorString());
    https.end();
    return false;
  }
  // Verificación de integridad de punta a punta: si el MD5 no cuadra, Update.end()
  // falla y NO se cambia la partición de arranque.
  if (expectedMd5 && strlen(expectedMd5) == 32) Update.setMD5(expectedMd5);

  WiFiClient* stream = https.getStreamPtr();
  size_t written = Update.writeStream(*stream);   // descarga + escribe a flash
  https.end();

  if ((int)written != len) {
    Serial.printf("[OTA] escrito %u/%d bytes → descarga incompleta, aborto\n", (unsigned)written, len);
    Update.abort();
    return false;
  }
  if (!Update.end(true)) {              // valida (MD5) y marca la partición nueva como boot
    Serial.printf("[OTA] Update.end falló: %s\n", Update.errorString());
    return false;
  }
  if (!Update.isFinished()) {
    Serial.println("[OTA] no finalizó (estado inesperado)");
    return false;
  }

  Serial.println("[OTA] OK ✓ → reiniciando en la imagen nueva");
  delay(300);
  ESP.restart();                        // no retorna
  return true;                          // inalcanzable
}
