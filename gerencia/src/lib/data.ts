import "server-only";
import {
  queryDataSource,
  pTitle,
  pText,
  pSelect,
  pNumber,
  pDateStart,
  pRelationIds,
  pUniqueId,
  pComputedNumber,
  type NotionPage,
} from "./notion";
import type {
  BoardState,
  Comanda,
  Etapa,
  EstadoComanda,
  EstadoEtapa,
  InventarioItem,
} from "./types";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta ${name} en el entorno.`);
  return v;
}

function parseEtapa(pg: NotionPage): { etapa: Etapa; comandaId: string | null } {
  const props = pg.properties;
  return {
    etapa: {
      id: pg.id,
      titulo: pTitle(props["Etapa"]),
      fase: pSelect(props["Fase"]),
      orden: pNumber(props["Orden"]),
      estimadoH: pNumber(props["Estimado (h)"]),
      inicio: pDateStart(props["Inicio"]),
      fin: pDateStart(props["Fin"]),
      estado: (pSelect(props["Estado"]) || "Pendiente") as EstadoEtapa,
    },
    comandaId: pRelationIds(props["Comanda"])[0] ?? null,
  };
}

function parseComanda(pg: NotionPage): Comanda {
  const props = pg.properties;
  return {
    id: pg.id,
    numero: pUniqueId(props["Nº"]),
    titulo: pTitle(props["Comanda"]),
    solicitante: pText(props["Solicitante"]),
    fechaPedido: pDateStart(props["Fecha pedido"]),
    estado: (pSelect(props["Estado"]) || "Pendiente") as EstadoComanda,
    etapas: [],
  };
}

function parseInventario(pg: NotionPage): InventarioItem {
  const props = pg.properties;
  const cantUd = pComputedNumber(props["Cant/ud (A2)"]);
  return {
    id: pg.id,
    componente: pTitle(props["Componente"]),
    categoria: pSelect(props["Categoría"]),
    estado: pSelect(props["Estado"]),
    comprado: pNumber(props["Comprado"]),
    cantUd,
    alcanceUds: pComputedNumber(props["Alcance (uds)"]),
    disponible: pComputedNumber(props["Disponible"]),
    enBom: cantUd > 0,
  };
}

export async function getComandas(): Promise<Comanda[]> {
  const [comandaPages, etapaPages] = await Promise.all([
    queryDataSource(env("NOTION_DS_COMANDAS")),
    queryDataSource(env("NOTION_DS_ETAPAS")),
  ]);

  const comandas = comandaPages.map(parseComanda);
  const byId = new Map(comandas.map((c) => [c.id, c]));

  for (const pg of etapaPages) {
    const { etapa, comandaId } = parseEtapa(pg);
    if (comandaId && byId.has(comandaId)) byId.get(comandaId)!.etapas.push(etapa);
  }
  for (const c of comandas) c.etapas.sort((a, b) => a.orden - b.orden);

  // En curso primero; luego por fecha de pedido descendente.
  const rank: Record<string, number> = {
    "En curso": 0,
    Pendiente: 1,
    "En pausa": 2,
    Hecha: 3,
    Cancelada: 4,
  };
  comandas.sort((a, b) => {
    const r = (rank[a.estado] ?? 9) - (rank[b.estado] ?? 9);
    if (r !== 0) return r;
    return (b.fechaPedido ?? "").localeCompare(a.fechaPedido ?? "");
  });
  return comandas;
}

export async function getInventario(): Promise<InventarioItem[]> {
  const pages = await queryDataSource(env("NOTION_DS_INVENTARIO"));
  return pages
    .map(parseInventario)
    .sort((a, b) => {
      if (a.enBom !== b.enBom) return a.enBom ? -1 : 1; // los del BOM primero
      return a.alcanceUds - b.alcanceUds; // menor alcance arriba (riesgo)
    });
}

export async function getBoardState(): Promise<BoardState> {
  const [comandas, inventario] = await Promise.all([getComandas(), getInventario()]);
  return { comandas, inventario, generatedAt: new Date().toISOString() };
}
