"use client";
import { useEffect, useState } from "react";
import type { BoardState, InventarioItem } from "@/lib/types";
import { META_A2 } from "@/lib/fases";

function alcanceTone(n: number): { color: string; bg: string } {
  if (n <= 0) return { color: "var(--crit)", bg: "color-mix(in srgb, var(--crit) 14%, transparent)" };
  if (n < META_A2) return { color: "var(--warn)", bg: "color-mix(in srgb, var(--warn) 14%, transparent)" };
  return { color: "var(--ok)", bg: "color-mix(in srgb, var(--ok) 14%, transparent)" };
}

function Badge({ n }: { n: number }) {
  const t = alcanceTone(n);
  return (
    <span
      className="num inline-flex items-center rounded-md px-2 py-0.5 text-sm font-bold"
      style={{ color: t.color, background: t.bg }}
    >
      {n}
      <span className="ml-1 text-[0.65rem] font-medium opacity-80">uds</span>
    </span>
  );
}

export function InventarioView({ initial }: { initial: InventarioItem[] }) {
  const [items, setItems] = useState<InventarioItem[]>(initial);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const r = await fetch("/api/state", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as BoardState;
        if (alive && j.inventario) setItems(j.inventario);
      } catch {}
    }
    const id = setInterval(tick, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const bom = items.filter((i) => i.enBom);
  const faltan = bom.filter((i) => i.alcanceUds < META_A2).length;
  const sinStock = bom.filter((i) => i.alcanceUds <= 0).length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--font-saira)", color: "var(--ink)" }}>
            Disponibilidad de inventario
          </h1>
          <p className="mt-0.5 text-xs" style={{ color: "var(--ink-faint)" }}>
            para cuántos Centinela alcanza lo comprado · meta del lote: {META_A2} unidades
          </p>
        </div>
        <div className="flex gap-2">
          <div className="card px-4 py-2.5">
            <div className="num text-xl font-bold" style={{ color: "var(--ink)" }}>{bom.length}</div>
            <div className="eyebrow mt-0.5">Del BOM</div>
          </div>
          <div className="card px-4 py-2.5">
            <div className="num text-xl font-bold" style={{ color: faltan > 0 ? "var(--warn)" : "var(--ok)" }}>{faltan}</div>
            <div className="eyebrow mt-0.5">No cubren {META_A2}</div>
          </div>
          <div className="card px-4 py-2.5">
            <div className="num text-xl font-bold" style={{ color: sinStock > 0 ? "var(--crit)" : "var(--ok)" }}>{sinStock}</div>
            <div className="eyebrow mt-0.5">Sin stock</div>
          </div>
        </div>
      </div>

      <div className="card mt-5 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr style={{ color: "var(--ink-faint)" }} className="text-left">
              <th className="px-4 py-2.5 font-semibold">Componente</th>
              <th className="px-3 py-2.5 font-semibold">Categoría</th>
              <th className="px-3 py-2.5 text-right font-semibold">Comprado</th>
              <th className="px-3 py-2.5 text-right font-semibold">Usa/ud</th>
              <th className="px-3 py-2.5 text-right font-semibold">Alcanza para</th>
              <th className="px-4 py-2.5 text-right font-semibold">Sobra/falta (lote {META_A2})</th>
            </tr>
          </thead>
          <tbody>
            {bom.map((i) => (
              <tr key={i.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="px-4 py-2.5 font-medium" style={{ color: "var(--ink)" }}>{i.componente}</td>
                <td className="px-3 py-2.5" style={{ color: "var(--ink-dim)" }}>{i.categoria || "—"}</td>
                <td className="num px-3 py-2.5 text-right" style={{ color: "var(--ink)" }}>{i.comprado}</td>
                <td className="num px-3 py-2.5 text-right" style={{ color: "var(--ink-dim)" }}>{i.cantUd}</td>
                <td className="px-3 py-2.5 text-right"><Badge n={i.alcanceUds} /></td>
                <td
                  className="num px-4 py-2.5 text-right"
                  style={{ color: i.disponible < 0 ? "var(--crit)" : "var(--ink)" }}
                  title={i.disponible < 0 ? `Faltan ${Math.abs(i.disponible)} para el lote de ${META_A2}` : undefined}
                >
                  {i.disponible > 0 ? `+${i.disponible}` : i.disponible}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs" style={{ color: "var(--ink-faint)" }}>
        “Alcanza para” = piso(comprado ÷ cantidad por unidad). “Sobra/falta” = comprado − lo reservado
        para las {META_A2} unidades del lote (rojo = falta comprar). El <b>descuento automático por comanda</b>
        (que baja el stock al crear un pedido) llega en la Fase 3.
      </p>
    </div>
  );
}
