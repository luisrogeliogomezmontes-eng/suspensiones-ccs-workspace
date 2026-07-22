"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useDeviceList } from "@/lib/devices";

const TABS = [
  { href: "/", label: "Overview" },
  { href: "/historico", label: "Histórico" },
  { href: "/mapa", label: "Mapa" },
  { href: "/alertas", label: "Alertas" },
  { href: "/control", label: "Control" },
];

export function NavTabs() {
  const path = usePathname();
  const { role, isDemo } = useAuth();
  const { devices } = useDeviceList();
  // "Flota" solo tiene sentido con más de un centinela.
  const base =
    devices.length > 1
      ? [{ href: "/flota", label: "Flota" }, ...TABS]
      : TABS;
  const tabs =
    isDemo || role === "admin"
      ? [...base, { href: "/usuarios", label: "Usuarios" }]
      : base;
  return (
    <nav className="flex items-center gap-1" aria-label="Secciones">
      {tabs.map((t) => {
        const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 font-display text-sm font-semibold tracking-wide transition-colors ${
              active
                ? "bg-panel-2 text-ink"
                : "text-ink-dim hover:bg-panel-2/60 hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
