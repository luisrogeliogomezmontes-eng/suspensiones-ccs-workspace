"use client";

import { type LinkState } from "@/lib/status";
import { ago } from "@/lib/format";
import { ThemeToggle } from "./ThemeToggle";
import { NavTabs } from "./NavTabs";
import { UserMenu } from "./UserMenu";
import { DeviceSelector } from "./DeviceSelector";

const LINK_META: Record<LinkState, { label: string; color: string; pulse: boolean }> = {
  online: { label: "en línea", color: "var(--ok)", pulse: true },
  stale: { label: "señal débil", color: "var(--warn)", pulse: false },
  offline: { label: "sin conexión", color: "var(--crit)", pulse: false },
};

export function Header({
  link,
  lastTs,
  now,
  source,
}: {
  link: LinkState;
  lastTs: string | null;
  now: number;
  source: "live" | "mock";
}) {
  const meta = LINK_META[link];

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 sm:px-6">
      <div className="flex items-center gap-3">
        <div
          className="grid h-8 w-8 place-items-center rounded-md border border-line font-display text-sm font-bold text-signal"
          aria-hidden
        >
          SC
        </div>
        <DeviceSelector />
      </div>

      {/* Estado de enlace */}
      <div className="flex items-center gap-2 rounded-full border border-line bg-panel-2/60 px-3 py-1">
        <span className="relative flex h-2.5 w-2.5">
          {meta.pulse && (
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
        <span className="text-sm text-ink">{meta.label}</span>
        {link !== "online" && lastTs && (
          <span className="font-mono text-[11px] text-ink-faint">· {ago(lastTs, now)}</span>
        )}
      </div>

      <NavTabs />

      <div className="ml-auto flex items-center gap-2">
        <span
          className="rounded-md border px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider"
          style={{
            color: source === "live" ? "var(--ok)" : "var(--warn)",
            borderColor: source === "live" ? "var(--ok)" : "var(--warn)",
          }}
          title={source === "live" ? "Conectado a Supabase" : "Datos simulados (sin backend)"}
        >
          {source === "live" ? "live" : "demo"}
        </span>
        <UserMenu />
        <ThemeToggle />
      </div>
    </header>
  );
}
