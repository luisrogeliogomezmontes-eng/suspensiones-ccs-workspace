"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth";
import { DeviceProvider } from "@/lib/devices";

// Puerta de acceso: con backend real (no demo), exige login para ver cualquier
// pantalla salvo /login. En demo (sin backend) deja pasar (dev/mock).
function AuthGate({ children }: { children: ReactNode }) {
  const { ready, session, isDemo } = useAuth();
  const path = usePathname();
  const router = useRouter();
  const isLogin = path === "/login";

  useEffect(() => {
    if (!ready) return;
    if (!isDemo && !session && !isLogin) router.replace("/login");
    if (session && isLogin) router.replace("/");
  }, [ready, session, isDemo, isLogin, router]);

  if (isLogin) return <>{children}</>;
  if (!ready || (!isDemo && !session)) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-signal" />
      </div>
    );
  }
  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthGate>
        <DeviceProvider>{children}</DeviceProvider>
      </AuthGate>
    </AuthProvider>
  );
}
