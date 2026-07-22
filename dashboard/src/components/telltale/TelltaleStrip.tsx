import type { Device, Reading } from "@/lib/types";
import { tempLevel, battLevel, levelColor, thresholdsOf } from "@/lib/status";
import { fmt } from "@/lib/format";
import { Telltale } from "./Telltale";
import { Sparkline } from "@/components/charts/Sparkline";
import {
  IconThermo,
  IconFan,
  IconSat,
  IconBattery,
  IconBolt,
  IconSignal,
} from "@/components/ui/icons";

// La "tira de testigos" — elemento firma. Siempre visible, como las luces de
// advertencia de un tablero: fan · GPS · enlace · batería · temp · potencia.
export function TelltaleStrip({
  readings,
  device,
}: {
  readings: Reading[];
  device: Device | null;
}) {
  const latest = readings.at(-1) ?? null;
  const thr = thresholdsOf(device);

  const tempSeries = readings.map((r) => r.temp_c).filter((n): n is number => n != null);
  const rssiSeries = readings.map((r) => r.rssi).filter((n): n is number => n != null);

  const t = latest?.temp_c ?? null;
  const tLevel = tempLevel(t, thr);
  const fanOn = latest?.fan_on ?? false;
  const hasFix = (latest?.sats ?? 0) >= 4;

  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
      <Telltale
        icon={<IconThermo />}
        label="T° aire"
        value={fmt(t, 1)}
        unit="°C"
        level={tLevel}
        sub={
          <Sparkline data={tempSeries.slice(-40)} stroke={levelColor(tLevel)} />
        }
      />

      <Telltale
        icon={<IconFan />}
        label="Ventilador"
        value={fanOn ? "ON" : "OFF"}
        accent={fanOn ? "var(--signal)" : undefined}
        sub={
          <span className="font-mono text-xs text-ink-faint">
            duty {fmt(latest?.fan_duty ?? 0)}%
            {latest?.fan_rpm ? ` · ${fmt(latest.fan_rpm)} rpm` : ""}
          </span>
        }
      />

      <Telltale
        icon={<IconSat />}
        label="GPS"
        value={hasFix ? "FIX" : "—"}
        accent={hasFix ? "var(--ok)" : "var(--ink-faint)"}
        sub={
          <span className="font-mono text-xs text-ink-faint">
            {fmt(latest?.sats ?? 0)} sat · HDOP {fmt(latest?.hdop, 1)}
          </span>
        }
      />

      <Telltale
        icon={<IconBattery />}
        label="Batería"
        value={fmt(latest?.batt_soc)}
        unit="%"
        level={battLevel(latest?.batt_soc)}
      />

      <Telltale
        icon={<IconBolt />}
        label="Potencia"
        value={fmt(latest?.power_w)}
        unit="W"
        accent="var(--ink-dim)"
      />

      <Telltale
        icon={<IconSignal />}
        label="Enlace"
        value={fmt(latest?.rssi)}
        unit="dBm"
        accent="var(--signal)"
        sub={<Sparkline data={rssiSeries.slice(-40)} stroke="var(--signal)" />}
      />
    </div>
  );
}
