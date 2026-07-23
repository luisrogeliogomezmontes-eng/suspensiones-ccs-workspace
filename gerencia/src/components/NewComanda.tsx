"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BomRow } from "@/lib/types";
import { ensurePin } from "./actions";

export function NewComanda({
  suggested,
  bom,
  activas,
}: {
  suggested: string;
  bom: BomRow[];
  activas: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unidad, setUnidad] = useState(suggested);
  const [solicitante, setSolicitante] = useState("Producción");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Preview: con esta unidad extra, ¿qué material faltaría?
  const faltantes = useMemo(() => {
    const need = activas + 1;
    return bom
      .filter((b) => b.cantUd > 0 && b.comprado < b.cantUd * need)
      .map((b) => ({
        item: b.item.replace(/\s*→.*$/, ""),
        falta: Math.max(b.cantUd * need - b.comprado, 0),
      }))
      .sort((a, b) => b.falta - a.falta);
  }, [bom, activas]);

  async function crear() {
    setBusy(true);
    setErr(null);
    const pin = ensurePin();
    if (!pin) {
      setBusy(false);
      setErr("Sin PIN");
      return;
    }
    try {
      const r = await fetch("/api/comanda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unidad, solicitante, pin }),
      });
      const j = (await r.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!r.ok || !j.id) {
        setErr(j.error ?? "Error");
        setBusy(false);
        return;
      }
      router.push(`/comanda/${j.id}`);
    } catch {
      setErr("Sin conexión");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="btn" onClick={() => setOpen(true)} style={{ borderColor: "var(--signal)", color: "var(--signal)" }}>
        + Nueva comanda
      </button>
    );
  }

  return (
    <div className="card p-4" style={{ minWidth: 300 }}>
      <p className="eyebrow">Nueva comanda (1 unidad)</p>
      <label className="mt-2 block text-xs" style={{ color: "var(--ink-dim)" }}>
        Unidad
        <input
          className="mt-1 w-full rounded-lg px-2.5 py-1.5 text-sm"
          style={{ background: "var(--panel-2)", border: "1px solid var(--border-2)", color: "var(--ink)" }}
          value={unidad}
          onChange={(e) => setUnidad(e.target.value)}
        />
      </label>
      <label className="mt-2 block text-xs" style={{ color: "var(--ink-dim)" }}>
        Solicitante
        <input
          className="mt-1 w-full rounded-lg px-2.5 py-1.5 text-sm"
          style={{ background: "var(--panel-2)", border: "1px solid var(--border-2)", color: "var(--ink)" }}
          value={solicitante}
          onChange={(e) => setSolicitante(e.target.value)}
        />
      </label>

      <div className="mt-2.5 rounded-lg px-2.5 py-2 text-xs" style={{ background: "var(--panel-2)" }}>
        {faltantes.length === 0 ? (
          <span style={{ color: "var(--ok)" }}>✓ Hay material para esta unidad</span>
        ) : (
          <>
            <span style={{ color: "var(--serious)" }}>⚠ Faltaría para completarla:</span>
            <div className="num mt-1" style={{ color: "var(--ink-dim)" }}>
              {faltantes.slice(0, 4).map((f) => (
                <div key={f.item}>
                  {f.item} — faltan {Math.ceil(f.falta)}
                </div>
              ))}
              {faltantes.length > 4 && <div>+{faltantes.length - 4} más…</div>}
            </div>
          </>
        )}
      </div>

      {err && <p className="mt-2 text-xs" style={{ color: "var(--crit)" }}>⚠ {err}</p>}

      <div className="mt-3 flex gap-2">
        <button className="btn" onClick={crear} disabled={busy} style={{ borderColor: "var(--signal)", color: "var(--signal)", opacity: busy ? 0.5 : 1 }}>
          {busy ? "Creando…" : "Crear comanda"}
        </button>
        <button className="btn" onClick={() => setOpen(false)} disabled={busy}>
          Cancelar
        </button>
      </div>
      <p className="mt-2 text-[0.65rem]" style={{ color: "var(--ink-faint)" }}>
        Se crean las 7 etapas automáticamente. La disponibilidad se descuenta al contar la comanda.
      </p>
    </div>
  );
}
