import { ago } from "@/lib/format";

// Degradación elegante: si la unidad está offline, decirlo claro y congelar
// el último dato con su antigüedad. Nunca datos "muertos" disfrazados de vivos.
export function OfflineBanner({
  lastTs,
  now,
}: {
  lastTs: string | null;
  now: number;
}) {
  return (
    <div
      className="flex items-center gap-2 border-b px-4 py-2 text-sm sm:px-6"
      style={{
        background: "color-mix(in srgb, var(--crit) 12%, var(--bg))",
        borderColor: "color-mix(in srgb, var(--crit) 40%, var(--border))",
        color: "var(--ink)",
      }}
      role="status"
    >
      <span style={{ color: "var(--crit)" }}>⛔</span>
      <span>
        Unidad sin conexión. Mostrando el último dato recibido{" "}
        <strong className="font-mono">{lastTs ? ago(lastTs, now) : "—"}</strong>.
      </span>
    </div>
  );
}
