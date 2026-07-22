import type { ReactNode } from "react";

// Panel de instrumento: superficie con borde, eyebrow técnico y slot derecho.
export function Panel({
  title,
  right,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-line bg-panel/80 backdrop-blur-sm ${className}`}
    >
      {(title || right) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          {title && <h2 className="eyebrow text-[11px]">{title}</h2>}
          {right && <div className="flex items-center gap-2">{right}</div>}
        </header>
      )}
      <div className={`p-4 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
