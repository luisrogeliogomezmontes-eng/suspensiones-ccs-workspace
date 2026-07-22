"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";

export default function Login() {
  const { signIn, signUp, isDemo } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } =
      mode === "in" ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (error) setMsg(error);
    else if (mode === "up")
      setMsg("Cuenta creada. Si el proyecto pide confirmación por email, revisá tu correo; si no, ya podés entrar.");
    // En éxito de login, onAuthStateChange redirige al Overview (AuthGate).
  };

  return (
    <div className="grid min-h-screen place-items-center bg-bg p-4">
      <div className="w-full max-w-sm rounded-xl border border-line bg-panel/80 p-6 shadow-lg backdrop-blur-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-md border border-line font-display text-sm font-bold text-signal">
            SC
          </div>
          <div className="leading-tight">
            <h1 className="font-display text-lg font-bold tracking-wide text-ink">
              Suspensiones · Telemetría
            </h1>
            <p className="font-mono text-[11px] text-ink-faint">
              {mode === "in" ? "Iniciá sesión para continuar" : "Creá tu cuenta"}
            </p>
          </div>
        </div>

        {isDemo ? (
          <p className="rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-ink-dim">
            Modo demostración: el acceso está abierto, no hace falta iniciar sesión.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="eyebrow mb-1 block text-[10px]">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-line bg-panel-2 px-3 py-2 text-sm text-ink outline-none focus:border-signal"
              />
            </div>
            <div>
              <label className="eyebrow mb-1 block text-[10px]">Contraseña</label>
              <input
                type="password"
                required
                autoComplete={mode === "in" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-line bg-panel-2 px-3 py-2 text-sm text-ink outline-none focus:border-signal"
              />
            </div>

            {msg && (
              <p className="rounded-md border border-line bg-panel-2 px-3 py-2 text-xs text-ink-dim">
                {msg}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-signal py-2.5 font-display text-sm font-bold text-black transition-opacity disabled:opacity-50"
            >
              {busy ? "…" : mode === "in" ? "Entrar" : "Crear cuenta"}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode((m) => (m === "in" ? "up" : "in"));
                setMsg(null);
              }}
              className="w-full text-center font-mono text-[11px] text-ink-faint hover:text-ink"
            >
              {mode === "in"
                ? "¿No tenés cuenta? Registrate"
                : "¿Ya tenés cuenta? Iniciá sesión"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
