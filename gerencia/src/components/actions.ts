"use client";

const PIN_KEY = "gerencia_pin";

export function getPin(): string | null {
  try {
    return localStorage.getItem(PIN_KEY);
  } catch {
    return null;
  }
}
function setPin(v: string) {
  try {
    localStorage.setItem(PIN_KEY, v);
  } catch {}
}
function clearPin() {
  try {
    localStorage.removeItem(PIN_KEY);
  } catch {}
}

/** Pide el PIN (guardado en localStorage) o lo solicita una vez. */
export function ensurePin(): string | null {
  let p = getPin();
  if (!p) {
    p = window.prompt("PIN para editar (acciones de producción):");
    if (p) setPin(p.trim());
  }
  return p;
}

export type ActionResult = { ok: boolean; error?: string };

/** Llama a la API de escritura de etapas. Si el PIN falla, lo borra para re-pedirlo. */
export async function etapaAction(id: string, action: string): Promise<ActionResult> {
  const pin = ensurePin();
  if (!pin) return { ok: false, error: "Sin PIN" };
  try {
    const r = await fetch("/api/etapa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, pin }),
    });
    if (r.status === 403) {
      clearPin();
      return { ok: false, error: "PIN incorrecto" };
    }
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) return { ok: false, error: j.error ?? "Error" };
    return { ok: true };
  } catch {
    return { ok: false, error: "Sin conexión" };
  }
}
