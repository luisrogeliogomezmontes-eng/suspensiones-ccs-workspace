"use client";

import { useTelemetry, useNow, WINDOW_MIN } from "@/lib/useTelemetry";
import { useDeviceId } from "@/lib/devices";
import { linkState, thresholdsOf } from "@/lib/status";
import { deriveAlerts } from "@/lib/alerts";
import { Header } from "@/components/Header";
import { AlertBanner } from "@/components/AlertBanner";
import { OfflineBanner } from "@/components/OfflineBanner";
import { TelltaleStrip } from "@/components/telltale/TelltaleStrip";
import { Panel } from "@/components/ui/Panel";
import { TemperatureChart } from "@/components/charts/TemperatureChart";
import { FanTimeline } from "@/components/charts/FanTimeline";
import { LocationPanel } from "@/components/LocationPanel";
import { ChartLegend } from "@/components/charts/ChartLegend";

export default function Overview() {
  const { device, readings, latest, source } = useTelemetry(useDeviceId());
  const now = useNow();
  const link = linkState(latest?.ts, now);

  const thr = thresholdsOf(device);
  const alerts = deriveAlerts(latest, link, thr);

  return (
    <div className="min-h-full">
      <Header
        link={link}
        lastTs={latest?.ts ?? null}
        now={now}
        source={source}
      />

      {link === "offline" && latest && <OfflineBanner lastTs={latest.ts} now={now} />}

      <main className="mx-auto max-w-[1200px] space-y-4 p-4 sm:p-6">
        <AlertBanner alerts={alerts} />

        {/* Tira de testigos — siempre visible */}
        <TelltaleStrip readings={readings} device={device} />

        {/* Temperatura + Ubicación */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
          <Panel
            title={`T° aire interior · última ${WINDOW_MIN} min`}
            right={<ChartLegend thr={thr} />}
          >
            {readings.length ? (
              <TemperatureChart readings={readings} thr={thr} />
            ) : (
              <Skeleton />
            )}
          </Panel>

          <Panel title="Ubicación">
            <LocationPanel readings={readings} />
          </Panel>
        </div>

        {/* Ventilador */}
        <Panel title="Ventilador · timeline">
          {readings.length ? <FanTimeline readings={readings} /> : <Skeleton h={60} />}
        </Panel>

        <p className="pt-2 text-center font-mono text-[11px] text-ink-faint">
          Proyecto 1 · Suspensiones Caracas.{" "}
          {source === "mock"
            ? "Datos de ejemplo — sin conexión con la unidad."
            : "Telemetría en tiempo real."}
        </p>
      </main>
    </div>
  );
}

function Skeleton({ h = 240 }: { h?: number }) {
  return (
    <div
      className="w-full animate-pulse rounded-md bg-panel-2"
      style={{ height: h }}
      aria-hidden
    />
  );
}
