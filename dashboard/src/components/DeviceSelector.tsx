"use client";

import { useEffect, useRef, useState } from "react";
import { useDeviceList } from "@/lib/devices";
import { useNow } from "@/lib/useTelemetry";
import { linkState, type LinkState } from "@/lib/status";
import { IconChevronDown, IconCheck } from "@/components/ui/icons";

const DOT: Record<LinkState, { color: string; label: string }> = {
  online: { color: "var(--ok)", label: "en línea" },
  stale: { color: "var(--warn)", label: "señal débil" },
  offline: { color: "var(--crit)", label: "sin conexión" },
};

// Selector de centinela en el header. Con una sola unidad se ve como el título
// de siempre; con flota, es un desplegable con el estado de enlace de cada una.
export function DeviceSelector() {
  const { devices, deviceId, setDeviceId } = useDeviceList();
  const now = useNow(10_000);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = devices.find((d) => d.id === deviceId) ?? null;
  const currentName = current?.name ?? "Centinela";
  const currentFw = current?.fw_version ?? "fw ?";

  // Con 0/1 unidades no hay nada que elegir → título estático (look original).
  if (devices.length <= 1) {
    return (
      <div className="leading-tight">
        <h1 className="font-display text-lg font-bold tracking-wide text-ink">
          {currentName}
        </h1>
        <p className="font-mono text-[11px] text-ink-faint">
          {currentFw} · maleta de conectividad
        </p>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="-mx-1.5 flex items-center gap-2 rounded-md px-1.5 py-0.5 text-left transition-colors hover:bg-panel-2/60"
      >
        <span className="leading-tight">
          <span className="flex items-center gap-1.5">
            <h1 className="font-display text-lg font-bold tracking-wide text-ink">
              {currentName}
            </h1>
            <IconChevronDown
              width={16}
              height={16}
              className={`text-ink-faint transition-transform ${open ? "rotate-180" : ""}`}
            />
          </span>
          <span className="block font-mono text-[11px] text-ink-faint">
            {currentFw} · {devices.length} unidades
          </span>
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 z-[1100] mt-1.5 w-64 overflow-hidden rounded-lg border border-line bg-panel shadow-lg"
        >
          {devices.map((d) => {
            const st = linkState(d.last_seen, now);
            const active = d.id === deviceId;
            return (
              <li key={d.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    setDeviceId(d.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-panel-2 ${
                    active ? "bg-panel-2/60" : ""
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: DOT[st].color }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-sm font-semibold text-ink">
                      {d.name ?? d.id.slice(0, 8)}
                    </span>
                    <span className="block font-mono text-[10px] text-ink-faint">
                      {DOT[st].label}
                    </span>
                  </span>
                  {active && (
                    <IconCheck width={16} height={16} className="shrink-0 text-signal" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
