import type { Reading } from "./types";

// Simulador de telemetría — hace el dashboard funcional sin backend.
// Espeja el lazo del firmware: fan por histéresis (TEMP_ON/TEMP_OFF) y una
// ruta GPS por Caracas. Sirve para demo y para desarrollar la UI antes de I0.

// Umbrales del fan sobre T° de AIRE interior (coherentes con la escala de la UI:
// warn 33 / serio 40 / crít 46). El fan arranca cerca de "serio" y apaga en "warn".
const TEMP_ON = 41; // °C — enciende fan (subiendo)
const TEMP_OFF = 35; // °C — apaga fan (bajando)

// Loop corto por el este de Caracas (Altamira ↔ Chacao ↔ Los Palos Grandes)
const ROUTE: [number, number][] = [
  [10.4959, -66.8536],
  [10.4972, -66.8481],
  [10.5011, -66.8452],
  [10.5039, -66.8489],
  [10.5028, -66.8551],
  [10.4991, -66.8578],
  [10.4959, -66.8536],
];

interface State {
  temp: number;
  fanOn: boolean;
  batt: number;
  routeIdx: number;
  routeFrac: number;
  idleUntil: number; // ms epoch: detenida hasta
  uptimeS: number;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export class MockSource {
  private s: State;
  private readonly stepMs: number;

  constructor(stepMs = 2000) {
    this.stepMs = stepMs;
    this.s = {
      temp: 32,
      fanOn: false,
      batt: 84,
      routeIdx: 0,
      routeFrac: 0,
      idleUntil: 0,
      uptimeS: 3600,
    };
  }

  // Avanza el estado `dtS` segundos y devuelve una lectura sellada en `atMs`.
  private step(atMs: number, dtS: number): Reading {
    const s = this.s;
    s.uptimeS += dtS;

    // ── Térmica: sube con equipo encendido, baja con fan. Ruido + deriva.
    const heat = 0.22; // °C/s de calentamiento base
    const cool = s.fanOn ? 0.5 : 0.06; // el fan enfría de verdad
    const ambientPull = (29 - s.temp) * 0.004; // regresa hacia ambiente (~29°C)
    const noise = (Math.random() - 0.5) * 0.2;
    s.temp += (heat - cool + ambientPull) * dtS + noise;

    // Excursión ocasional hacia zona seria/crítica (mostrar estados en la demo)
    if (Math.random() < 0.015) s.temp += 2.5;

    s.temp = Math.max(26, Math.min(52, s.temp));

    // Histéresis del fan (igual que el firmware)
    if (!s.fanOn && s.temp >= TEMP_ON) s.fanOn = true;
    else if (s.fanOn && s.temp <= TEMP_OFF) s.fanOn = false;

    const fanDuty = s.fanOn
      ? Math.min(100, Math.round(lerp(45, 100, (s.temp - TEMP_OFF) / 12)))
      : 0;

    // ── GPS: avanza por la ruta salvo que esté "detenida" (idle)
    let speed = 0;
    const stopped = atMs < s.idleUntil;
    if (!stopped) {
      const advance = (dtS * (0.05 + Math.random() * 0.05)); // fracción de tramo
      s.routeFrac += advance;
      speed = lerp(12, 38, Math.random());
      while (s.routeFrac >= 1) {
        s.routeFrac -= 1;
        s.routeIdx = (s.routeIdx + 1) % (ROUTE.length - 1);
      }
      // A veces se detiene (semáforo/parada) — clave: ¿calienta más detenida?
      if (Math.random() < 0.05) s.idleUntil = atMs + (8000 + Math.random() * 12000);
    }

    const [lat1, lng1] = ROUTE[s.routeIdx];
    const [lat2, lng2] = ROUTE[s.routeIdx + 1];
    const lat = lerp(lat1, lat2, s.routeFrac) + (Math.random() - 0.5) * 0.00012;
    const lng = lerp(lng1, lng2, s.routeFrac) + (Math.random() - 0.5) * 0.00012;
    const course = (Math.atan2(lng2 - lng1, lat2 - lat1) * 180) / Math.PI;

    // ── Batería (EcoFlow) drenando lento; power según carga + fan
    s.batt = Math.max(4, s.batt - dtS * 0.0016);
    const powerW = 52 + (s.fanOn ? 9 : 0) + (Math.random() - 0.5) * 4;

    return {
      ts: new Date(atMs).toISOString(),
      temp_c: round(s.temp, 1),
      temp_points: {
        intake: round(s.temp - lerp(10, 16, Math.random()), 1),
        starlink: round(s.temp + lerp(1, 5, Math.random()), 1),
        ecoflow: round(s.temp - lerp(2, 6, Math.random()), 1),
      },
      fan_on: s.fanOn,
      fan_duty: fanDuty,
      fan_rpm: s.fanOn ? Math.round(lerp(1600, 3800, fanDuty / 100)) : 0,
      lat: round(lat, 6),
      lng: round(lng, 6),
      alt: round(900 + (Math.random() - 0.5) * 20, 0),
      speed_kmph: round(stopped ? 0 : speed, 1),
      course: round((course + 360) % 360, 0),
      sats: 7 + Math.floor(Math.random() * 5),
      hdop: round(lerp(0.8, 1.7, Math.random()), 1),
      rssi: Math.round(lerp(-72, -52, Math.random())),
      uptime_s: Math.round(s.uptimeS),
      heap_free: Math.round(lerp(180_000, 210_000, Math.random())),
      batt_soc: Math.round(s.batt),
      power_w: round(powerW, 0),
      link_obstruction: round(Math.random() * 2, 1),
      link_down_mbps: round(lerp(60, 180, Math.random()), 0),
    };
  }

  // Semilla de histórico para que los gráficos no arranquen vacíos.
  history(minutes: number, nowMs = Date.now()): Reading[] {
    const out: Reading[] = [];
    const startMs = nowMs - minutes * 60_000;
    const dtS = this.stepMs / 1000;
    for (let t = startMs; t <= nowMs; t += this.stepMs) {
      out.push(this.step(t, dtS));
    }
    return out;
  }

  // Siguiente lectura "ahora".
  next(nowMs = Date.now()): Reading {
    return this.step(nowMs, this.stepMs / 1000);
  }
}

function round(n: number, d: number) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
