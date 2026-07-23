import { NextResponse } from "next/server";
import { updatePage } from "@/lib/notion";

export const dynamic = "force-dynamic";

type Action = "empezar" | "terminar" | "reabrir" | "bloquear" | "reiniciar";

// Construye las propiedades de Notion (formato REST) para cada acción.
function propsFor(action: Action, nowISO: string): Record<string, unknown> | null {
  switch (action) {
    case "empezar":
      return { Estado: { select: { name: "En curso" } }, Inicio: { date: { start: nowISO } }, Fin: { date: null } };
    case "terminar":
      return { Estado: { select: { name: "Hecho" } }, Fin: { date: { start: nowISO } } };
    case "reabrir":
      return { Estado: { select: { name: "En curso" } }, Fin: { date: null } };
    case "bloquear":
      return { Estado: { select: { name: "Bloqueado" } } };
    case "reiniciar":
      return { Estado: { select: { name: "Pendiente" } }, Inicio: { date: null }, Fin: { date: null } };
    default:
      return null;
  }
}

export async function POST(req: Request) {
  let body: { id?: string; action?: Action; pin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const { id, action, pin } = body;

  if (!process.env.WRITE_PIN || pin !== process.env.WRITE_PIN) {
    return NextResponse.json({ error: "PIN incorrecto" }, { status: 403 });
  }
  if (!id || !action) {
    return NextResponse.json({ error: "Falta id o acción" }, { status: 400 });
  }
  const props = propsFor(action, new Date().toISOString());
  if (!props) return NextResponse.json({ error: "Acción inválida" }, { status: 400 });

  try {
    await updatePage(id, props);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
