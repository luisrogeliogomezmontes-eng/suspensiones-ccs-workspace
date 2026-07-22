/**
 * Suspensiones Caracas — TEST del fan PWM con INTERFAZ WEB (standalone)
 * Ubicación: tests/fan_pwm_web/  ·  Guía paso a paso: tests/fan_pwm_web/GUIA.md
 * --------------------------------------------------------------------
 * El ESP32 crea su propio WiFi (AP) y sirve una página con un slider para
 * modular la velocidad del/los fan(es) 4-pin PWM en tiempo real.
 * NO usa GPS, DHT22, Supabase ni tu red WiFi. Solo el fan.
 *
 * CÓMO USARLO:
 *   1) Con el ESP alimentado, conéctate con el teléfono/laptop al WiFi:
 *        red:  FanTest        clave: fan12345
 *   2) Abre el navegador en:  http://192.168.4.1
 *   3) Mueve el slider (arranca en 30% = velocidad baja).
 *
 * Conexiones (docs/informes/F_arquitectura.html §3):
 *   Fan rojo → +12V riel · Fan negro → GND común (⚠ mismo GND del ESP32)
 *   Fan azul → GPIO26 (PWM, directo) · Fan amarillo → GPIO27 (tach, opcional)
 */
#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>

// ---- Pines / parámetros (iguales al firmware real, D26) ----
constexpr int      PIN_FAN      = 26;      // PWM → hilo azul (los 2 fans al mismo pin)
constexpr int      PIN_FAN_TACH = 27;      // tach → hilo amarillo (Fan A)
constexpr uint32_t PWM_FREQ_HZ  = 25000;   // 25 kHz (fuera del audible)
constexpr uint8_t  PWM_RES_BITS = 8;       // duty 0–255
constexpr uint8_t  PWM_CHANNEL  = 0;       // canal LEDC (solo core 2.x)
constexpr int      FAN_MAX_DUTY = 70;      // ⚠ tope por corriente del conector (2 fans <5A)
constexpr int      START_DUTY   = 30;      // arranca en velocidad baja
constexpr int      SLEW_STEP    = 3;       // % por tick de rampa (soft-start, evita inrush)
constexpr uint8_t  TACH_PPR     = 2;       // pulsos de tach por vuelta

const char* AP_SSID = "FanTest";
const char* AP_PASS = "fan12345";          // ≥8 chars (WPA2)

WebServer server(80);

// ---- Tach ----
volatile uint32_t g_tachPulses = 0;
portMUX_TYPE      g_tachMux    = portMUX_INITIALIZER_UNLOCKED;
void IRAM_ATTR tachISR() {
  portENTER_CRITICAL_ISR(&g_tachMux);
  g_tachPulses++;
  portEXIT_CRITICAL_ISR(&g_tachMux);
}

// ---- Estado ----
int      g_target = START_DUTY;   // objetivo fijado por el slider
int      g_duty   = 0;            // duty actual (rampa hacia el objetivo)
uint32_t g_rpm    = 0;

// ---- PWM (API LEDC según versión del core: 2.x por canal, 3.x por pin) ----
void fanPwmInit() {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcAttach(PIN_FAN, PWM_FREQ_HZ, PWM_RES_BITS);
#else
  ledcSetup(PWM_CHANNEL, PWM_FREQ_HZ, PWM_RES_BITS);
  ledcAttachPin(PIN_FAN, PWM_CHANNEL);
#endif
}
void fanPwmWrite(int duty_pct) {
  if (duty_pct < 0) duty_pct = 0;
  else if (duty_pct > FAN_MAX_DUTY) duty_pct = FAN_MAX_DUTY;      // tope de seguridad
  const int raw = (duty_pct * ((1 << PWM_RES_BITS) - 1)) / 100;
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWrite(PIN_FAN, raw);
#else
  ledcWrite(PWM_CHANNEL, raw);
#endif
}

// ---- Página web (una sola, autocontenida) ----
const char PAGE[] PROGMEM = R"HTML(<!doctype html><html lang=es><head><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1"><title>Control del Fan</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{margin:0;font-family:-apple-system,system-ui,sans-serif;background:#0b1220;color:#e6eef6;
min-height:100vh;display:flex;align-items:center;justify-content:center;padding:22px}
.card{background:#141f2b;border:1px solid #26323f;border-radius:22px;padding:30px 24px;width:100%;
max-width:430px;display:flex;flex-direction:column;align-items:center;gap:22px;box-shadow:0 12px 44px rgba(0,0,0,.45)}
h1{font-size:15px;font-weight:700;margin:0;letter-spacing:.14em;color:#8ba3ba}
.big{font-size:92px;font-weight:800;line-height:.9;font-variant-numeric:tabular-nums}
.big span{font-size:34px;color:#5fd6e4}
.rpm{font-size:14px;color:#7c8b9a;font-family:ui-monospace,monospace;margin-top:-8px}
input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:46px;border-radius:23px;
background:linear-gradient(90deg,#1fc0d2 var(--p,42%),#26323f var(--p,42%));outline:none}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:46px;height:46px;border-radius:50%;
background:#fff;border:5px solid #1fc0d2;box-shadow:0 3px 10px rgba(0,0,0,.5)}
input[type=range]::-moz-range-thumb{width:40px;height:40px;border-radius:50%;background:#fff;border:5px solid #1fc0d2}
.row{display:flex;gap:9px;width:100%}
button{flex:1;padding:15px 0;border:1px solid #2b3a49;border-radius:14px;background:#0f1926;color:#cfe3f2;
font-size:15px;font-weight:600}button:active{background:#1fc0d2;color:#04222a;border-color:#1fc0d2}
.hint{font-size:12px;color:#586b7d;text-align:center}
</style></head><body><div class=card>
<h1>CONTROL DEL FAN</h1>
<div class=big id=pct>30<span>%</span></div>
<div class=rpm id=rpm>rpm: --</div>
<input type=range id=sl min=0 max=70 value=30>
<div class=row>
<button onclick=setv(0)>Off</button><button onclick=setv(30)>Bajo</button>
<button onclick=setv(50)>Medio</button><button onclick=setv(70)>Máx</button>
</div>
<div class=hint>Tope 70% &middot; 2 fans &lt;5&nbsp;A en el conector</div>
</div><script>
var sl=document.getElementById('sl'),pct=document.getElementById('pct'),rpm=document.getElementById('rpm'),t=null;
function paint(v){pct.innerHTML=v+'<span>%</span>';sl.style.setProperty('--p',(v/70*100)+'%');}
function send(v){fetch('/set?duty='+v).catch(function(){});}
function setv(v){sl.value=v;paint(v);send(v);}
sl.addEventListener('input',function(){var v=+sl.value;paint(v);clearTimeout(t);t=setTimeout(function(){send(v);},40);});
paint(+sl.value);
setInterval(function(){fetch('/status').then(function(r){return r.json();}).then(function(d){rpm.textContent='rpm: '+d.rpm;}).catch(function(){});},1000);
</script></body></html>)HTML";

// ---- Handlers ----
void handleRoot()   { server.send_P(200, "text/html", PAGE); }
void handleSet() {
  if (server.hasArg("duty")) {
    int v = server.arg("duty").toInt();
    if (v < 0) v = 0;
    if (v > FAN_MAX_DUTY) v = FAN_MAX_DUTY;
    g_target = v;
  }
  server.send(200, "text/plain", "ok");
}
void handleStatus() {
  char buf[64];
  snprintf(buf, sizeof(buf), "{\"duty\":%d,\"target\":%d,\"rpm\":%lu}",
           g_duty, g_target, (unsigned long)g_rpm);
  server.send(200, "application/json", buf);
}

void setup() {
  Serial.begin(115200);
  delay(300);
  fanPwmInit();
  fanPwmWrite(0);
  pinMode(PIN_FAN_TACH, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_FAN_TACH), tachISR, FALLING);

  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASS);
  const IPAddress ip = WiFi.softAPIP();

  server.on("/",       handleRoot);
  server.on("/set",    handleSet);
  server.on("/status", handleStatus);
  server.begin();

  Serial.println();
  Serial.println(F("=== TEST fan PWM + interfaz web — Suspensiones P1 ==="));
  Serial.printf ("1) Conecta el telefono al WiFi:  %s   (clave: %s)\n", AP_SSID, AP_PASS);
  Serial.print  (F("2) Abre en el navegador:  http://"));
  Serial.println(ip);
  Serial.println(F("3) Mueve el slider (arranca en 30%)."));
  Serial.println(F("Si el fan no gira: 12V ON + GND del EcoFlow unido al GND del ESP32."));
}

void loop() {
  server.handleClient();

  const uint32_t now = millis();

  // Rampa suave hacia el objetivo (soft-start, evita el inrush de 2 fans)
  static uint32_t lastSlew = 0;
  if (now - lastSlew >= 40) {
    lastSlew = now;
    if      (g_duty < g_target) g_duty = min(g_target, g_duty + SLEW_STEP);
    else if (g_duty > g_target) g_duty = max(g_target, g_duty - SLEW_STEP);
    fanPwmWrite(g_duty);
  }

  // RPM (ventana de 1 s) + log
  static uint32_t lastRep = 0;
  if (now - lastRep >= 1000) {
    const uint32_t dt = now - lastRep;
    lastRep = now;
    portENTER_CRITICAL(&g_tachMux);
    const uint32_t p = g_tachPulses; g_tachPulses = 0;
    portEXIT_CRITICAL(&g_tachMux);
    g_rpm = (p * 60000UL) / (dt * TACH_PPR);
    Serial.printf("duty=%2d%% (obj %2d%%)  rpm=%lu\n", g_duty, g_target, (unsigned long)g_rpm);
  }
}
