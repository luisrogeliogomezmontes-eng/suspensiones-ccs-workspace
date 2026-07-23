"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { BoardState, Comanda, Etapa } from "@/lib/types";
import { totals, realH, excedidoH, semaforo } from "@/lib/derive";
import { hm, hDec, fechaHora, relTime } from "@/lib/format";
import { TOTAL_EST } from "@/lib/fases";
import { Ring } from "./Ring";
import { toneColor, comandaEstadoColor } from "./tone";
import { useNow } from "./useNow";

function StageRow({ e, nowMs }: { e: Etapa; nowMs: number }) {
  const sem = semaforo(e, nowMs);
  const real = realH(e, nowMs);
  const exc = excedidoH(e, nowMs);
  const running = e.estado === "En curso";
  const num = e.fase.split(" ")[0];

  // Botón contextual (deshabilitado hasta la Fase 3: escritura + PIN).
  const action =
    e.estado === "Pendiente" || e.estado === "Bloqueado"
      ? "Empezar"
      : e.estado === "En curso"
        ? "Terminar"
        : "Reabrir";

  return (
    <div
      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      {/* Nº de fase */}
      <div
        className="num grid h-8 w-8 place-items-center rounded-lg text-sm font-bold"
        style={{
          color: toneColor[sem.tone],
          background: "var(--panel-2)",
          border: "1px solid var(--border-2)",
        }}
      >
        {num}
      </div>

      {/* Nombre + tiempos */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>
            {e.fase.replace(/^\d+\s·\s/, "")}
          </span>
          <span className="text-xs" style={{ color: toneColor[sem.tone] }}>
            {running && <span className="live-dot mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ background: toneColor[sem.tone] }} />}
            {sem.label}
          </span>
        </div>
        <div className="num mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs" style={{ color: "var(--ink-dim)" }}>
          <span>est. {hm(e.estimadoH)}</span>
          <span>real <span style={{ color: e.inicio ? "var(--ink)" : "var(--ink-faint)" }}>{e.inicio ? hm(real) : "—"}</span></span>
          {exc > 0.01 && <span style={{ color: "var(--serious)" }}>+{hm(exc)}</span>}
          <span style={{ color: "var(--ink-faint)" }}>
            {e.inicio ? `inicio ${fechaHora(e.inicio)}` : "sin iniciar"}
            {e.fin ? ` · fin ${fechaHora(e.fin)}` : ""}
          </span>
        </div>
      </div>

      {/* Acción (Fase 3) */}
      <button
        className="btn"
        disabled
        title="Disponible en la Fase 3 (escritura + PIN)"
        style={{ opacity: 0.45, cursor: "not-allowed" }}
      >
        {action}
      </button>
    </div>
  );
}

export function ComandaDetail({ initial }: { initial: Comanda }) {
  const [c, setC] = useState<Comanda>(initial);
  const now = useNow(1000);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const r = await fetch("/api/state", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as BoardState;
        const found = j.comandas.find((x) => x.id === initial.id);
        if (alive && found) setC(found);
      } catch {}
    }
    const id = setInterval(tick, 20000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [initial.id]);

  const t = totals(c, now);
  const ringColor = c.estado === "Hecha" ? "var(--ok)" : t.excedidoTotal > 0 ? "var(--serious)" : "var(--signal)";

  return (
    <div>
      <Link href="/" className="text-sm" style={{ color: "var(--ink-dim)" }}>
        ← Comandas
      </Link>

      {/* Header */}
      <div className="card mt-3 flex flex-wrap items-center gap-5 p-5">
        <Ring pct={t.avancePct} size={96} sub={`${t.hechas}/${t.total}`} color={ringColor} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip num">{c.numero}</span>
            <span className="chip" style={{ color: comandaEstadoColor[c.estado] }}>{c.estado}</span>
          </div>
          <h1 className="mt-2 text-xl font-bold tracking-tight" style={{ fontFamily: "var(--font-saira)", color: "var(--ink)" }}>
            {c.titulo}
          </h1>
          <p className="mt-1 text-xs" style={{ color: "var(--ink-faint)" }}>
            {c.solicitante ? `solicitó ${c.solicitante} · ` : ""}pedido {fechaHora(c.fechaPedido)} ({relTime(c.fechaPedido, now)})
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center sm:grid-cols-3">
          <div>
            <div className="num text-lg font-bold" style={{ color: "var(--ink)" }}>{hDec(t.realTotal)}</div>
            <div className="eyebrow mt-0.5">Real</div>
          </div>
          <div>
            <div className="num text-lg font-bold" style={{ color: "var(--ink-dim)" }}>{hDec(TOTAL_EST)}</div>
            <div className="eyebrow mt-0.5">Estimado</div>
          </div>
          <div>
            <div className="num text-lg font-bold" style={{ color: t.excedidoTotal > 0.01 ? "var(--serious)" : "var(--ok)" }}>
              {t.excedidoTotal > 0.01 ? `+${hm(t.excedidoTotal)}` : "0m"}
            </div>
            <div className="eyebrow mt-0.5">Exceso</div>
          </div>
        </div>
      </div>

      {/* Etapas */}
      <div className="card mt-4">
        <div className="px-4 pt-3">
          <p className="eyebrow">Línea de producción · 7 etapas</p>
        </div>
        <div className="mt-1">
          {c.etapas.map((e) => (
            <StageRow key={e.id} e={e} nowMs={now} />
          ))}
        </div>
      </div>
    </div>
  );
}
