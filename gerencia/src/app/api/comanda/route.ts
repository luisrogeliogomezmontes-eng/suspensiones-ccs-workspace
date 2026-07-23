import { NextResponse } from "next/server";
import { createPage } from "@/lib/notion";
import { FASES } from "@/lib/fases";

export const dynamic = "force-dynamic";

const A2_PROJECT_ID = "3a470cf6-0ef1-81bf-a119-f6bceee868d5";

export async function POST(req: Request) {
  let body: { unidad?: string; solicitante?: string; pin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const { unidad, solicitante, pin } = body;

  if (!process.env.WRITE_PIN || pin !== process.env.WRITE_PIN) {
    return NextResponse.json({ error: "PIN incorrecto" }, { status: 403 });
  }
  if (!unidad || !unidad.trim()) {
    return NextResponse.json({ error: "Falta el nombre de la unidad" }, { status: 400 });
  }
  const dsComandas = process.env.NOTION_DS_COMANDAS;
  const dsEtapas = process.env.NOTION_DS_ETAPAS;
  if (!dsComandas || !dsEtapas) {
    return NextResponse.json({ error: "Faltan IDs de Notion en el entorno" }, { status: 500 });
  }

  const now = new Date().toISOString();
  try {
    const comandaId = await createPage(dsComandas, {
      Comanda: { title: [{ text: { content: unidad.trim() } }] },
      Proyecto: { relation: [{ id: A2_PROJECT_ID }] },
      "Fecha pedido": { date: { start: now } },
      Solicitante: { rich_text: [{ text: { content: (solicitante ?? "").trim() } }] },
      Estado: { select: { name: "Pendiente" } },
    });

    // Genera las 7 etapas (secuencial, para no chocar con el rate-limit de Notion).
    for (const f of FASES) {
      await createPage(dsEtapas, {
        Etapa: { title: [{ text: { content: `${f.n} · ${f.short}` } }] },
        Comanda: { relation: [{ id: comandaId }] },
        Fase: { select: { name: f.key } },
        Orden: { number: f.n },
        "Estimado (h)": { number: f.est },
        Estado: { select: { name: "Pendiente" } },
      });
    }
    return NextResponse.json({ ok: true, id: comandaId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
