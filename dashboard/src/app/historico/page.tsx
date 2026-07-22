"use client";

import { useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useDeviceId } from "@/lib/devices";
import { useHistory, RANGES, type RangeKey } from "@/lib/useHistory";
import { RangeSelector } from "@/components/RangeSelector";
import { Panel } from "@/components/ui/Panel";
import { TemperatureChart } from "@/components/charts/TemperatureChart";
import { MetricChart } from "@/components/charts/MetricChart";
import { ChartLegend } from "@/components/charts/ChartLegend";
import { thresholdsOf } from "@/lib/status";
import { readingsToCsv, downloadCsv } from "@/lib/csv";
import { fmt, hhmm } from "@/lib/format";
import type { Reading } from "@/lib/types";

type Acc = (r: Reading) => number | null | undefined;

function summarize(rows: Reading[], acc: Acc) {
  const v = rows.map(acc).filter((x): x is number => x != null && !Number.isNaN(x));
  if (!v.length) return null;
  const sum = v.reduce((a, b) => a + b, 0);
  return { min: Math.min(...v), max: Math.max(...v), avg: sum / v.length, n: v.length };
}

export default function Historico() {
  const [rangeKey, setRangeKey] = useState<RangeKey>("1h");
  const rangeMs = RANGES.find((r) => r.key === rangeKey)!.ms;
  const { device, readings, fetched, truncated, source, loading, reload } =
    useHistory(rangeMs, useDeviceId());
  const [showTable, setShowTable] = useState(false);

  const thr = thresholdsOf(device);

  const stats = useMemo(
    () => ({
      temp: summarize(readings, (r) => r.temp_c),
      speed: summarize(readings, (r) => r.speed_kmph),
      rssi: summarize(readings, (r) => r.rssi),
      power: summarize(readings, (r) => r.power_w),
    }),
    [readings]
  );

  const exportCsv = () => {
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    downloadCsv(
      `${device?.name ?? "unidad"}_${rangeKey}_${stamp}.csv`,
      readingsToCsv(readings)
    );
  };

  return (
    <div className="min-h-full">
      <AppHeader />

      <main className="mx-auto max-w-[1200px] space-y-4 p-4 sm:p-6">
        {/* Barra de controles */}
        <div className="flex flex-wrap items-center gap-3">
          <RangeSelector value={rangeKey} onChange={setRangeKey} />
          <button
            type="button"
            onClick={reload}
            className="rounded-md border border-line px-3 py-1.5 font-mono text-xs text-ink-dim hover:text-ink"
          >
            ↻ actualizar
          </button>
          <div className="font-mono text-[11px] text-ink-faint">
            {loading ? "cargando…" : `${fmt(fetched)} lecturas`}
            {truncated && " · ⚠ recortado a las más recientes"}
          </div>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!readings.length}
            className="ml-auto rounded-md border border-signal/60 bg-signal/10 px-3 py-1.5 font-mono text-xs font-semibold text-signal transition-colors hover:bg-signal/20 disabled:opacity-40"
          >
            ↓ Export CSV
          </button>
        </div>

        {/* Resumen min/máx/prom */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard title="Temp (°C)" s={stats.temp} digits={1} />
          <StatCard title="Velocidad (km/h)" s={stats.speed} digits={0} />
          <StatCard title="RSSI (dBm)" s={stats.rssi} digits={0} />
          <StatCard title="Potencia (W)" s={stats.power} digits={0} />
        </div>

        {/* Series */}
        <Panel title="T° aire interior" right={<ChartLegend thr={thr} />}>
          {readings.length ? (
            <TemperatureChart readings={readings} thr={thr} />
          ) : (
            <Empty loading={loading} />
          )}
        </Panel>

        <Panel title="Velocidad (GPS)">
          {readings.length ? (
            <MetricChart
              readings={readings}
              accessor={(r) => r.speed_kmph}
              unit="km/h"
              color="var(--signal)"
              label="Velocidad"
            />
          ) : (
            <Empty loading={loading} />
          )}
        </Panel>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Señal WiFi (RSSI)">
            {readings.length ? (
              <MetricChart
                readings={readings}
                accessor={(r) => r.rssi}
                unit="dBm"
                color="var(--ok)"
                label="RSSI"
              />
            ) : (
              <Empty loading={loading} />
            )}
          </Panel>

          <Panel title="Potencia">
            {readings.length ? (
              <MetricChart
                readings={readings}
                accessor={(r) => r.power_w}
                unit="W"
                color="var(--warn)"
                label="Potencia"
              />
            ) : (
              <Empty loading={loading} />
            )}
          </Panel>
        </div>

        {/* Tabla cruda (accesibilidad / verificación) */}
        <Panel
          title={`Tabla · ${showTable ? "últimas 100 filas" : "oculta"}`}
          right={
            <button
              type="button"
              onClick={() => setShowTable((v) => !v)}
              className="rounded border border-line px-2 py-1 font-mono text-[11px] text-ink-dim hover:text-ink"
            >
              {showTable ? "ocultar" : "ver tabla"}
            </button>
          }
        >
          {showTable ? (
            <RawTable rows={readings.slice(-100).reverse()} />
          ) : (
            <p className="text-sm text-ink-faint">
              Vista tabular de las lecturas (para verificación y accesibilidad).
            </p>
          )}
        </Panel>

        <p className="pt-2 text-center font-mono text-[11px] text-ink-faint">
          {source === "mock" ? "Datos de ejemplo · " : ""}El CSV exporta las{" "}
          {fmt(readings.length)} lecturas mostradas.
        </p>
      </main>
    </div>
  );
}

function StatCard({
  title,
  s,
  digits,
}: {
  title: string;
  s: { min: number; max: number; avg: number; n: number } | null;
  digits: number;
}) {
  return (
    <div className="rounded-lg border border-line bg-panel/80 p-3">
      <div className="eyebrow text-[10px]">{title}</div>
      {s ? (
        <div className="mt-2 grid grid-cols-3 gap-1 text-center">
          <Cell label="mín" value={fmt(s.min, digits)} />
          <Cell label="prom" value={fmt(s.avg, digits)} accent />
          <Cell label="máx" value={fmt(s.max, digits)} />
        </div>
      ) : (
        <div className="mt-2 font-mono text-sm text-ink-faint">sin datos</div>
      )}
    </div>
  );
}

function Cell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-ink-faint">{label}</div>
      <div className={`tabular font-mono text-base ${accent ? "text-ink" : "text-ink-dim"}`}>
        {value}
      </div>
    </div>
  );
}

function Empty({ loading }: { loading: boolean }) {
  return (
    <div className="grid h-[150px] w-full place-items-center rounded-md bg-panel-2/40 text-sm text-ink-faint">
      {loading ? "cargando…" : "sin datos en este rango"}
    </div>
  );
}

function RawTable({ rows }: { rows: Reading[] }) {
  return (
    <div className="max-h-[360px] overflow-auto rounded-md border border-line">
      <table className="w-full font-mono text-[11px]">
        <thead className="sticky top-0 bg-panel-2 text-ink-dim">
          <tr>
            {["hora", "°C", "fan", "km/h", "sat", "dBm"].map((h) => (
              <th key={h} className="px-2 py-1.5 text-right first:text-left">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="text-ink-dim">
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line/60">
              <td className="px-2 py-1 text-left">{hhmm(r.ts)}</td>
              <td className="px-2 py-1 text-right">{fmt(r.temp_c, 1)}</td>
              <td className="px-2 py-1 text-right">{r.fan_on == null ? "—" : r.fan_on ? "ON" : "off"}</td>
              <td className="px-2 py-1 text-right">{fmt(r.speed_kmph, 0)}</td>
              <td className="px-2 py-1 text-right">{fmt(r.sats, 0)}</td>
              <td className="px-2 py-1 text-right">{fmt(r.rssi, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
