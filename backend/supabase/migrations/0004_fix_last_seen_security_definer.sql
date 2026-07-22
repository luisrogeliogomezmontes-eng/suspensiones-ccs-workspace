-- 0004_fix_last_seen_security_definer.sql — Arreglar devices.last_seen
--
-- BUG: el trigger touch_device_last_seen() corría con los privilegios del
-- invocador (rol `anon`, que inserta la telemetría). `anon` NO tiene política
-- UPDATE sobre `devices` (RLS), así que el UPDATE del trigger se bloqueaba en
-- silencio y `last_seen` nunca avanzaba (quedó congelado pese a lecturas nuevas).
--
-- FIX: SECURITY DEFINER → la función corre con los privilegios de su dueño y
-- bypassa la RLS solo para ese UPDATE acotado. `search_path` fijado por higiene.

begin;

create or replace function public.touch_device_last_seen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.devices
     set last_seen = greatest(coalesce(last_seen, 'epoch'::timestamptz), new.ts)
   where id = new.device_id;
  return new;
end $$;

-- Realinear con la última lectura ya existente (una vez).
update public.devices d
   set last_seen = sub.max_ts
  from (select device_id, max(ts) as max_ts from public.readings group by device_id) sub
 where d.id = sub.device_id
   and (d.last_seen is null or d.last_seen < sub.max_ts);

commit;
