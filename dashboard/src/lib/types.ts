// Tipos de datos — espejo del esquema en backend/supabase/migrations/0001_init.sql

export interface Device {
  id: string;
  name: string;
  fw_version: string | null;
  temp_warn: number;
  temp_serious: number;
  temp_crit: number;
  last_seen: string | null;
}

export interface Reading {
  ts: string; // ISO 8601, sellado en origen (GPS/NTP)

  // Térmico
  temp_c: number | null;
  temp_points?: Record<string, number> | null;

  // Ventilación
  fan_on: boolean | null;
  fan_duty: number | null;
  fan_rpm?: number | null;

  // Estado de control (read-back del device; null en firmware viejo → 0010)
  fan_mode?: "auto" | "on" | "off" | null; // modo efectivo del fan
  temp_on?: number | null;                 // setpoint efectivo: enciende a (°C)
  temp_off?: number | null;                // setpoint efectivo: apaga a (°C)

  // GPS
  lat: number | null;
  lng: number | null;
  alt?: number | null;
  speed_kmph: number | null;
  course?: number | null;
  sats: number | null;
  hdop: number | null;

  // Salud ESP32
  rssi: number | null;
  uptime_s?: number | null;
  heap_free?: number | null;

  // Integraciones opcionales
  batt_soc: number | null;
  power_w: number | null;
  link_obstruction?: number | null;
  link_down_mbps?: number | null;
}

// Umbrales de temperatura efectivos para un dispositivo
export interface TempThresholds {
  warn: number;
  serious: number;
  crit: number;
}
