"use client";
import { useEffect, useMemo, useState } from "react";
import type { BoardState, BomRow } from "@/lib/types";
import { FASES } from "@/lib/fases";

type Row = BomRow & {
  falta1: boolean; // no alcanza ni para 1 unidad (comprado < usa/ud)
  reservado: number; // usa/ud × comandas activas
  libre: number; // comprado − reservado
  faltaComprar: number; // para cubrir las comandas activas
  status: "falta" | "justo" | "ok";
};

function rowInfo(r: BomRow, activas: number): Row {
  const reservado = r.cantUd * activas;
  const libre = r.comprado - reservado;
  const falta1 = r.comprado < r.cantUd;
  const faltaComprar = Math.max(reservado - r.comprado, 0);
  const status: Row["status"] = falta1 ? "falta" : libre < -1e-6 ? "justo" : "ok";
  return { ...r, falta1, reservado, libre, faltaComprar, status };
}

const STATUS_COLOR: Record<Row["status"], string> = {
  falta: "var(--crit)",
  justo: "var(--warn)",
  ok: "var(--ok)",
};

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

export function MaterialesView({ initial }: { initial: BoardState }) {
  const [state, setState] = useState<BoardState>(initial);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const r = await fetch("/api/state", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as BoardState;
        if (alive) setState(j);
      } catch {}
    }
    const id = setInterval(tick, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const activas = state.comandas.filter((c) => c.estado !== "Cancelada").length;

  const rowsByFase = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const f of FASES) {
      const rows = state.bom
        .filter((b) => b.fases.includes(f.key))
        .map((b) => rowInfo(b, activas))
        .sort((a, b) => a.item.localeCompare(b.item));
      map.set(f.key, rows);
    }
    return map;
  }, [state.bom, activas]);

  // Compras: componentes únicos que faltan para cubrir las comandas activas.
  const compras = useMemo(() => {
    const seen = new Map<string, Row & { faseNums: number[] }>();
    for (const f of FASES) {
      for (const r of rowsByFase.get(f.key) ?? []) {
        if (r.faltaComprar <= 1e-6 && !r.falta1) continue;
        const prev = seen.get(r.id);
        if (prev) prev.faseNums.push(f.n);
        else seen.set(r.id, { ...r, faseNums: [f.n] });
      }
    }
    return [...seen.values()].sort((a, b) => b.faltaComprar - a.faltaComprar);
  }, [rowsByFase]);

  const fasesBloqueadas = FASES.filter((f) =>
    (rowsByFase.get(f.key) ?? []).some((r) => r.status === "falta"),
  ).length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--font-saira)", color: "var(--ink)" }}>
            Materiales por etapa
          </h1>
          <p className="mt-0.5 text-xs" style={{ color: "var(--ink-faint)" }}>
            qué usa cada fase · qué bloquea · qué pasar a compras · descontando {activas} comandas activas
          </p>
        </div>
        <div className="flex gap-2">
          <div className="card px-4 py-2.5">
            <div className="num text-xl font-bold" style={{ color: "var(--ink)" }}>{activas}</div>
            <div className="eyebrow mt-0.5">Comandas activas</div>
          </div>
          <div className="card px-4 py-2.5">
            <div className="num text-xl font-bold" style={{ color: fasesBloqueadas > 0 ? "var(--crit)" : "var(--ok)" }}>{fasesBloqueadas}</div>
            <div className="eyebrow mt-0.5">Fases bloqueadas</div>
          </div>
          <div className="card px-4 py-2.5">
            <div className="num text-xl font-bold" style={{ color: compras.length > 0 ? "var(--serious)" : "var(--ok)" }}>{compras.length}</div>
            <div className="eyebrow mt-0.5">A comprar</div>
          </div>
        </div>
      </div>

      {/* Compras pendientes */}
      {compras.length > 0 && (
        <div className="card mt-5 p-4" style={{ borderColor: "var(--border-2)" }}>
          <p className="eyebrow" style={{ color: "var(--serious)" }}>🛒 Pasar a compras — bloquea producción</p>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            {compras.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ background: "var(--panel-2)" }}>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>
                    {r.item.replace(/\s*→.*$/, "")}
                  </div>
                  <div className="text-xs" style={{ color: "var(--ink-faint)" }}>
                    bloquea fase{r.faseNums.length > 1 ? "s" : ""} {r.faseNums.join(", ")}
                  </div>
                </div>
                <div className="num whitespace-nowrap text-right text-sm font-bold" style={{ color: "var(--crit)" }}>
                  faltan {fmt(Math.ceil(r.faltaComprar))}
                  <div className="text-[0.65rem] font-medium" style={{ color: "var(--ink-faint)" }}>
                    tiene {fmt(r.comprado)} / usa {fmt(r.cantUd)}·ud
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Desglose por fase */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {FASES.map((f) => {
          const rows = rowsByFase.get(f.key) ?? [];
          const bloqueada = rows.some((r) => r.status === "falta");
          const ajustada = !bloqueada && rows.some((r) => r.status === "justo");
          const estadoLabel = bloqueada ? "Bloqueada" : ajustada ? "Ajustada" : "OK";
          const estadoColor = bloqueada ? "var(--crit)" : ajustada ? "var(--warn)" : "var(--ok)";
          return (
            <div key={f.key} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="num text-sm font-bold" style={{ color: "var(--ink-dim)" }}>{f.n}</span>
                    <h3 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{f.short}</h3>
                  </div>
                  <p className="mt-0.5 text-xs" style={{ color: "var(--ink-faint)" }}>{f.desc}</p>
                </div>
                <span className="chip" style={{ color: estadoColor, borderColor: "var(--border-2)" }}>{estadoLabel}</span>
              </div>

              <div className="mt-3 space-y-1.5">
                {rows.length === 0 && !f.externos && (
                  <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Sin material directo.</p>
                )}
                {rows.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate" style={{ color: "var(--ink)" }}>
                      {r.item.replace(/\s*→.*$/, "")}
                    </span>
                    <span className="num flex items-center gap-2 whitespace-nowrap text-xs" style={{ color: "var(--ink-dim)" }}>
                      <span>{fmt(r.comprado)}/{fmt(r.cantUd)}·ud</span>
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[r.status] }} title={r.status} />
                    </span>
                  </div>
                ))}
                {f.externos?.map((ex) => (
                  <div key={ex.label} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate" style={{ color: "var(--ink-dim)" }}>{ex.label}</span>
                    <span className="chip" style={{ fontSize: "0.62rem" }}>{ex.nota}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs" style={{ color: "var(--ink-faint)" }}>
        🔴 no alcanza ni para 1 unidad · 🟡 alcanza para algunas pero no para las {activas} comandas · 🟢 cubierto.
        “Externos” (cajas 3D, fans, PC) los provee mecánica/software — no salen del BOM.
      </p>
    </div>
  );
}
