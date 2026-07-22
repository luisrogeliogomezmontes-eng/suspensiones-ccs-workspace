"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Panel } from "@/components/ui/Panel";
import { useAuth, type Role } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase/client";
import { hhmm } from "@/lib/format";

interface Profile {
  id: string;
  email: string | null;
  role: Role;
  created_at: string;
}

const ROLES: Role[] = ["viewer", "operator", "admin"];

export default function Usuarios() {
  const { role, user, isDemo } = useAuth();
  const supabase = getSupabase();
  const isAdmin = isDemo || role === "admin";

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !isAdmin) return;
    let alive = true;
    supabase
      .from("profiles")
      .select("id,email,role,created_at")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!alive) return;
        setProfiles((data as Profile[]) ?? []);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [supabase, isAdmin]);

  const changeRole = async (id: string, next: Role) => {
    if (!supabase) return;
    const prev = profiles;
    setProfiles((ps) => ps.map((p) => (p.id === id ? { ...p, role: next } : p)));
    setMsg(null);
    const { error } = await supabase.from("profiles").update({ role: next }).eq("id", id);
    if (error) {
      setProfiles(prev); // revertir
      setMsg(`Error: ${error.message}`);
    } else {
      setMsg("Rol actualizado ✓");
    }
  };

  return (
    <div className="min-h-full">
      <AppHeader />
      <main className="mx-auto max-w-[900px] space-y-4 p-4 sm:p-6">
        {!isAdmin ? (
          <div className="rounded-md border border-warn/40 bg-warn/10 px-4 py-2.5 text-sm text-ink-dim">
            Solo un <b className="text-ink">admin</b> puede gestionar usuarios.
          </div>
        ) : (
          <>
            <div className="rounded-md border border-line bg-panel-2/60 px-4 py-3 text-sm text-ink-dim">
              Los nuevos usuarios se registran solos en <b className="text-ink">/login</b> (rol
              inicial <b className="text-ink">viewer</b>); acá les asignás el rol. Crear una cuenta
              por alguien más (con su clave, sin que se registre) requiere una Edge Function
              (service_role) — pendiente si lo necesitás.
            </div>

            {msg && (
              <div className="rounded-md border border-line bg-panel-2 px-4 py-2 text-sm text-ink">
                {msg}
              </div>
            )}

            <Panel title="Usuarios">
              {loading ? (
                <p className="text-sm text-ink-faint">Cargando…</p>
              ) : profiles.length === 0 ? (
                <p className="text-sm text-ink-faint">Sin usuarios todavía.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-line">
                  <table className="w-full text-sm">
                    <thead className="bg-panel-2 text-ink-dim">
                      <tr>
                        <th className="px-3 py-2 text-left font-mono text-[11px] uppercase">Email</th>
                        <th className="px-3 py-2 text-left font-mono text-[11px] uppercase">Alta</th>
                        <th className="px-3 py-2 text-left font-mono text-[11px] uppercase">Rol</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profiles.map((p) => {
                        const self = p.id === user?.id;
                        return (
                          <tr key={p.id} className="border-t border-line/60">
                            <td className="px-3 py-2 text-ink">
                              {p.email ?? "—"}
                              {self && <span className="ml-1 text-[11px] text-ink-faint">(vos)</span>}
                            </td>
                            <td className="px-3 py-2 font-mono text-[11px] text-ink-faint">
                              {hhmm(p.created_at)}
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={p.role}
                                onChange={(e) => changeRole(p.id, e.target.value as Role)}
                                className="rounded-md border border-line bg-panel-2 px-2 py-1 font-mono text-xs text-ink outline-none focus:border-signal"
                              >
                                {ROLES.map((r) => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </>
        )}
      </main>
    </div>
  );
}
