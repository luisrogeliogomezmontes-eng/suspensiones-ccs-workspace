"use client";

import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Panel } from "@/components/ui/Panel";
import { useTelemetry, useNow } from "@/lib/useTelemetry";
import { useDeviceId } from "@/lib/devices";
import { linkState, thresholdsOf } from "@/lib/status";
import { deriveAlerts, SEV_META, sevColor, type Severity, type EventKind } from "@/lib/alerts";
import { getSupabase, DEFAULT_DEVICE_ID, FORCE_DEMO } from "@/lib/supabase/client";
import { hhmm, ago } from "@/lib/format";

interface EventRow {
  id: number;
  ts: string;
  kind: EventKind;
  severity: Severity;
  message: string | null;
  ack_ts: string | null;
}

function useEvents(deviceId = DEFAULT_DEVICE_ID, limit = 50) {
  const supabase = FORCE_DEMO ? null : getSupabase();
  const [events, setEvents] = useState<EventRow[]>([]);
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    const load = () =>
      supabase
        .from("events")
        .select("id,ts,kind,severity,message,ack_ts")
        .eq("device_id", deviceId)
        .order("ts", { ascending: false })
        .limit(limit)
        .then(({ data }) => {
          if (alive && data) setEvents(data as EventRow[]);
        });
    load();
    const ch = supabase
      .channel(`events:${deviceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `device_id=eq.${deviceId}` }, () => load())
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [supabase, deviceId, limit]);
  return events;
}

export default function Alertas() {
  const deviceId = useDeviceId();
  const { device, latest } = useTelemetry(deviceId);
  const now = useNow();
  const link = linkState(latest?.ts, now);
  const thr = thresholdsOf(device);
  const alerts = useMemo(() => deriveAlerts(latest, link, thr), [latest, link, thr]);
  const events = useEvents(deviceId);

  return (
    <div className="min-h-full">
      <AppHeader />
      <main className="mx-auto max-w-[1000px] space-y-4 p-4 sm:p-6">
        <Panel title={`Alertas activas · ${alerts.length}`}>
          {alerts.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-ink-dim">
              <span className="text-ok">✓</span> Sin alertas — todo en rango.
            </div>
          ) : (
            <ul className="space-y-2">
              {alerts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start gap-3 rounded-md border border-line bg-panel-2/50 px-3 py-2.5"
                  style={{ borderLeft: `3px solid ${sevColor(a.severity)}` }}
                >
                  <span className="mt-0.5 text-lg leading-none" style={{ color: sevColor(a.severity) }}>
                    {SEV_META[a.severity].glyph}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm font-bold text-ink">{a.title}</span>
                      <span
                        className="rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider"
                        style={{ color: sevColor(a.severity), border: `1px solid ${sevColor(a.severity)}` }}
                      >
                        {SEV_META[a.severity].label}
                      </span>
                    </div>
                    <p className="font-mono text-[11px] text-ink-dim">{a.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Bitácora de eventos">
          {events.length === 0 ? (
            <p className="text-sm text-ink-faint">
              Sin eventos registrados todavía. Aquí quedará el historial de alertas
              confirmadas; las de arriba son el estado en vivo de la unidad.
            </p>
          ) : (
            <div className="max-h-[420px] overflow-auto rounded-md border border-line">
              <table className="w-full font-mono text-[11px]">
                <thead className="sticky top-0 bg-panel-2 text-ink-dim">
                  <tr>
                    {["cuándo", "tipo", "sev.", "mensaje", "ack"].map((h) => (
                      <th key={h} className="px-2 py-1.5 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-ink-dim">
                  {events.map((e) => (
                    <tr key={e.id} className="border-t border-line/60">
                      <td className="px-2 py-1" title={e.ts}>{ago(e.ts, now)}</td>
                      <td className="px-2 py-1 text-ink">{e.kind}</td>
                      <td className="px-2 py-1" style={{ color: sevColor(e.severity) }}>
                        {SEV_META[e.severity].label}
                      </td>
                      <td className="px-2 py-1">{e.message ?? "—"}</td>
                      <td className="px-2 py-1">{e.ack_ts ? `✓ ${hhmm(e.ack_ts)}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </main>
    </div>
  );
}
