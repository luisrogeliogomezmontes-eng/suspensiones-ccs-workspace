// Cliente REST mínimo de Notion (API de data sources, versión 2025-09-03).
// Server-only: usa NOTION_TOKEN. Nunca importar desde componentes client.

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2025-09-03";

function token(): string {
  const t = process.env.NOTION_TOKEN;
  if (!t) throw new Error("Falta NOTION_TOKEN en el entorno.");
  return t;
}

/** Consulta una data source y devuelve TODAS las páginas (paginando). */
export async function queryDataSource(
  dataSourceId: string,
  body: Record<string, unknown> = {},
): Promise<NotionPage[]> {
  const out: NotionPage[] = [];
  let cursor: string | undefined;
  do {
    const res = await fetch(`${NOTION_API}/data_sources/${dataSourceId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token()}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ page_size: 100, ...body, start_cursor: cursor }),
      cache: "no-store",
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Notion ${res.status} en ${dataSourceId}: ${txt.slice(0, 300)}`);
    }
    const json = (await res.json()) as NotionQueryResponse;
    out.push(...json.results);
    cursor = json.has_more ? json.next_cursor ?? undefined : undefined;
  } while (cursor);
  return out;
}

// ── Tipos crudos mínimos de Notion ──────────────────────────────────────────
export type NotionPage = {
  id: string;
  properties: Record<string, NotionProp>;
};
type NotionQueryResponse = {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
};
type NotionProp = Record<string, unknown> & { type: string };

// ── Getters tolerantes (devuelven null/0 si falta) ───────────────────────────
type RichText = { plain_text?: string };

export function pTitle(p: NotionProp | undefined): string {
  const arr = (p?.title as RichText[]) ?? [];
  return arr.map((t) => t.plain_text ?? "").join("").trim();
}
export function pText(p: NotionProp | undefined): string {
  const arr = (p?.rich_text as RichText[]) ?? [];
  return arr.map((t) => t.plain_text ?? "").join("").trim();
}
export function pSelect(p: NotionProp | undefined): string {
  const s = p?.select as { name?: string } | null | undefined;
  return s?.name ?? "";
}
export function pNumber(p: NotionProp | undefined): number {
  const n = p?.number;
  return typeof n === "number" ? n : 0;
}
export function pDateStart(p: NotionProp | undefined): string | null {
  const d = p?.date as { start?: string } | null | undefined;
  return d?.start ?? null;
}
export function pRelationIds(p: NotionProp | undefined): string[] {
  const arr = (p?.relation as { id: string }[]) ?? [];
  return arr.map((r) => r.id);
}
export function pUniqueId(p: NotionProp | undefined): string {
  const u = p?.unique_id as { prefix?: string; number?: number } | undefined;
  if (!u || u.number == null) return "";
  return `${u.prefix ? u.prefix + "-" : ""}${u.number}`;
}
/** Lee el valor numérico de una fórmula o rollup (o número directo). */
export function pComputedNumber(p: NotionProp | undefined): number {
  if (!p) return 0;
  if (p.type === "formula") {
    const f = p.formula as { type: string; number?: number } | undefined;
    return typeof f?.number === "number" ? f.number : 0;
  }
  if (p.type === "rollup") {
    const r = p.rollup as { type: string; number?: number } | undefined;
    return typeof r?.number === "number" ? r.number : 0;
  }
  return pNumber(p);
}
