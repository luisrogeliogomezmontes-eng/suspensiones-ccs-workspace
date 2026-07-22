#include "net.h"
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <time.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include "config.h"
#include "secrets.h"
#include "gps.h"

// ── Credenciales WiFi (guardadas en NVS por el portal) ───────────────────────
static char s_ssid[33] = {0};
static char s_pass[65] = {0};

// ── Estado compartido loop(core1) ↔ tarea(core0) ─────────────────────────────
static SemaphoreHandle_t s_mtx = nullptr;
static struct {
  bool  hasTemp = false;
  float temp_c  = NAN;
  bool  hasFan  = false;
  bool  fan_on  = false;
  int   fan_duty = 0;
} s_snap;

static volatile bool     s_online   = false;
static volatile int      s_rssi     = 0;
static volatile uint32_t s_lastOkMs = 0;
static volatile bool     s_everOk   = false;
static volatile bool     s_portal   = false;   // en modo portal de configuración

// ── Estado de control remoto (I3.2): fijado por comandos, leído por el loop ───
// int/float de 32 bits → lecturas/escrituras atómicas en ESP32 (1 escritor: la
// tarea de red; 1 lector: el loop). volatile basta, sin mutex.
static volatile int   s_fanMode = FAN_AUTO;
static volatile float s_tempOn  = TEMP_ON_C;
static volatile float s_tempOff = TEMP_OFF_C;

// Portal (solo activos en modo provisioning)
static WebServer* s_server = nullptr;
static DNSServer* s_dns    = nullptr;
static String     s_scanOptions;   // <option> de redes, escaneadas 1 vez (evita caer la AP al recargar)

// ── Persistencia de credenciales (NVS) ───────────────────────────────────────
static bool loadCreds() {
  // 1) Pre-seed desde secrets.h (WIFI_SSID/WIFI_PASSWORD). Tiene PRIORIDAD sobre
  //    la NVS: si está hardcodeado (build de pruebas), gana aunque el portal haya
  //    guardado antes una clave errada. Normalmente está comentado → cae a NVS.
#ifdef WIFI_SSID
  if (strlen(WIFI_SSID) > 0 && strcmp(WIFI_SSID, "TU-WIFI-AQUI") != 0) {
    strncpy(s_ssid, WIFI_SSID, sizeof(s_ssid) - 1);
    strncpy(s_pass, WIFI_PASSWORD, sizeof(s_pass) - 1);
    Serial.printf("[NET] usando WiFi hardcodeado de secrets.h: '%s'\n", s_ssid);
    return true;
  }
#endif

  // 2) Credenciales guardadas por el portal (NVS)
  Preferences p;
  p.begin("wifi", /*readOnly=*/true);
  String ssid = p.getString("ssid", "");
  String pass = p.getString("pass", "");
  p.end();
  ssid.toCharArray(s_ssid, sizeof(s_ssid));
  pass.toCharArray(s_pass, sizeof(s_pass));
  if (strlen(s_ssid) > 0) return true;

  return false;
}

static void saveCreds(const String& ssid, const String& pass) {
  Preferences p;
  p.begin("wifi", /*readOnly=*/false);
  p.putString("ssid", ssid);
  p.putString("pass", pass);
  p.end();
}

// ── Persistencia del control remoto (NVS): umbrales del fan ───────────────────
// Hace que los ajustes de `/control` (comando `setpoint`) SOBREVIVAN al reboot /
// corte de energía. Sin esto, cada reinicio vuelve a los defaults de config.h.
// Namespace "control" (separado de "wifi"). Solo unidad completa (hay fan).
// ⚠️ El MODO del fan (on/off/auto) NO se persiste a propósito: al bootear vuelve
// a AUTO (fail-safe — un override manual no debe sobrevivir a un reinicio). Solo
// los UMBRALES persisten; el control por temperatura siempre reanuda automático.
#if !GPS_ONLY
static void loadControl() {
  Preferences p;
  p.begin("control", /*readOnly=*/true);
  s_tempOn  = p.getFloat("temp_on",  TEMP_ON_C);   // default = config.h si nunca se guardó
  s_tempOff = p.getFloat("temp_off", TEMP_OFF_C);
  p.end();
  Serial.printf("[NET] umbrales del fan desde NVS: on=%.1f off=%.1f\n", s_tempOn, s_tempOff);
}

static void saveControl() {
  Preferences p;
  p.begin("control", /*readOnly=*/false);
  p.putFloat("temp_on",  s_tempOn);
  p.putFloat("temp_off", s_tempOff);
  p.end();
  Serial.printf("[NET] umbrales guardados en NVS (persisten al reboot): on=%.1f off=%.1f\n",
                s_tempOn, s_tempOff);
}
#endif  // !GPS_ONLY

// ── Portal cautivo (AP + formulario) ─────────────────────────────────────────
static void handleRoot() {
  String html =
    "<!doctype html><html><head><meta name=viewport content='width=device-width,initial-scale=1'>"
    "<title>Setup UNIDAD-01</title><style>"
    "body{font-family:system-ui;background:#0e1116;color:#e6edf3;margin:0;padding:20px}"
    "h1{font-size:18px;letter-spacing:.05em}label{display:block;margin:14px 0 4px;color:#9aa7b6;font-size:13px}"
    "select,input{width:100%;box-sizing:border-box;padding:10px;border-radius:8px;border:1px solid #232b38;background:#161b22;color:#e6edf3;font-size:15px}"
    "button{margin-top:20px;width:100%;padding:12px;border:0;border-radius:8px;background:#3b9eff;color:#00121f;font-weight:700;font-size:15px}"
    ".m{color:#5c6775;font-size:12px;margin-top:16px}</style></head><body>"
    "<h1>SUSPENSIONES · UNIDAD-01</h1><p style='color:#9aa7b6'>Conecta la unidad a tu WiFi.</p>"
    "<form action='/save' method='POST'><label>Red WiFi (solo 2.4 GHz)</label><select name='ssid'>" +
    s_scanOptions +
    "</select><label>…o escribe el nombre (red oculta)</label>"
    "<input type='text' name='ssid_manual' placeholder='opcional'>"
    "<label>Contraseña</label><input type='password' name='pass' placeholder='clave del WiFi'>"
    "<button type='submit'>Guardar y conectar</button></form>"
    "<p class='m'>La unidad se reiniciará y empezará a enviar telemetría.</p></body></html>";
  s_server->send(200, "text/html", html);
}

static void handleSave() {
  String manual = s_server->arg("ssid_manual");
  String ssid = manual.length() > 0 ? manual : s_server->arg("ssid");
  String pass = s_server->arg("pass");
  if (ssid.length() == 0) { s_server->send(400, "text/plain", "SSID vacío"); return; }
  saveCreds(ssid, pass);
  s_server->send(200, "text/html",
    "<body style='font-family:system-ui;background:#0e1116;color:#e6edf3;padding:20px'>"
    "<h2>Guardado ✓</h2><p>Conectando a <b>" + ssid + "</b> y reiniciando…</p></body>");
  Serial.printf("[PROV] creds guardadas para '%s' → reiniciando\n", ssid.c_str());
  delay(1500);
  ESP.restart();
}

// Nunca retorna (hasta que el usuario guarde creds → restart).
static void runPortal() {
  s_portal = true;
  s_online = false;
  WiFi.mode(WIFI_AP_STA);                 // AP_STA: sirve el portal y puede escanear redes

  // Escanea UNA vez y cachea (re-escanear en cada carga hace caer la AP).
  int n = WiFi.scanNetworks();
  s_scanOptions = "";
  for (int i = 0; i < n; i++) {
    s_scanOptions += "<option value='" + WiFi.SSID(i) + "'>" + WiFi.SSID(i) +
                     "  (" + String(WiFi.RSSI(i)) + " dBm)</option>";
  }

  uint8_t mac[6];
  WiFi.macAddress(mac);
  char apName[40];
  snprintf(apName, sizeof(apName), "%s%02X%02X", WIFI_AP_PREFIX, mac[4], mac[5]);
  WiFi.softAP(apName, WIFI_AP_PASSWORD);
  IPAddress ip = WiFi.softAPIP();

  s_dns = new DNSServer();
  s_dns->start(53, "*", ip);              // captura todo el DNS → portal cautivo

  s_server = new WebServer(80);
  s_server->on("/", handleRoot);
  s_server->on("/save", HTTP_POST, handleSave);
  s_server->onNotFound(handleRoot);       // cualquier URL → formulario
  s_server->begin();

  Serial.printf("[PROV] Portal abierto. Red '%s' (clave '%s') → http://%s\n",
                apName, WIFI_AP_PASSWORD, ip.toString().c_str());

  for (;;) {
    s_dns->processNextRequest();
    s_server->handleClient();
    vTaskDelay(pdMS_TO_TICKS(10));
  }
}

// ── Utilidades de telemetría ─────────────────────────────────────────────────
static bool timeSynced() {
  return time(nullptr) > 1700000000;  // > 2023-11 → NTP ya sincronizó
}

static void isoNow(char* out, size_t n) {
  time_t now = time(nullptr);
  struct tm tmv;
  gmtime_r(&now, &tmv);
  strftime(out, n, "%Y-%m-%dT%H:%M:%SZ", &tmv);
}

// Headers comunes de Supabase: apikey + Bearer + token del device. El
// x-device-token identifica a ESTA unidad (RLS lo valida para comandos).
static void addAuthHeaders(HTTPClient& https) {
  static char auth[160];
  snprintf(auth, sizeof(auth), "Bearer %s", SUPABASE_ANON_KEY);
  https.addHeader("apikey", SUPABASE_ANON_KEY);
  https.addHeader("Authorization", auth);
  https.addHeader("x-device-token", DEVICE_TOKEN);
}

// Construye el JSON y hace el POST. ⚠️ BLOQUEA (TLS) → vive en la tarea.
static bool postReading() {
  auto snap = s_snap;
  if (s_mtx) { xSemaphoreTake(s_mtx, portMAX_DELAY); snap = s_snap; xSemaphoreGive(s_mtx); }
  const GpsFix fix = gpsGet();

  char ts[25];
  isoNow(ts, sizeof(ts));

  JsonDocument doc;
  doc["device_id"] = DEVICE_ID;
  doc["ts"]        = ts;
  if (snap.hasTemp) doc["temp_c"] = snap.temp_c;
  if (snap.hasFan) { doc["fan_on"] = snap.fan_on; doc["fan_duty"] = snap.fan_duty; }
  if (fix.valid) {
    doc["lat"]        = fix.lat;
    doc["lng"]        = fix.lng;
    doc["alt"]        = fix.altitude_m;
    doc["speed_kmph"] = fix.speed_kmph;
    doc["course"]     = fix.course_deg;
    doc["hdop"]       = fix.hdop;
  }
  doc["sats"]      = fix.satellites;
  doc["rssi"]      = WiFi.RSSI();
  doc["uptime_s"]  = (uint32_t)(millis() / 1000);
  doc["heap_free"] = (uint32_t)ESP.getFreeHeap();

  char body[512];
  size_t len = serializeJson(doc, body, sizeof(body));

  char url[160];
  snprintf(url, sizeof(url), "%s/rest/v1/readings", SUPABASE_URL);

  WiFiClientSecure client;
  client.setInsecure();  // ⚠️ MVP: no valida el certificado. TODO: fijar root CA.
  client.setTimeout(HTTP_TIMEOUT_MS / 1000);

  HTTPClient https;
  https.setConnectTimeout(HTTP_TIMEOUT_MS);
  https.setTimeout(HTTP_TIMEOUT_MS);
  if (!https.begin(client, url)) return false;
  addAuthHeaders(https);
  https.addHeader("Content-Type", "application/json");
  https.addHeader("Prefer", "return=minimal");

  int code = https.POST((uint8_t*)body, len);
  https.end();

  bool ok = (code == 201 || code == 200 || code == 204);
  if (!ok) Serial.printf("[NET] POST fallo HTTP %d\n", code);
  return ok;
}

// ── Comandos (I3.2): downlink dashboard → device ─────────────────────────────
// Solo la unidad completa consume comandos (fan/setpoint/reboot). La RTU
// solo-GPS no tiene actuadores → se excluye para no dejar funciones sin usar.
#if !GPS_ONLY
// Aplica un comando al estado local. `reboot` se maneja fuera (ack antes).
static void applyCommand(const char* type, JsonVariantConst payload) {
  if (strcmp(type, "fan_mode") == 0) {
    const char* m = payload["mode"] | "auto";
    if      (strcmp(m, "on")  == 0) s_fanMode = FAN_ON;
    else if (strcmp(m, "off") == 0) s_fanMode = FAN_OFF;
    else                            s_fanMode = FAN_AUTO;
    Serial.printf("[CMD] fan_mode=%s\n", m);
  } else if (strcmp(type, "setpoint") == 0 || strcmp(type, "hysteresis") == 0) {
    if (!payload["temp_on"].isNull())  s_tempOn  = payload["temp_on"].as<float>();
    if (!payload["temp_off"].isNull()) s_tempOff = payload["temp_off"].as<float>();
    Serial.printf("[CMD] setpoint on=%.1f off=%.1f\n", s_tempOn, s_tempOff);
    saveControl();   // persiste en NVS → el cambio remoto sobrevive al reboot
  } else if (strcmp(type, "power_cycle") == 0) {
    Serial.println("[CMD] power_cycle (sin relé de potencia aún → solo ack)");
  } else {
    Serial.printf("[CMD] tipo desconocido: %s\n", type);
  }
}

// Marca el comando como confirmado (ack_ts = ahora). true si Supabase lo aceptó.
static bool ackCommand(const char* id) {
  char url[220];
  snprintf(url, sizeof(url), "%s/rest/v1/commands?id=eq.%s", SUPABASE_URL, id);
  char ts[25]; isoNow(ts, sizeof(ts));
  char body[64]; snprintf(body, sizeof(body), "{\"ack_ts\":\"%s\"}", ts);

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(HTTP_TIMEOUT_MS / 1000);
  HTTPClient https;
  https.setConnectTimeout(HTTP_TIMEOUT_MS);
  https.setTimeout(HTTP_TIMEOUT_MS);
  if (!https.begin(client, url)) return false;
  addAuthHeaders(https);
  https.addHeader("Content-Type", "application/json");
  https.addHeader("Prefer", "return=minimal");
  int code = https.PATCH((uint8_t*)body, strlen(body));
  https.end();
  bool ok = (code == 200 || code == 204);
  if (!ok) Serial.printf("[CMD] ack %s HTTP %d\n", id, code);
  return ok;
}

// Trae los comandos pendientes de ESTA unidad, los aplica y confirma. BLOQUEA.
static void pollCommands() {
  char url[300];
  snprintf(url, sizeof(url),
           "%s/rest/v1/commands?device_id=eq.%s&ack_ts=is.null&order=ts.asc&select=id,type,payload",
           SUPABASE_URL, DEVICE_ID);

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(HTTP_TIMEOUT_MS / 1000);
  HTTPClient https;
  https.setConnectTimeout(HTTP_TIMEOUT_MS);
  https.setTimeout(HTTP_TIMEOUT_MS);
  if (!https.begin(client, url)) return;
  addAuthHeaders(https);
  https.addHeader("Accept", "application/json");
  int code = https.GET();
  if (code != 200) {
    if (code > 0) Serial.printf("[CMD] GET HTTP %d\n", code);
    https.end();
    return;
  }
  String bodyStr = https.getString();
  https.end();

  JsonDocument doc;
  if (deserializeJson(doc, bodyStr)) { Serial.println("[CMD] JSON inválido"); return; }

  for (JsonVariantConst v : doc.as<JsonArrayConst>()) {
    const char* id   = v["id"];
    const char* type = v["type"];
    if (!id || !type) continue;
    const bool isReboot = (strcmp(type, "reboot") == 0);
    if (!isReboot) applyCommand(type, v["payload"]);
    // ack primero; reboot solo si el ack quedó registrado (evita bucle de reinicio)
    const bool acked = ackCommand(id);
    if (acked && isReboot) {
      Serial.println("[CMD] reboot → reiniciando");
      delay(300);
      ESP.restart();
    }
  }
}

#endif  // !GPS_ONLY (comandos)

// ── Tarea de red (core 0): provisioning → STA + telemetría ───────────────────
static void networkTask(void*) {
  if (!loadCreds()) {                 // sin credenciales → portal (no retorna)
    Serial.println("[NET] sin credenciales WiFi → abriendo portal de setup");
    runPortal();
  }

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(s_ssid, s_pass);
  configTime(0, 0, NTP_SERVER_1, NTP_SERVER_2);  // UTC
  Serial.printf("[NET] conectando a '%s'…\n", s_ssid);

  uint32_t backoff  = WIFI_RETRY_MIN_MS;
  uint32_t lastTry  = millis();
  uint32_t lastPost = 0;
  uint32_t lastPoll = 0;

  for (;;) {
    if (WiFi.status() != WL_CONNECTED) {
      s_online = false;
      uint32_t now = millis();
      // Con credenciales guardadas NO caemos al portal: reintentamos la red por
      // siempre (self-healing tras reboot / caída de la red / cambio de rango).
      // El portal bloqueante es solo para el primer arranque SIN credenciales
      // (lo maneja loadCreds()→runPortal() al inicio). Así la unidad vuelve
      // sola en cuanto la red reaparece, sin necesidad de resetear.
      if (now - lastTry >= backoff) {
        lastTry = now;
        WiFi.disconnect();
        WiFi.begin(s_ssid, s_pass);
        backoff = min(backoff * 2, WIFI_RETRY_MAX_MS);
      }
      vTaskDelay(pdMS_TO_TICKS(250));
      continue;
    }

    s_online = true;
    s_rssi   = WiFi.RSSI();
    backoff  = WIFI_RETRY_MIN_MS;

    if (!timeSynced()) { vTaskDelay(pdMS_TO_TICKS(250)); continue; }

    uint32_t now = millis();
    if (now - lastPost >= TELEMETRY_PERIOD_MS) {
      lastPost = now;
      if (postReading()) { s_lastOkMs = millis(); s_everOk = true; }
    }
#if !GPS_ONLY
    if (now - lastPoll >= COMMAND_POLL_MS) {
      lastPoll = now;
      pollCommands();   // downlink de control (aplica + ack)
    }
#else
    (void)lastPoll;     // RTU solo-GPS: sin actuadores → no hay comandos que consumir
#endif
    vTaskDelay(pdMS_TO_TICKS(100));
  }
}

// ── API pública ──────────────────────────────────────────────────────────────
void netBegin() {
  s_mtx = xSemaphoreCreateMutex();
#if !GPS_ONLY
  loadControl();   // umbrales persistidos (o defaults de config.h) ANTES del loop
#endif
  // Stack holgado: TLS + JSON + WebServer del portal. Prioridad 1, core 0.
  xTaskCreatePinnedToCore(networkTask, "network", 16384, nullptr, 1, nullptr, 0);
}

void netSetSnapshot(bool hasTemp, float temp_c, bool hasFan, bool fan_on, int fan_duty) {
  if (!s_mtx) return;
  xSemaphoreTake(s_mtx, portMAX_DELAY);
  s_snap.hasTemp  = hasTemp;
  s_snap.temp_c   = temp_c;
  s_snap.hasFan   = hasFan;
  s_snap.fan_on   = fan_on;
  s_snap.fan_duty = fan_duty;
  xSemaphoreGive(s_mtx);
}

bool netInPortal()   { return s_portal; }
bool netOnline()     { return s_online; }
bool netTimeSynced() { return timeSynced(); }
int  netRssi()       { return s_rssi; }
int   netFanMode()   { return s_fanMode; }
float netTempOn()    { return s_tempOn; }
float netTempOff()   { return s_tempOff; }
uint32_t netLastOkAgeMs() {
  return s_everOk ? (millis() - s_lastOkMs) : UINT32_MAX;
}
