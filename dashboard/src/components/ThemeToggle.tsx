"use client";

// Alterna tema claro/oscuro (legibilidad bajo sol). Toggle imperativo del
// atributo data-theme + localStorage; el icono correcto lo elige CSS según el
// tema activo (sin estado React → sin flash ni mismatch de hidratación).
export function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {}
  };

  return (
    <button
      onClick={toggle}
      className="rounded-md border border-line bg-panel-2/60 px-2.5 py-1.5 text-ink-dim transition-colors hover:text-ink"
      aria-label="Cambiar tema claro/oscuro"
      title="Tema"
    >
      <svg className="theme-sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <svg className="theme-moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>
    </button>
  );
}
