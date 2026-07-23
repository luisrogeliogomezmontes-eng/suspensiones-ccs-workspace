"use client";

import { useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Panel } from "@/components/ui/Panel";
import { useAuth } from "@/lib/auth";
import { useTelemetry } from "@/lib/useTelemetry";
import { useDeviceId } from "@/lib/devices";
import { useCommands, sendCommand, type CommandType } from "@/lib/commands";
import { hhmm } from "@/lib/format";
import { thresholdsOf } from "@/lib/status";

export default function Control() {
  const { isOperator, isDemo } = useAuth();
  const deviceId = useDeviceId();
  const { device, latest } = useTelemetry(deviceId);
  const { commands, supabase } = useCommands(deviceId);
  const thr = thresholdsOf(device);

  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // ── Estado de control REAL del device (read-back) ──────────────────────────
  // Preferí la telemetría: el firmware nuevo reporta temp_on/temp_off/fan_mode
  // (migración 0010). Si vienen null (firmware viejo, p.ej. Centinela 01 en campo
  // sin OTA), caé al último `setpoint`/`fan_mode` CON ACK de la tabla commands —
  // así el panel refleja lo último realmente aplicado, nunca un valor inventado.
  const lastAckedSetpoint = commands.find(
    (c) =>
      c.type === "setpoint" &&
      c.ack_ts &&
      typeof c.payload?.temp_on === "number" &&
      typeof c.payload?.temp_off === "number"
  );
  const liveOn =
    latest?.temp_on ?? (lastAckedSetpoint?.payload?.temp_on as number | undefined);
  const liveOff =
    latest?.temp_off ?? (lastAckedSetpoint?.payload?.temp_off as number | undefined);
  const liveMode: string | null =
    latest?.fan_mode ??
    ((commands.find((c) => c.type === "fan_mode" && c.ack_ts)?.payload?.mode as
      | string
      | undefined) ??
      null);
  const controlSrc: "device" | "cmd" | "none" =
    latest?.temp_on != null ? "device" : lastAckedSetpoint ? "cmd" : "none";

  // Umbrales de alarma editables (se siembran del device)
  const [warn, setWarn] = useState(thr.warn);
  const [serious, setSerious] = useState(thr.serious);
  const [crit, setCrit] = useState(thr.crit);
  // Setpoint del fan editable (se siembra UNA vez del estado real del device)
  const [tOn, setTOn] = useState(40);
  const [tOff, setTOff] = useState(25);
  useEffect(() => {
    // Siembra los inputs desde los umbrales del device (fuente externa).
    /* eslint-disable react-hooks/set-state-in-effect */
    setWarn(thr.warn);
    setSerious(thr.serious);
    setCrit(thr.crit);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [thr.warn, thr.serious, thr.crit]);

  // Siembra el setpoint SOLO la primera vez que llega el estado real (evita pisar
  // lo que el operador escribe cada vez que entra una telemetría nueva).
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || liveOn == null || liveOff == null) return;
    setTOn(liveOn);
    setTOff(liveOff);
    seeded.current = true;
  }, [liveOn, liveOff]);

  const canSend = isOperator && !!supabase;

  const run = async (key: string, fn: () => Promise<{ error?: string }>) => {
    setBusy(key);
    setMsg(null);
    const { error } = await fn();
    setBusy(null);
    setMsg(error ? { ok: false, text: error } : { ok: true, text: "Comando enviado ✓" });
  };

  const cmd = (key: string, type: CommandType, payload: Record<string, unknown>) =>
    run(key, () => sendCommand(supabase!, deviceId, type, payload));

  const saveThresholds = () =>
    run("thr", async () => {
      const { error } = await supabase!
        .from("devices")
        .update({ temp_warn: warn, temp_serious: serious, temp_crit: crit })
        .eq("id", deviceId);
      return { error: error?.message };
    });

  const curMode = liveMode ? liveMode.toUpperCase() : "—";
  const curDuty = latest?.fan_duty != null ? `${latest.fan_duty}%` : "—";

  return (
    <div className="min-h-full">
      <AppHeader />

      <main className="mx-auto max-w-[1000px] space-y-4 p-4 sm:p-6">
        {!isOperator && (
          <div className="rounded-md border border-warn/40 bg-warn/10 px-4 py-2.5 text-sm text-ink-dim">
            Tu rol es de solo lectura. El control (fan, setpoint, reinicio) requiere rol
            <b className="text-ink"> operator</b>. Podés ver el registro de comandos abajo.
          </div>
        )}
        {isDemo && (
          <div className="rounded-md border border-warn/40 bg-warn/10 px-4 py-2.5 text-sm text-ink-dim">
            Modo demostración: los comandos no se envían a ninguna unidad.
          </div>
        )}
        {msg && (
          <div
            className={`rounded-md border px-4 py-2.5 text-sm ${
              msg.ok ? "border-ok/40 bg-ok/10 text-ink" : "border-crit/40 bg-crit/10 text-ink"
            }`}
          >
            {msg.text}
          </div>
        )}

        {/* Estado real del ventilador (read-back del device) */}
        <Panel title="Estado actual del ventilador">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 font-mono text-sm text-ink-dim">
            <span>modo <b className="text-ink">{curMode}</b></span>
            <span>duty <b className="text-ink">{curDuty}</b></span>
            <span>enciende <b className="text-ink">{liveOn != null ? `${liveOn}°C` : "—"}</b></span>
            <span>apaga <b className="text-ink">{liveOff != null ? `${liveOff}°C` : "—"}</b></span>
            <span className="text-[11px] text-ink-faint">
              {controlSrc === "device"
                ? "· leído del device en vivo"
                : controlSrc === "cmd"
                  ? "· según último comando aplicado (unidad sin read-back)"
                  : "· sin datos de control todavía"}
            </span>
          </div>
        </Panel>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Ventilador */}
          <Panel title={`Ventilador · modo ${curMode}`}>
            <div className="space-y-3">
              <div className="flex gap-2">
                {(["auto", "on", "off"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    disabled={!canSend || busy != null}
                    onClick={() => cmd(`fan-${m}`, "fan_mode", { mode: m })}
                    className="flex-1 rounded-md border border-line bg-panel-2 py-2.5 font-display text-sm font-bold uppercase tracking-wide text-ink transition-colors hover:border-signal disabled:opacity-40"
                  >
                    {busy === `fan-${m}` ? "…" : m}
                  </button>
                ))}
              </div>
              <p className="font-mono text-[11px] text-ink-faint">
                Auto = histéresis por temperatura. On/Off = manual (override).
              </p>
            </div>
          </Panel>

          {/* Setpoint / histéresis del fan */}
          <Panel title="Setpoint del ventilador (°C aire)">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <NumField label="Enciende a" value={tOn} onChange={setTOn} />
                <NumField label="Apaga a" value={tOff} onChange={setTOff} />
              </div>
              <button
                type="button"
                disabled={!canSend || busy != null || tOff >= tOn}
                onClick={() => cmd("setp", "setpoint", { temp_on: tOn, temp_off: tOff })}
                className="w-full rounded-md bg-signal py-2.5 font-display text-sm font-bold text-black disabled:opacity-40"
              >
                {busy === "setp" ? "…" : "Aplicar setpoint"}
              </button>
              {tOff >= tOn && (
                <p className="font-mono text-[11px] text-crit">
                  &quot;Apaga&quot; debe ser menor que &quot;enciende&quot; (histéresis).
                </p>
              )}
            </div>
          </Panel>

          {/* Umbrales de alarma (colores del dashboard) */}
          <Panel title="Umbrales de alarma (T° aire)">
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <NumField label="Adv." value={warn} onChange={setWarn} />
                <NumField label="Serio" value={serious} onChange={setSerious} />
                <NumField label="Crít." value={crit} onChange={setCrit} />
              </div>
              <button
                type="button"
                disabled={!canSend || busy != null}
                onClick={saveThresholds}
                className="w-full rounded-md border border-line bg-panel-2 py-2.5 font-display text-sm font-bold text-ink hover:border-signal disabled:opacity-40"
              >
                {busy === "thr" ? "…" : "Guardar umbrales"}
              </button>
            </div>
          </Panel>

          {/* Acciones de potencia */}
          <Panel title="Energía / reinicio">
            <div className="space-y-2">
              <ConfirmButton
                label="Power-cycle Starlink (no disponible)"
                disabled
                onClick={() => {}}
              />
              <p className="font-mono text-[11px] text-ink-faint">
                Requiere el relé de 12&nbsp;V en la unidad (I5) — aún no instalado.
                Hoy el firmware solo confirma el comando, no corta energía →
                deshabilitado para no dar falsa sensación de control.
              </p>
              <ConfirmButton
                label="Reiniciar la unidad"
                danger
                disabled={!canSend || busy != null}
                busy={busy === "rb"}
                onClick={() => cmd("rb", "reboot", {})}
              />
              <p className="font-mono text-[11px] text-ink-faint">
                El reinicio se aplica a los pocos segundos. ⚠️ En una unidad en
                campo (p.ej. Centinela 01) corta ~30&nbsp;s de telemetría.
              </p>
            </div>
          </Panel>
        </div>

        {/* Registro de comandos */}
        <Panel title="Registro de comandos">
          {commands.length ? (
            <div className="max-h-[320px] overflow-auto rounded-md border border-line">
              <table className="w-full font-mono text-[11px]">
                <thead className="sticky top-0 bg-panel-2 text-ink-dim">
                  <tr>
                    {["hora", "tipo", "payload", "estado"].map((h) => (
                      <th key={h} className="px-2 py-1.5 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-ink-dim">
                  {commands.map((c) => (
                    <tr key={c.id} className="border-t border-line/60">
                      <td className="px-2 py-1">{hhmm(c.ts)}</td>
                      <td className="px-2 py-1 text-ink">{c.type}</td>
                      <td className="px-2 py-1">{JSON.stringify(c.payload)}</td>
                      <td className="px-2 py-1">
                        {c.ack_ts ? (
                          <span className="text-ok">ack ✓</span>
                        ) : (
                          <span className="text-warn">pendiente</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-ink-faint">
              Sin comandos todavía{isDemo ? " (demo)" : ""}.
            </p>
          )}
        </Panel>

        <p className="pt-2 text-center font-mono text-[11px] text-ink-faint">
          Cada comando queda registrado abajo con la hora de envío y de aplicación.
        </p>
      </main>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-1 block text-[9px]">{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full rounded-md border border-line bg-panel-2 px-2 py-1.5 text-center font-mono text-sm text-ink outline-none focus:border-signal"
      />
    </label>
  );
}

function ConfirmButton({
  label,
  onClick,
  disabled,
  busy,
  danger,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (window.confirm(`¿Confirmás: ${label}?`)) onClick();
      }}
      className={`w-full rounded-md border py-2.5 font-display text-sm font-bold transition-colors disabled:opacity-40 ${
        danger
          ? "border-crit/50 text-crit hover:bg-crit/10"
          : "border-line bg-panel-2 text-ink hover:border-signal"
      }`}
    >
      {busy ? "…" : label}
    </button>
  );
}
