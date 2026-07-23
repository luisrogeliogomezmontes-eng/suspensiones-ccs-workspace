import { getInventario } from "@/lib/data";
import { InventarioView } from "@/components/InventarioView";
import { ConnectNotice } from "@/components/ConnectNotice";
import type { InventarioItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Page() {
  let inventario: InventarioItem[] | null = null;
  let error: string | null = null;
  try {
    inventario = await getInventario();
  } catch (e) {
    error = (e as Error).message;
  }
  if (error || !inventario) return <ConnectNotice error={error ?? "Sin datos"} />;
  return <InventarioView initial={inventario} />;
}
