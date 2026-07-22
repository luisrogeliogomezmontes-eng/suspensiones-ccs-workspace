"use client";

import { useEffect, useState } from "react";
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

  // Umbrales editables (se siembran del device)
  const [warn, setWarn] = useState(thr.warn);
  const [serious, setSerious] = useState(thr.serious);
  const [crit, setCrit] = useState(thr.crit);
  const [tOn, setTOn] = useState(40);
  const [tOff, setTOff] = useState(35);
  useEffect(() => {
    // Siembra los inputs desde los umbrales del device (fuente externa).
    /* eslint-disable react-hooks/set-state-in-effect */
    setWarn(thr.warn);
    setSerious(thr.serious);
    setCrit(thr.crit);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [thr.warn, thr.serious, thr.crit]);

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

  const fanMode = latest?.fan_on == null ? "—" : latest.fan_on ? "ON" : "OFF";

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

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Ventilador */}
          <Panel title={`Ventilador · ahora ${fanMode}`}>
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
                label="Power-cycle Starlink"
                disabled={!canSend || busy != null}
                busy={busy === "pc"}
                onClick={() => cmd("pc", "power_cycle", { target: "starlink" })}
              />
              <ConfirmButton
                label="Reiniciar la unidad"
                danger
                disabled={!canSend || busy != null}
                busy={busy === "rb"}
                onClick={() => cmd("rb", "reboot", {})}
              />
              <p className="font-mono text-[11px] text-ink-faint">
                La unidad aplica estos comandos a los pocos segundos de recibirlos.
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
