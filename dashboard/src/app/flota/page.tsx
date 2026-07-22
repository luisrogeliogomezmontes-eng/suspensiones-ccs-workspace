"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { useFleet, type FleetEntry } from "@/lib/useFleet";
import { useDeviceList } from "@/lib/devices";
import { useNow } from "@/lib/useTelemetry";
import {
  linkState,
  tempLevel,
  levelColor,
  DEFAULT_TEMP_THRESHOLDS,
  type LinkState,
} from "@/lib/status";
import { ago, fmt } from "@/lib/format";
import { IconThermo, IconFan, IconSignal } from "@/components/ui/icons";

const LINK: Record<LinkState, { color: string; label: string }> = {
  online: { color: "var(--ok)", label: "en línea" },
  stale: { color: "var(--warn)", label: "señal débil" },
  offline: { color: "var(--crit)", label: "sin conexión" },
};

function uptimeShort(s: number | null | undefined): string {
  if (s == null) return "—";
  if (s < 3600) return `${Math.round(s / 60)} min`;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

export default function Flota() {
  const { entries, source } = useFleet();
  const now = useNow();

  const online = entries.filter(
    (e) => linkState(e.latest?.ts ?? e.device.last_seen, now) === "online"
  ).length;

  return (
    <div className="min-h-full">
      <AppHeader />
      <main className="mx-auto max-w-[1200px] space-y-4 p-4 sm:p-6">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-xl font-bold tracking-wide text-ink">
            Flota
          </h2>
          <span className="font-mono text-[11px] text-ink-faint">
            {entries.length} centinela{entries.length === 1 ? "" : "s"} · {online} en
            línea
          </span>
        </div>

        {entries.length === 0 ? (
          <div className="grid h-40 place-items-center rounded-lg border border-line bg-panel-2/40 text-sm text-ink-faint">
            No hay unidades registradas todavía.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((e) => (
              <FleetCard key={e.device.id} entry={e} now={now} />
            ))}
          </div>
        )}

        <p className="pt-2 text-center font-mono text-[11px] text-ink-faint">
          {source === "mock" ? "Datos de ejemplo · " : ""}Tocá una unidad para ver su
          panel completo.
        </p>
      </main>
    </div>
  );
}

function FleetCard({ entry, now }: { entry: FleetEntry; now: number }) {
  const router = useRouter();
  const { setDeviceId } = useDeviceList();
  const { device, latest } = entry;

  // Frescura: prioriza la última lectura; si no hay, el last_seen del device.
  const link = linkState(latest?.ts ?? device.last_seen, now);
  const meta = LINK[link];

  const lvl = tempLevel(latest?.temp_c, DEFAULT_TEMP_THRESHOLDS);
  const tempColor = latest?.temp_c != null ? levelColor(lvl) : "var(--ink-faint)";

  const fanText =
    latest?.fan_on == null
      ? "—"
      : latest.fan_on
        ? `ON · ${fmt(latest.fan_duty)}%`
        : "OFF";

  const open = () => {
    setDeviceId(device.id);
    router.push("/");
  };

  return (
    <button
      type="button"
      onClick={open}
      className="group flex flex-col gap-3 rounded-lg border border-line bg-panel/80 p-4 text-left transition-colors hover:border-signal/60 hover:bg-panel-2/50"
    >
      {/* Cabecera: nombre + estado */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            {link === "online" && (
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                style={{ background: meta.color }}
              />
            )}
            <span
              className="relative inline-flex h-2.5 w-2.5 rounded-full"
              style={{ background: meta.color }}
            />
          </span>
          <span className="truncate font-display text-base font-bold tracking-wide text-ink">
            {device.name ?? device.id.slice(0, 8)}
          </span>
        </div>
        <span className="shrink-0 font-mono text-[10px] text-ink-faint">
          {link === "online" ? meta.label : ago(latest?.ts ?? device.last_seen, now)}
        </span>
      </div>

      {/* Temperatura protagonista */}
      <div className="flex items-end gap-2">
        <IconThermo width={20} height={20} style={{ color: tempColor }} />
        <span
          className="tabular font-mono text-3xl font-bold leading-none"
          style={{ color: tempColor }}
        >
          {fmt(latest?.temp_c, 1)}
        </span>
        <span className="pb-0.5 font-mono text-sm text-ink-faint">°C</span>
      </div>

      {/* Métricas secundarias */}
      <div className="grid grid-cols-3 gap-2 border-t border-line/60 pt-3">
        <Metric icon={<IconFan width={14} height={14} />} label="fan" value={fanText} />
        <Metric
          icon={<IconSignal width={14} height={14} />}
          label="rssi"
          value={latest?.rssi != null ? `${fmt(latest.rssi)}` : "—"}
        />
        <Metric label="uptime" value={uptimeShort(latest?.uptime_s)} />
      </div>

      <span className="font-mono text-[10px] text-ink-faint opacity-0 transition-opacity group-hover:opacity-100">
        ver panel →
      </span>
    </button>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-ink-faint">
        {icon}
        <span className="eyebrow text-[9px]">{label}</span>
      </div>
      <div className="tabular mt-0.5 truncate font-mono text-sm text-ink-dim">
        {value}
      </div>
    </div>
  );
}
