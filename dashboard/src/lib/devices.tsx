"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getSupabase, DEFAULT_DEVICE_ID, FORCE_DEMO } from "./supabase/client";
import { useAuth } from "./auth";

// Unidad de la flota tal como la ve el selector (ligero: sin lecturas).
export interface FleetDevice {
  id: string;
  name: string | null;
  fw_version: string | null;
  last_seen: string | null;
}

interface DeviceState {
  devices: FleetDevice[];
  deviceId: string; // unidad actualmente en foco (siempre válido)
  setDeviceId: (id: string) => void;
}

const Ctx = createContext<DeviceState | null>(null);
const LS_KEY = "sc.deviceId";

// Flota simulada para el modo demo (sin backend).
const DEMO_FLEET: FleetDevice[] = [
  {
    id: DEFAULT_DEVICE_ID,
    name: "Centinela 01",
    fw_version: "p1-demo",
    last_seen: new Date().toISOString(),
  },
];

// Unidad por defecto = la de señal más reciente (la que está viva). Así, al
// entrar sin haber elegido, el panel muestra el centinela que está emitiendo.
function pickDefault(list: FleetDevice[]): string | undefined {
  if (!list.length) return undefined;
  const seen = (d: FleetDevice) => (d.last_seen ? Date.parse(d.last_seen) : 0);
  return [...list].sort((a, b) => seen(b) - seen(a))[0].id;
}

export function DeviceProvider({ children }: { children: ReactNode }) {
  const { session, isDemo } = useAuth();
  const supabase = FORCE_DEMO ? null : getSupabase();

  const [devices, setDevices] = useState<FleetDevice[]>(isDemo ? DEMO_FLEET : []);
  // "" = todavía no hay elección persistida → se autoelige la unidad viva.
  const [deviceId, setDeviceIdState] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem(LS_KEY) ?? "";
    } catch {
      return "";
    }
  });

  const setDeviceId = useCallback((id: string) => {
    setDeviceIdState(id);
    try {
      localStorage.setItem(LS_KEY, id);
    } catch {
      /* almacenamiento no disponible */
    }
  }, []);

  // Carga la flota (live: cuando hay sesión; demo: lista fija) y la refresca
  // cada 30 s para mantener fresco el punto online y ver centinelas nuevos.
  // (La tabla `devices` no está en la publicación realtime → sondeo, no push.)
  useEffect(() => {
    if (!supabase || !session) return;
    let alive = true;

    const load = () =>
      supabase
        .from("devices")
        .select("id,name,fw_version,last_seen")
        .order("name", { ascending: true })
        .then(({ data }) => {
          if (!alive || !data) return;
          const list = data as FleetDevice[];
          setDevices(list);
          // Si la unidad en foco no existe (o aún no se eligió), salta a la viva.
          setDeviceIdState((cur) =>
            cur && list.some((d) => d.id === cur) ? cur : pickDefault(list) ?? cur
          );
        });

    load();
    const iv = setInterval(load, 30_000);

    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [supabase, session]);

  return (
    <Ctx.Provider value={{ devices, deviceId: deviceId || DEFAULT_DEVICE_ID, setDeviceId }}>
      {children}
    </Ctx.Provider>
  );
}

// Id de la unidad en foco. Tolerante a falta de provider (fallback al default)
// para no romper pantallas fuera del árbol (p. ej. /login).
export function useDeviceId(): string {
  return useContext(Ctx)?.deviceId ?? DEFAULT_DEVICE_ID;
}

// Flota + selección, para el selector del header.
export function useDeviceList(): DeviceState {
  return (
    useContext(Ctx) ?? {
      devices: [],
      deviceId: DEFAULT_DEVICE_ID,
      setDeviceId: () => {},
    }
  );
}
