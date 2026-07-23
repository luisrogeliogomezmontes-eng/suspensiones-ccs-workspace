export type EstadoEtapa = "Pendiente" | "En curso" | "Hecho" | "Bloqueado";
export type EstadoComanda =
  | "Pendiente"
  | "En curso"
  | "En pausa"
  | "Hecha"
  | "Cancelada";

export type Etapa = {
  id: string;
  titulo: string;
  fase: string; // "3 · Soldadura interna"
  orden: number;
  estimadoH: number;
  inicio: string | null; // ISO
  fin: string | null; // ISO
  estado: EstadoEtapa;
};

export type Comanda = {
  id: string;
  numero: string; // "CMD-1"
  titulo: string;
  solicitante: string;
  fechaPedido: string | null; // ISO
  estado: EstadoComanda;
  notas: string;
  etapas: Etapa[];
};

export type InventarioItem = {
  id: string;
  componente: string;
  categoria: string;
  estado: string;
  comprado: number;
  cantUd: number; // Cant/ud (A2) — cuántas lleva 1 Centinela
  alcanceUds: number; // Alcance (uds) — para cuántos centinelas alcanza lo comprado
  disponible: number; // Comprado − Asignado
  enBom: boolean; // cantUd > 0
};

export type BomRow = {
  id: string;
  item: string; // "Jumpers → Centinela"
  cantUd: number; // cantidad por unidad
  fases: string[]; // etapas donde se usa
  comprado: number; // total comprado (rollup desde inventario)
  faltante: number; // faltante para el lote
  alcance: number; // para cuántas unidades alcanza lo comprado
};

export type BoardState = {
  comandas: Comanda[];
  inventario: InventarioItem[];
  bom: BomRow[];
  generatedAt: string; // ISO
};
