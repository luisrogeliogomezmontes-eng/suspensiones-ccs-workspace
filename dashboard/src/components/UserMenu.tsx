"use client";

import { useAuth } from "@/lib/auth";

// Muestra el rol y permite cerrar sesión. En demo (sin backend) solo indica el
// estado, sin acciones de cuenta.
export function UserMenu() {
  const { role, user, isDemo, signOut } = useAuth();
  const label = isDemo ? "demo" : role ?? "…";

  return (
    <div className="flex items-center gap-2">
      <span
        className="rounded-md border border-line px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-dim"
        title={user?.email ?? (isDemo ? "modo demo" : "")}
      >
        {label}
      </span>
      {!isDemo && (
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded-md border border-line px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-dim transition-colors hover:border-crit hover:text-crit"
        >
          salir
        </button>
      )}
    </div>
  );
}
