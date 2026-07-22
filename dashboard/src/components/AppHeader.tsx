"use client";

import { useTelemetry, useNow } from "@/lib/useTelemetry";
import { useDeviceId } from "@/lib/devices";
import { linkState } from "@/lib/status";
import { Header } from "./Header";

// Header con estado de enlace en vivo, para las pantallas que no cargan la
// telemetría completa (Histórico, Mapa). Usa el mismo hook que el Overview.
export function AppHeader() {
  const { latest, source } = useTelemetry(useDeviceId());
  const now = useNow();
  const link = linkState(latest?.ts, now);
  return (
    <Header
      link={link}
      lastTs={latest?.ts ?? null}
      now={now}
      source={source}
    />
  );
}
