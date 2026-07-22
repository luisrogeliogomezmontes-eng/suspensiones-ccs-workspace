-- 0009_api_keys.sql — API pública v1 para terceros (equipo de computación Suspensiones CCS)
--
-- Tabla de API-keys que consume la Edge Function `api-v1`. La key se guarda HASHEADA
-- (sha256 hex), nunca en claro. Solo la Function (service_role) la lee → sin policies,
-- invisible desde anon/authenticated. Aditivo: no toca ninguna tabla existente.
--
-- Nota: el "apriete" de gatear el INSERT de readings por token del device (mencionado
-- en 0008) pasa a 0010 cuando se haga; este 0009 es la tabla de keys de la API.

begin;

create table if not exists public.api_keys (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                          -- a quién se le entregó (ej. 'Computacion CCS')
  key_hash    text not null unique,                   -- sha256(key) en hex; la key en claro nunca se guarda
  device_ids  text[]      not null default array['*'],   -- '*' = toda la flota; o lista de uuids de devices
  scopes      text[]      not null default array['read'],-- 'read' (monitoreo) y/o 'control' (comandos seguros)
  rate_limit  integer     not null default 30,         -- req/min por key
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz                              -- set para revocar sin borrar la fila
);

alter table public.api_keys enable row level security;
-- Sin policies a propósito → ni anon ni authenticated la ven. Solo la Edge Function
-- (service_role, que bypassa RLS) la consulta.

comment on table public.api_keys is
  'Keys de la API pública v1 (Edge Function api-v1). Hash sha256; no exponer; solo service_role.';

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- DESPUÉS de correr esta migración, emitir la key del equipo de computación (la key
-- en claro NO se commitea; se la das a ellos una sola vez). En el SQL editor:
--
--   -- 1) generá una key aleatoria (en tu terminal, NO en la BD):
--   --    openssl rand -hex 24   → ej. 'a1b2c3...'  → la key será 'sk_live_a1b2c3...'
--   -- 2) insertá SOLO su hash (pgcrypto ya está habilitado desde 0001):
--   insert into public.api_keys (name, key_hash, device_ids, scopes, rate_limit)
--   values (
--     'Computacion CCS',
--     encode(digest('sk_live_a1b2c3...', 'sha256'), 'hex'),   -- ← la MISMA key que le das a ellos
--     array['*'],                 -- toda la flota
--     array['read','control'],    -- monitoreo + control seguro
--     30
--   );
--
-- Para revocar:  update public.api_keys set revoked_at = now() where name = 'Computacion CCS';
-- ─────────────────────────────────────────────────────────────────────────────
