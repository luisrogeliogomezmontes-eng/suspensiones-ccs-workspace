# Matriz de Respaldo Eléctrico

Comparador de **inversores** y **baterías** por capacidad y **costo-beneficio**
($/kW y $/kWh), para el departamento de eléctrica. Toma la información de los
datasheets y la concentra en una sola vista clara y escalable.

## Cómo usarla
Abre **`index.html`** con doble clic (cualquier navegador). No necesita internet,
servidor ni instalación — todo va dentro del archivo.

- **Pestañas:** Baterías · Inversores · Paneles solares (reservado, próxima etapa).
- **Agrupación:** baterías por capacidad (kWh); inversores en bandas **1–2 / 3–4 /
  5–6 / 10–12 kW·kVA** (como pidió Giovanni).
- **Costo-beneficio:** cada equipo muestra su **$/kWh** (baterías) o **$/kW**
  (inversores). El más económico de cada grupo se marca en verde como *Mejor valor*.
  Barra más corta = mejor relación.
- **Mapa de valor:** dispersión capacidad × $/unidad (abajo = mejor) para ver de un
  vistazo dónde está el valor.
- **Filtros:** búsqueda, marca, origen, orden, "solo con precio".
- **Vista Tabla:** comparación densa y ordenable por cualquier columna.

## Cómo añadir equipos (escalar)
Abre `index.html` en un editor de texto y agrega un objeto al arreglo
`DATA.batteries` o `DATA.inverters` (bloque `<script>`, arriba). Hay una
**PLANTILLA** comentada con los campos. La agrupación, el ranking y las barras se
recalculan solos. Precio en USD, o `null` si hay que cotizar.

## Datos y notas
- Fuente: datasheets recopilados por el departamento — CSV originales en
  [`fuentes/`](fuentes/).
- **Origen** (Venezuela/China) viene de la leyenda de la hoja; solo aplica a las
  marcas listadas ahí, el resto queda como «sin dato».
- Precios `Cotizar` = no venían en la matriz original.
- 15 inversores · 39 baterías al momento de armarla.

## Link publicado
Snapshot compartible (privado hasta que se comparta desde el menú de la página):
`https://claude.ai/code/artifact/ec0513f5-4358-4ac3-9235-1f41b93c5092`

## Próximos pasos
- **Edición desde la interfaz + imágenes** (pedido de Giovanni): plan detallado en
  [`PLAN-EDICION.md`](PLAN-EDICION.md) — agregar/editar/borrar equipos y subir fotos,
  con persistencia. Giovanni lo implementa/ajusta en su sesión.
- **Módulo de paneles solares**: misma estructura, agrupación por potencia pico (Wp) y
  métrica **$/Wp** (Voc, Isc, Vmp, Imp, eficiencia, tecnología, garantía).
