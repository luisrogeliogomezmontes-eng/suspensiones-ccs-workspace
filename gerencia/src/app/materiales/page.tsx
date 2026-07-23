import { getBoardState } from "@/lib/data";
import { MaterialesView } from "@/components/MaterialesView";
import { ConnectNotice } from "@/components/ConnectNotice";
import type { BoardState } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Page() {
  let state: BoardState | null = null;
  let error: string | null = null;
  try {
    state = await getBoardState();
  } catch (e) {
    error = (e as Error).message;
  }
  if (error || !state) return <ConnectNotice error={error ?? "Sin datos"} />;
  return <MaterialesView initial={state} />;
}
