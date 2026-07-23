"use client";
import { useEffect, useState } from "react";
import type { BoardState } from "@/lib/types";
import { totals } from "@/lib/derive";
import { relTime } from "@/lib/format";
import { useNow } from "./useNow";
import { ComandaCard } from "./ComandaCard";
import { NewComanda } from "./NewComanda";

function Kpi({ value, label, color }: { value: number | string; label: string; color?: string }) {
  return (
    <div className="card px-4 py-2.5">
      <div className="num text-xl font-bold" style={{ color: color ?? "var(--ink)" }}>
        {value}
      </div>
      <div className="eyebrow mt-0.5">{label}</div>
    </div>
  );
}

export function Board({ initial }: { initial: BoardState }) {
  const [state, setState] = useState<BoardState>(initial);
  const [stale, setStale] = useState(false);
  const now = useNow(1000);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const r = await fetch("/api/state", { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as BoardState;
        if (alive) {
          setState(j);
          setStale(false);
        }
      } catch {
        if (alive) setStale(true);
      }
    }
    const id = setInterval(tick, 20000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const comandas = state.comandas.filter((c) => c.estado !== "Cancelada");
  const enCurso = comandas.filter((c) => c.estado === "En curso").length;
  const excedidas = comandas.filter((c) => totals(c, now).excedidoTotal > 0.01).length;
  const hechas = comandas.filter((c) => c.estado === "Hecha").length;

  return (
    <div>
      {/* Encabezado + estado de conexión */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--font-saira)", color: "var(--ink)" }}>
            Comandas en fabricación
          </h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs" style={{ color: "var(--ink-faint)" }}>
            <span
              className={stale ? "" : "live-dot"}
              style={{ width: 7, height: 7, borderRadius: 999, background: stale ? "var(--warn)" : "var(--ok)", display: "inline-block" }}
            />
            {stale ? "reintentando conexión…" : `en vivo · datos ${relTime(state.generatedAt, now)}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Kpi value={comandas.length} label="Comandas" />
          <Kpi value={enCurso} label="En curso" color="var(--signal)" />
          <Kpi value={excedidas} label="Excedidas" color={excedidas > 0 ? "var(--serious)" : "var(--ink)"} />
          <Kpi value={hechas} label="Hechas" color="var(--ok)" />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <NewComanda
          suggested={`Centinela A2 · Unidad #${String(state.comandas.length + 1).padStart(2, "0")}`}
          bom={state.bom}
          porConstruir={comandas.filter((c) => c.estado === "Pendiente" || c.estado === "En curso" || c.estado === "En pausa").length}
        />
      </div>

      {/* Grid de comandas */}
      {comandas.length === 0 ? (
        <div className="card mt-6 p-8 text-center" style={{ color: "var(--ink-dim)" }}>
          <p className="text-sm">No hay comandas todavía.</p>
          <p className="mt-1 text-xs" style={{ color: "var(--ink-faint)" }}>
            Crea una en Notion (BD “Comandas”) y aparecerá aquí en ~20 s.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {comandas.map((c) => (
            <ComandaCard key={c.id} c={c} nowMs={now} />
          ))}
        </div>
      )}
    </div>
  );
}
