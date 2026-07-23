"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

function subscribeTheme(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
function readTheme(): "dark" | "light" {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function ThemeToggle() {
  // Lee el tema desde el DOM (patrón "external store"); el toggle escribe el atributo
  // y el MutationObserver dispara el re-render — sin setState dentro de un effect.
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "dark");
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {}
  }
  return (
    <button className="btn" onClick={toggle} aria-label="Cambiar tema" title="Cambiar tema">
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}

const LINKS = [
  { href: "/", label: "Comandas" },
  { href: "/materiales", label: "Materiales" },
  { href: "/inventario", label: "Inventario" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header
      className="sticky top-0 z-20 border-b backdrop-blur"
      style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--bg) 88%, transparent)" }}
    >
      <div className="mx-auto flex w-full max-w-[1200px] items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg">🛠️</span>
          <span
            className="font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-saira)", letterSpacing: "0.02em" }}
          >
            Producción · Centinelas
          </span>
        </Link>
        <nav className="ml-2 flex items-center gap-1">
          {LINKS.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors"
                style={{
                  color: active ? "var(--ink)" : "var(--ink-dim)",
                  background: active ? "var(--panel-2)" : "transparent",
                  border: `1px solid ${active ? "var(--border-2)" : "transparent"}`,
                }}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
