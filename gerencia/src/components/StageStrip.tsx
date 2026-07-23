import type { Etapa } from "@/lib/types";
import { semaforo } from "@/lib/derive";
import { toneColor } from "./tone";

/** Tira compacta de las 7 etapas, coloreada por estado/tiempo. */
export function StageStrip({ etapas, nowMs }: { etapas: Etapa[]; nowMs: number }) {
  return (
    <div className="flex gap-1">
      {etapas.map((e) => {
        const { tone } = semaforo(e, nowMs);
        const done = e.estado === "Hecho";
        const running = e.estado === "En curso";
        return (
          <div
            key={e.id}
            className="group relative h-1.5 flex-1 overflow-hidden rounded-full"
            style={{ background: "var(--grid)" }}
            title={`${e.fase} · ${semaforo(e, nowMs).label}`}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: done ? "100%" : running ? "55%" : "0%",
                background: toneColor[tone],
                opacity: running ? 0.9 : 1,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
