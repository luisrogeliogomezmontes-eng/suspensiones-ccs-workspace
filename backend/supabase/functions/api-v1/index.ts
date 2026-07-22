// API pública v1 — Suspensiones Caracas · Edge Function (Deno + Hono)
// ───────────────────────────────────────────────────────────────────────────
// Monitoreo + control SEGURO de las unidades Centinela, para terceros (equipo de
// computación) vía API-key. Contrato: docs/api/CONTRATO-v1.md · Spec: docs/api/openapi-v1.yaml
//
// Seguridad (OWASP): deny-by-default, scope por unidad y por acción, RFC 9457,
// rate limiting. power_cycle/reboot BLOQUEADOS a nivel de API. service_role solo por dentro.
//
// Modo MOCK: `MOCK=1 deno run --allow-net --allow-env index.ts` → datos en memoria,
// sin Supabase (para probar con curl o dar un mock al equipo). Key de prueba: sk_test_demo
//
// Deploy real: supabase functions deploy api-v1   (usa SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)

import { Hono } from "npm:hono@4";
import { cors } from "npm:hono@4/cors";
import { z } from "npm:zod@3";

const MOCK = Deno.env.get("MOCK") === "1";

// ── Tipos ────────────────────────────────────────────────────────────────
interface ApiKeyRow {
  id: string;
  name: string;
  device_ids: string[];
  scopes: string[];
  rate_limit: number;
}
interface Db {
  findKey(hash: string): Promise<ApiKeyRow | null>;
  listDevices(ids: string[]): Promise<Record<string, unknown>[]>;
  getDevice(id: string): Promise<Record<string, unknown> | null>;
  latest(id: string): Promise<Record<string, unknown> | null>;
  telemetry(id: string, q: TelemetryQ): Promise<Record<string, unknown>[]>;
  events(id: string, q: EventsQ): Promise<Record<string, unknown>[]>;
  commands(id: string, q: CommandsQ): Promise<Record<string, unknown>[]>;
  insertCommand(id: string, type: string, payload: unknown): Promise<Record<string, unknown>>;
  updateThresholds(id: string, t: Thresholds): Promise<Record<string, unknown>>;
}
type TelemetryQ = { from?: string; to?: string; limit: number; order: "asc" | "desc" };
type EventsQ = { since?: string; severity?: string; limit: number };
type CommandsQ = { limit: number; status?: "pending" | "applied" };
type Thresholds = { warn: number; serious: number; crit: number };

// ── Helpers ──────────────────────────────────────────────────────────────
async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// deno-lint-ignore no-explicit-any
function problem(c: any, status: number, title: string, detail: string, type = "about:blank") {
  const body = {
    type, title, status, detail,
    instance: new URL(c.req.url).pathname,
    timestamp: new Date().toISOString(),
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/problem+json" },
  });
}

function statusFrom(lastSeen: string | null): "online" | "stale" | "offline" {
  if (!lastSeen) return "offline";
  const age = Date.now() - new Date(lastSeen).getTime();
  if (age <= 30_000) return "online";
  if (age <= 300_000) return "stale";
  return "offline";
}

const SEV_RANK: Record<string, number> = { info: 0, warning: 1, serious: 2, critical: 3 };
const READING_COLS =
  "ts,temp_c,temp_points,fan_on,fan_duty,fan_rpm,lat,lng,alt,speed_kmph,course,sats,hdop,rssi,uptime_s,heap_free,batt_soc,power_w,link_obstruction,link_down_mbps";
const DEVICE_COLS = "id,name,fw_version,temp_warn,temp_serious,temp_crit,last_seen";

// deno-lint-ignore no-explicit-any
function deviceOut(r: any) {
  return {
    id: r.id, name: r.name, fw_version: r.fw_version ?? null,
    thresholds: { warn: r.temp_warn, serious: r.temp_serious, crit: r.temp_crit },
    last_seen: r.last_seen ?? null,
    status: statusFrom(r.last_seen ?? null),
  };
}
// deno-lint-ignore no-explicit-any
function commandOut(r: any) {
  return {
    id: r.id, ts: r.ts, type: r.type, payload: r.payload,
    status: r.ack_ts ? "applied" : "pending",
    applied_at: r.ack_ts ?? null,
  };
}
function idsAll(ids: string[]): boolean {
  return ids.includes("*");
}

// ── Capa de datos: Supabase real o MOCK en memoria ───────────────────────
let db: Db;

if (MOCK) {
  const DEV: Record<string, unknown> = {
    id: "00000000-0000-0000-0000-000000000001", name: "Centinela 01", fw_version: "p1-dev",
    temp_warn: 33, temp_serious: 40, temp_crit: 46, last_seen: new Date().toISOString(),
  };
  const now = Date.now();
  const readings = Array.from({ length: 20 }, (_, i) => ({
    ts: new Date(now - (19 - i) * 5000).toISOString(),
    temp_c: Math.round((28 + Math.random() * 3) * 10) / 10, temp_points: null,
    fan_on: true, fan_duty: 55, fan_rpm: 2200,
    lat: 10.5007, lng: -66.8556, alt: 900, speed_kmph: 0, course: 0, sats: 8, hdop: 1.4,
    rssi: -63, uptime_s: 3600, heap_free: 120000,
    batt_soc: null, power_w: null, link_obstruction: null, link_down_mbps: null,
  }));
  const events = [{ id: 1, ts: new Date(now - 60000).toISOString(), kind: "over_temp", severity: "serious", message: "Temp 41.2°C ≥ 40°C" }];
  // deno-lint-ignore no-explicit-any
  const commands: any[] = [];
  let keyRows: ApiKeyRow[] = [];
  const TEST_KEY = "sk_test_demo";
  db = {
    async findKey(hash) {
      if (!keyRows.length) {
        keyRows = [{ id: "mock-key", name: "MOCK", key_hash: await sha256hex(TEST_KEY), device_ids: ["*"], scopes: ["read", "control"], rate_limit: 240 } as ApiKeyRow & { key_hash: string }];
      }
      // deno-lint-ignore no-explicit-any
      return (keyRows as any[]).find((k) => k.key_hash === hash) ?? null;
    },
    // deno-lint-ignore require-await
    async listDevices(ids) { return (idsAll(ids) || ids.includes(DEV.id as string)) ? [DEV] : []; },
    // deno-lint-ignore require-await
    async getDevice(id) { return id === DEV.id ? DEV : null; },
    // deno-lint-ignore require-await
    async latest(id) { return id === DEV.id ? readings[readings.length - 1] : null; },
    // deno-lint-ignore require-await
    async telemetry(id, q) {
      if (id !== DEV.id) return [];
      let rows = [...readings];
      if (q.from) rows = rows.filter((r) => r.ts >= q.from!);
      if (q.to) rows = rows.filter((r) => r.ts <= q.to!);
      if (q.order === "desc") rows.reverse();
      return rows.slice(0, q.limit);
    },
    // deno-lint-ignore require-await
    async events(id, q) {
      if (id !== DEV.id) return [];
      let rows = [...events];
      if (q.severity) rows = rows.filter((e) => SEV_RANK[e.severity] >= SEV_RANK[q.severity!]);
      return rows.slice(0, q.limit);
    },
    // deno-lint-ignore require-await
    async commands(id, q) {
      if (id !== DEV.id) return [];
      let rows = [...commands].reverse();
      if (q.status === "pending") rows = rows.filter((r) => !r.ack_ts);
      if (q.status === "applied") rows = rows.filter((r) => r.ack_ts);
      return rows.slice(0, q.limit);
    },
    // deno-lint-ignore require-await
    async insertCommand(_id, type, payload) {
      const row = { id: crypto.randomUUID(), ts: new Date().toISOString(), type, payload, ack_ts: null };
      commands.push(row);
      return row;
    },
    // deno-lint-ignore require-await
    async updateThresholds(_id, t) {
      DEV.temp_warn = t.warn; DEV.temp_serious = t.serious; DEV.temp_crit = t.crit;
      return DEV;
    },
  };
} else {
  const { createClient } = await import("npm:@supabase/supabase-js@2");
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  db = {
    async findKey(hash) {
      const { data } = await sb.from("api_keys")
        .select("id,name,device_ids,scopes,rate_limit")
        .eq("key_hash", hash).is("revoked_at", null).maybeSingle();
      return (data as ApiKeyRow) ?? null;
    },
    async listDevices(ids) {
      let q = sb.from("devices").select(DEVICE_COLS);
      if (!idsAll(ids)) q = q.in("id", ids);
      const { data } = await q;
      return data ?? [];
    },
    async getDevice(id) {
      const { data } = await sb.from("devices").select(DEVICE_COLS).eq("id", id).maybeSingle();
      return data ?? null;
    },
    async latest(id) {
      const { data } = await sb.from("readings").select(READING_COLS)
        .eq("device_id", id).order("ts", { ascending: false }).limit(1).maybeSingle();
      return data ?? null;
    },
    async telemetry(id, q) {
      let query = sb.from("readings").select(READING_COLS).eq("device_id", id);
      if (q.from) query = query.gte("ts", q.from);
      if (q.to) query = query.lte("ts", q.to);
      const { data } = await query.order("ts", { ascending: q.order !== "desc" }).limit(q.limit);
      return data ?? [];
    },
    async events(id, q) {
      let query = sb.from("events").select("id,ts,kind,severity,message").eq("device_id", id);
      if (q.since) query = query.gte("ts", q.since);
      const { data } = await query.order("ts", { ascending: false }).limit(q.limit);
      let rows = data ?? [];
      // deno-lint-ignore no-explicit-any
      if (q.severity) rows = rows.filter((e: any) => SEV_RANK[e.severity] >= SEV_RANK[q.severity!]);
      return rows;
    },
    async commands(id, q) {
      let query = sb.from("commands").select("id,ts,type,payload,ack_ts").eq("device_id", id);
      if (q.status === "pending") query = query.is("ack_ts", null);
      if (q.status === "applied") query = query.not("ack_ts", "is", null);
      const { data } = await query.order("ts", { ascending: false }).limit(q.limit);
      return data ?? [];
    },
    async insertCommand(id, type, payload) {
      const { data, error } = await sb.from("commands")
        .insert({ device_id: id, type, payload }).select("id,ts,type,payload,ack_ts").single();
      if (error) throw error;
      return data;
    },
    async updateThresholds(id, t) {
      const { data, error } = await sb.from("devices")
        .update({ temp_warn: t.warn, temp_serious: t.serious, temp_crit: t.crit })
        .eq("id", id).select(DEVICE_COLS).single();
      if (error) throw error;
      return data;
    },
  };
}

// ── App ──────────────────────────────────────────────────────────────────
const app = new Hono<{ Variables: { key: ApiKeyRow } }>().basePath("/api-v1");

app.use("*", cors({
  origin: "*",
  allowHeaders: ["x-api-key", "content-type"],
  allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
}));

// Raíz pública (sin key): puntero amigable.
app.get("/", (c) => c.json({
  name: "API Suspensiones Caracas", version: "v1",
  auth: "header X-API-Key", docs: "docs/api/CONTRATO-v1.md",
}));

// ── Rate limiting (ventana deslizante en memoria; aproximado por instancia) ──
const hits = new Map<string, number[]>();
function rateLimited(id: string, limit: number): boolean {
  const now = Date.now();
  const arr = (hits.get(id) ?? []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(id, arr);
  return arr.length > limit;
}

// ── Auth deny-by-default para todo /devices/* ────────────────────────────
app.use("/devices/*", async (c, next) => {
  const key = c.req.header("x-api-key");
  if (!key) return problem(c, 401, "Falta la API-key", "Incluí el header X-API-Key.", "https://api.suspensiones/errors/unauthorized");
  const row = await db.findKey(await sha256hex(key));
  if (!row) return problem(c, 401, "API-key inválida", "La key no existe o fue revocada.", "https://api.suspensiones/errors/unauthorized");
  if (rateLimited(row.id, row.rate_limit)) {
    return new Response(JSON.stringify({
      type: "https://api.suspensiones/errors/rate-limit", title: "Límite de uso excedido",
      status: 429, detail: `Máximo ${row.rate_limit} req/min. Reintentá en unos segundos.`,
      instance: new URL(c.req.url).pathname, timestamp: new Date().toISOString(),
    }), { status: 429, headers: { "content-type": "application/problem+json", "retry-after": "5" } });
  }
  c.set("key", row);
  await next();
});

// deno-lint-ignore no-explicit-any
function guard(c: any, scope: string, id: string): Response | null {
  const k = c.get("key") as ApiKeyRow;
  if (!k.scopes.includes(scope)) return problem(c, 403, "Sin permiso", `Tu key no tiene el scope '${scope}'.`, "https://api.suspensiones/errors/forbidden");
  if (!(idsAll(k.device_ids) || k.device_ids.includes(id))) return problem(c, 403, "Unidad fuera de scope", `Tu key no tiene acceso a la unidad ${id}.`, "https://api.suspensiones/errors/forbidden");
  return null;
}
// deno-lint-ignore no-explicit-any
function badParams(c: any, err: z.ZodError) {
  return problem(c, 400, "Parámetros inválidos", err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), "https://api.suspensiones/errors/validation");
}

// ── Monitoreo (scope read) ───────────────────────────────────────────────
app.get("/devices", async (c) => {
  const k = c.get("key");
  if (!k.scopes.includes("read")) return problem(c, 403, "Sin permiso", "Tu key no tiene el scope 'read'.", "https://api.suspensiones/errors/forbidden");
  const rows = await db.listDevices(k.device_ids);
  return c.json({ devices: rows.map(deviceOut) });
});

app.get("/devices/:id", async (c) => {
  const id = c.req.param("id");
  const g = guard(c, "read", id); if (g) return g;
  const row = await db.getDevice(id);
  if (!row) return problem(c, 404, "Unidad no encontrada", `No existe la unidad ${id}.`, "https://api.suspensiones/errors/not-found");
  return c.json(deviceOut(row));
});

app.get("/devices/:id/latest", async (c) => {
  const id = c.req.param("id");
  const g = guard(c, "read", id); if (g) return g;
  const r = await db.latest(id);
  return c.json({ device_id: id, status: statusFrom((r?.ts as string) ?? null), reading: r ?? null });
});

app.get("/devices/:id/telemetry", async (c) => {
  const id = c.req.param("id");
  const g = guard(c, "read", id); if (g) return g;
  const Q = z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(5000).default(500),
    order: z.enum(["asc", "desc"]).default("asc"),
  });
  const p = Q.safeParse({ from: c.req.query("from"), to: c.req.query("to"), limit: c.req.query("limit"), order: c.req.query("order") });
  if (!p.success) return badParams(c, p.error);
  const rows = await db.telemetry(id, p.data);
  return c.json({ device_id: id, count: rows.length, from: p.data.from ?? null, to: p.data.to ?? null, readings: rows });
});

app.get("/devices/:id/events", async (c) => {
  const id = c.req.param("id");
  const g = guard(c, "read", id); if (g) return g;
  const Q = z.object({
    since: z.string().datetime().optional(),
    severity: z.enum(["info", "warning", "serious", "critical"]).optional(),
    limit: z.coerce.number().int().min(1).max(1000).default(100),
  });
  const p = Q.safeParse({ since: c.req.query("since"), severity: c.req.query("severity"), limit: c.req.query("limit") });
  if (!p.success) return badParams(c, p.error);
  const rows = await db.events(id, p.data);
  return c.json({ events: rows });
});

app.get("/devices/:id/commands", async (c) => {
  const id = c.req.param("id");
  const g = guard(c, "read", id); if (g) return g;
  const Q = z.object({
    limit: z.coerce.number().int().min(1).max(200).default(20),
    status: z.enum(["pending", "applied"]).optional(),
  });
  const p = Q.safeParse({ limit: c.req.query("limit"), status: c.req.query("status") });
  if (!p.success) return badParams(c, p.error);
  const rows = await db.commands(id, p.data);
  return c.json({ commands: rows.map(commandOut) });
});

// ── Control seguro (scope control) ───────────────────────────────────────
const CommandReq = z.discriminatedUnion("type", [
  z.object({ type: z.literal("fan_mode"), payload: z.object({ mode: z.enum(["auto", "on", "off"]) }) }),
  z.object({ type: z.literal("setpoint"), payload: z.object({ on: z.number(), off: z.number() }) }),
]);

app.post("/devices/:id/commands", async (c) => {
  const id = c.req.param("id");
  const g = guard(c, "control", id); if (g) return g;
  // deno-lint-ignore no-explicit-any
  let body: any;
  try { body = await c.req.json(); } catch { return problem(c, 400, "JSON inválido", "El body no es JSON válido.", "https://api.suspensiones/errors/validation"); }
  if (body?.type === "power_cycle" || body?.type === "reboot") {
    return problem(c, 403, "Acción no disponible en v1", `'${body.type}' no se expone vía API por seguridad. Queda en el panel del dueño.`, "https://api.suspensiones/errors/action-not-available");
  }
  const p = CommandReq.safeParse(body);
  if (!p.success) return problem(c, 400, "Comando inválido", p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), "https://api.suspensiones/errors/validation");
  if (p.data.type === "setpoint" && p.data.payload.off >= p.data.payload.on) {
    return problem(c, 422, "Setpoint inválido", "payload.off debe ser menor que payload.on.", "https://api.suspensiones/errors/unprocessable");
  }
  const row = await db.insertCommand(id, p.data.type, p.data.payload);
  return c.json(commandOut(row), 202);
});

app.patch("/devices/:id/config", async (c) => {
  const id = c.req.param("id");
  const g = guard(c, "control", id); if (g) return g;
  // deno-lint-ignore no-explicit-any
  let body: any;
  try { body = await c.req.json(); } catch { return problem(c, 400, "JSON inválido", "El body no es JSON válido.", "https://api.suspensiones/errors/validation"); }
  const Cfg = z.object({ thresholds: z.object({ warn: z.number(), serious: z.number(), crit: z.number() }) });
  const p = Cfg.safeParse(body);
  if (!p.success) return problem(c, 400, "Config inválida", p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), "https://api.suspensiones/errors/validation");
  const t = p.data.thresholds;
  if (!(t.warn < t.serious && t.serious < t.crit)) {
    return problem(c, 422, "Umbrales inválidos", "Debe cumplirse warn < serious < crit.", "https://api.suspensiones/errors/unprocessable");
  }
  const dev = await db.updateThresholds(id, t);
  return c.json(deviceOut(dev));
});

Deno.serve(app.fetch);
