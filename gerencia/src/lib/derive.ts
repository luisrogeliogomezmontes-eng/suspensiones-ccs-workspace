// Cálculos derivados EN VIVO (client-safe). Todo se recomputa desde `inicio/fin`
// y el reloj del browser (`nowMs`) para que los cronómetros tictaqueen.

import type { Comanda, Etapa } from "./types";

const MS_H = 3_600_000;

export function realH(e: Etapa, nowMs: number): number {
  if (!e.inicio) return 0;
  const start = Date.parse(e.inicio);
  const end = e.fin ? Date.parse(e.fin) : nowMs;
  return Math.max((end - start) / MS_H, 0);
}

export function excedidoH(e: Etapa, nowMs: number): number {
  if (!e.inicio) return 0;
  return Math.max(realH(e, nowMs) - e.estimadoH, 0);
}

export type Tone = "idle" | "running" | "over" | "done-ok" | "done-over";

export function semaforo(e: Etapa, nowMs: number): { label: string; tone: Tone } {
  if (e.estado === "Bloqueado") return { label: "Bloqueado", tone: "over" };
  if (!e.inicio) return { label: "Sin iniciar", tone: "idle" };
  const over = realH(e, nowMs) > e.estimadoH;
  if (e.estado === "Hecho") {
    return over
      ? { label: "Cerró excedido", tone: "done-over" }
      : { label: "Cerró en tiempo", tone: "done-ok" };
  }
  return over
    ? { label: "En curso · excedido", tone: "over" }
    : { label: "En curso · en tiempo", tone: "running" };
}

export type Totals = {
  estTotal: number;
  realTotal: number;
  excedidoTotal: number;
  avancePct: number; // ponderado por horas estimadas
  hechas: number;
  total: number;
  current: Etapa | null; // etapa activa o la próxima pendiente
};

export function totals(c: Comanda, nowMs: number): Totals {
  const estTotal = c.etapas.reduce((a, e) => a + e.estimadoH, 0);
  const estHechas = c.etapas.reduce(
    (a, e) => a + (e.estado === "Hecho" ? e.estimadoH : 0),
    0,
  );
  const realTotal = c.etapas.reduce((a, e) => a + realH(e, nowMs), 0);
  const excedidoTotal = c.etapas.reduce((a, e) => a + excedidoH(e, nowMs), 0);
  const hechas = c.etapas.filter((e) => e.estado === "Hecho").length;

  const current =
    c.etapas.find((e) => e.estado === "En curso") ??
    c.etapas.find((e) => e.estado === "Pendiente" || e.estado === "Bloqueado") ??
    null;

  return {
    estTotal,
    realTotal,
    excedidoTotal,
    avancePct: estTotal > 0 ? Math.round((estHechas / estTotal) * 100) : 0,
    hechas,
    total: c.etapas.length,
    current,
  };
}
