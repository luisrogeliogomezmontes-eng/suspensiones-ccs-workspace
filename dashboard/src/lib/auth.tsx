"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, FORCE_DEMO } from "./supabase/client";

export type Role = "viewer" | "operator" | "admin";

interface AuthState {
  ready: boolean; // ya resolvimos la sesión inicial
  session: Session | null;
  user: User | null;
  role: Role | null;
  isDemo: boolean; // sin backend → auth deshabilitada (dev/demo)
  isOperator: boolean; // puede controlar (operator/admin, o demo)
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = FORCE_DEMO ? null : getSupabase();
  const isDemo = !supabase;

  const [ready, setReady] = useState(isDemo); // en demo ya está listo
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(isDemo ? "admin" : null);

  // Sesión inicial + suscripción a cambios (login/logout/refresh).
  useEffect(() => {
    if (!supabase) return; // demo: sin auth
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  // Rol del usuario (desde profiles) cuando cambia la sesión. Todo en callbacks
  // asíncronos → sincronización legítima con una fuente externa (Supabase).
  useEffect(() => {
    if (!supabase) return; // demo mantiene role="admin"
    let alive = true;
    const p: PromiseLike<Role | null> = session
      ? supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle()
          .then(({ data }) => ((data?.role as Role) ?? "viewer"))
      : Promise.resolve(null);
    p.then((r) => {
      if (alive) setRole(r);
    });
    return () => {
      alive = false;
    };
  }, [supabase, session]);

  const value: AuthState = {
    ready,
    session,
    user: session?.user ?? null,
    role,
    isDemo,
    isOperator: isDemo || role === "operator" || role === "admin",
    signIn: async (email, password) => {
      if (!supabase) return {};
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message };
    },
    signUp: async (email, password) => {
      if (!supabase) return {};
      const { error } = await supabase.auth.signUp({ email, password });
      return { error: error?.message };
    },
    signOut: async () => {
      await supabase?.auth.signOut();
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return c;
}
