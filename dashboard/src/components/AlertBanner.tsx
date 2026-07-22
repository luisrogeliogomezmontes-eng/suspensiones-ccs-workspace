"use client";

import Link from "next/link";
import { SEV_META, sevColor, type Alert } from "@/lib/alerts";

// Aviso compacto arriba del Overview: muestra la alerta más severa y enlaza a
// la pantalla de Alertas. No renderiza nada si no hay alertas activas.
export function AlertBanner({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) return null;
  const top = alerts[0]; // vienen ordenadas por severidad desc
  const more = alerts.length - 1;
  const color = sevColor(top.severity);

  return (
    <Link
      href="/alertas"
      className="flex items-center gap-3 rounded-lg border px-4 py-2.5 transition-colors hover:bg-panel-2/50"
      style={{ borderColor: color, background: `color-mix(in srgb, ${color} 8%, transparent)` }}
    >
      <span className="text-lg leading-none" style={{ color }}>
        {SEV_META[top.severity].glyph}
      </span>
      <div className="min-w-0 flex-1">
        <span className="font-display text-sm font-bold text-ink">{top.title}</span>
        <span className="ml-2 font-mono text-[11px] text-ink-dim">{top.detail}</span>
      </div>
      {more > 0 && (
        <span className="shrink-0 rounded-full bg-panel-2 px-2 py-0.5 font-mono text-[10px] text-ink-dim">
          +{more} más
        </span>
      )}
      <span className="shrink-0 font-mono text-[11px] text-ink-faint">ver →</span>
    </Link>
  );
}
