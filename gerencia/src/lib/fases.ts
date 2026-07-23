// Las 7 fases de la línea de producción del Centinela (fuente: docs/plan-gerencia-produccion.md §2).
// El `key` debe coincidir EXACTO con las opciones del select "Fase" en Notion.

export type Externo = { label: string; nota: string };

export type FaseDef = {
  n: number;
  key: string;
  short: string;
  est: number; // horas-hombre estimadas
  desc: string; // qué se hace en la fase
  externos?: Externo[]; // insumos que NO están en el BOM (mecánica / software)
};

export const FASES: FaseDef[] = [
  {
    n: 1,
    key: "1 · Armado de prueba",
    short: "Armado",
    est: 1.0,
    desc: "Prueba con jumpers: ESP32, GPS + antena y sensor de temperatura.",
  },
  {
    n: 2,
    key: "2 · Corte de cables",
    short: "Corte",
    est: 0.5,
    desc: "Cortar y doblar cables; dejar cada componente listo para soldar.",
  },
  {
    n: 3,
    key: "3 · Soldadura interna",
    short: "Sold. interna",
    est: 0.5,
    desc: "Soldadura 1 (interna): cables rígidos, cable USB-C y buck.",
  },
  {
    n: 4,
    key: "4 · Soldadura salidas",
    short: "Sold. salidas",
    est: 0.5,
    desc: "Soldadura 2 (salidas): cables jumpers y cable #18 de alimentación.",
  },
  {
    n: 5,
    key: "5 · Ensamblaje",
    short: "Ensamblaje",
    est: 0.5,
    desc: "Incrustar en las cajas 3D, cerrar y termoencoger.",
    externos: [
      { label: "Caja 3D Centinela", nota: "mecánica" },
      { label: "Caja 3D sensor temp", nota: "mecánica" },
    ],
  },
  {
    n: 6,
    key: "6 · Montaje",
    short: "Montaje",
    est: 0.25,
    desc: "Montaje del jack e instalación en la caja/vehículo.",
  },
  {
    n: 7,
    key: "7 · Pruebas finales",
    short: "Pruebas",
    est: 0.1,
    desc: "Pruebas finales con fans y PC (software).",
    externos: [
      { label: "Fans definitivos", nota: "mecánica" },
      { label: "PC + software", nota: "no material propio" },
    ],
  },
];

export const TOTAL_EST = FASES.reduce((a, f) => a + f.est, 0); // 3.35

// Meta del lote inicial de A2 (Centinela / Telemetría) — se fabrican 4 unidades.
export const META_A2 = 4;

export function faseByOrden(orden: number): FaseDef | undefined {
  return FASES.find((f) => f.n === orden);
}
