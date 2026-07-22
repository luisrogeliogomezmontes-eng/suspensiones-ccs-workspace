import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cliente de navegador. Devuelve null si no hay credenciales configuradas
// (modo mock / demo, sin backend). Nunca lanza en tiempo de import.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let cached: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  cached = url && anon ? createClient(url, anon) : null;
  return cached;
}

// ¿Está el dashboard cableado a un backend real?
export const HAS_SUPABASE = Boolean(url && anon);

// Fuerza el modo demo (mock) aunque haya credenciales — útil para diseñar/mostrar
// la UI antes de que existan datos reales. Poner NEXT_PUBLIC_DEMO=0 para ir a live.
export const FORCE_DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

// Dispositivo por defecto que mira el Overview (una unidad en el MVP).
export const DEFAULT_DEVICE_ID =
  process.env.NEXT_PUBLIC_DEVICE_ID ??
  "00000000-0000-0000-0000-000000000001";
