// Las 7 fases de la línea de producción del Centinela (fuente: docs/plan-gerencia-produccion.md §2).
// El `key` debe coincidir EXACTO con las opciones del select "Fase" en Notion.

export type FaseDef = {
  n: number;
  key: string;
  short: string;
  est: number; // horas-hombre estimadas
};

export const FASES: FaseDef[] = [
  { n: 1, key: "1 · Armado de prueba", short: "Armado", est: 1.0 },
  { n: 2, key: "2 · Corte de cables", short: "Corte", est: 0.5 },
  { n: 3, key: "3 · Soldadura interna", short: "Sold. interna", est: 0.5 },
  { n: 4, key: "4 · Soldadura salidas", short: "Sold. salidas", est: 0.5 },
  { n: 5, key: "5 · Ensamblaje", short: "Ensamblaje", est: 0.5 },
  { n: 6, key: "6 · Montaje", short: "Montaje", est: 0.25 },
  { n: 7, key: "7 · Pruebas finales", short: "Pruebas", est: 0.1 },
];

export const TOTAL_EST = FASES.reduce((a, f) => a + f.est, 0); // 3.35

// Meta del lote inicial de A2 (Centinela / Telemetría) — se fabrican 4 unidades.
export const META_A2 = 4;

export function faseByOrden(orden: number): FaseDef | undefined {
  return FASES.find((f) => f.n === orden);
}
