import type { Tone } from "@/lib/derive";
import type { EstadoComanda } from "@/lib/types";

export const toneColor: Record<Tone, string> = {
  idle: "var(--ink-faint)",
  running: "var(--signal)",
  over: "var(--crit)",
  "done-ok": "var(--ok)",
  "done-over": "var(--serious)",
};

export const comandaEstadoColor: Record<EstadoComanda, string> = {
  Pendiente: "var(--ink-faint)",
  "En curso": "var(--signal)",
  "En pausa": "var(--warn)",
  Hecha: "var(--ok)",
  Cancelada: "var(--crit)",
};
