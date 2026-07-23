import Link from "next/link";
import { getComandas } from "@/lib/data";
import { ComandaDetail } from "@/components/ComandaDetail";
import { ConnectNotice } from "@/components/ConnectNotice";
import type { Comanda } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let comandas: Comanda[] | null = null;
  let error: string | null = null;
  try {
    comandas = await getComandas();
  } catch (e) {
    error = (e as Error).message;
  }
  if (error || !comandas) return <ConnectNotice error={error ?? "Sin datos"} />;

  const c = comandas.find((x) => x.id === id);
  if (!c) {
    return (
      <div className="card mx-auto mt-10 max-w-md p-6 text-center" style={{ color: "var(--ink-dim)" }}>
        <p className="text-sm">No existe esa comanda (o fue borrada).</p>
        <Link href="/" className="mt-3 inline-block text-sm" style={{ color: "var(--signal)" }}>
          ← Volver a comandas
        </Link>
      </div>
    );
  }
  return <ComandaDetail initial={c} />;
}
