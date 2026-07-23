import Link from "next/link";
import type { Comanda } from "@/lib/types";
import { totals, realH, semaforo } from "@/lib/derive";
import { hm, hDec, relTime } from "@/lib/format";
import { TOTAL_EST } from "@/lib/fases";
import { Ring } from "./Ring";
import { StageStrip } from "./StageStrip";
import { toneColor, comandaEstadoColor } from "./tone";

export function ComandaCard({ c, nowMs }: { c: Comanda; nowMs: number }) {
  const t = totals(c, nowMs);
  const current = t.current;
  const sem = current ? semaforo(current, nowMs) : null;
  const currentReal = current ? realH(current, nowMs) : 0;
  const ringColor =
    c.estado === "Hecha" ? "var(--ok)" : t.excedidoTotal > 0 ? "var(--serious)" : "var(--signal)";

  return (
    <Link
      href={`/comanda/${c.id}`}
      className="card block p-4 transition-colors hover:border-[var(--border-2)]"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="chip num" style={{ color: "var(--ink-dim)" }}>
          {c.numero || "CMD"}
        </span>
        <span
          className="chip"
          style={{ color: comandaEstadoColor[c.estado], borderColor: "var(--border-2)" }}
        >
          <span
            className={c.estado === "En curso" ? "live-dot" : ""}
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: comandaEstadoColor[c.estado],
              display: "inline-block",
            }}
          />
          {c.estado}
        </span>
        <span className="ml-auto text-xs" style={{ color: "var(--ink-faint)" }}>
          pedido {relTime(c.fechaPedido, nowMs)}
        </span>
      </div>

      {/* Título */}
      <div className="mt-2.5">
        <h3 className="text-[0.98rem] font-semibold leading-snug" style={{ color: "var(--ink)" }}>
          {c.titulo || "Comanda sin nombre"}
        </h3>
        {c.solicitante && (
          <p className="mt-0.5 text-xs" style={{ color: "var(--ink-dim)" }}>
            solicitó {c.solicitante}
          </p>
        )}
      </div>

      {/* Ring + etapa actual */}
      <div className="mt-3 flex items-center gap-4">
        <Ring pct={t.avancePct} sub={`${t.hechas}/${t.total}`} color={ringColor} />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Etapa actual</p>
          {current ? (
            <>
              <p className="truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>
                {current.fase}
              </p>
              <p className="num mt-1 text-sm" style={{ color: sem ? toneColor[sem.tone] : "var(--ink-dim)" }}>
                {current.estado === "En curso"
                  ? `${hm(currentReal)} / ${hm(current.estimadoH)}`
                  : current.estado === "Bloqueado"
                    ? "bloqueada"
                    : `pendiente · est. ${hm(current.estimadoH)}`}
              </p>
              {sem && current.estado === "En curso" && (
                <p className="mt-0.5 text-xs" style={{ color: toneColor[sem.tone] }}>
                  {sem.label}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm font-semibold" style={{ color: "var(--ok)" }}>
              ✓ Todas las etapas cerradas
            </p>
          )}
        </div>
      </div>

      {/* Tira de etapas */}
      <div className="mt-3">
        <StageStrip etapas={c.etapas} nowMs={nowMs} />
      </div>

      {/* Footer: tiempos */}
      <div className="mt-3 flex items-center justify-between border-t pt-2.5 text-xs" style={{ borderColor: "var(--border)" }}>
        <span style={{ color: "var(--ink-dim)" }}>
          Real <span className="num" style={{ color: "var(--ink)" }}>{hDec(t.realTotal)}</span>
          <span style={{ color: "var(--ink-faint)" }}> / {hDec(TOTAL_EST)} est.</span>
        </span>
        {t.excedidoTotal > 0.01 ? (
          <span className="num" style={{ color: "var(--serious)" }}>
            +{hm(t.excedidoTotal)} sobre estimado
          </span>
        ) : (
          <span style={{ color: "var(--ok)" }}>en tiempo</span>
        )}
      </div>
    </Link>
  );
}
