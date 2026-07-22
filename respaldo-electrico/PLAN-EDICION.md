# Plan — Edición desde la interfaz + imágenes de referencia

> Para: **Giovanni** (lo implementa/ajusta en su propia sesión y cuenta).
> Base actual: [`index.html`](index.html) — herramienta funcional, datos **embebidos y de solo lectura**.
> Pedido de Giovanni: (1) **agregar/editar/borrar** baterías y paneles desde la interfaz;
> (2) subir **imágenes de referencia**; (3) que la página sea **interactiva** (editable), no estática.

---

## 0. La decisión que hay que tomar primero: ¿dónde viven los datos y las fotos?

El archivo actual es un solo HTML que se abre con doble clic. **Un HTML estático no puede
escribirse a sí mismo** → hay que elegir dónde persisten las ediciones. Tres caminos:

| Opción | Persistencia | Compartido | Fotos | Esfuerzo | Cuándo |
|---|---|---|---|---|---|
| **A. Solo `localStorage`** | En ese navegador/PC | ❌ no | base64 embebidas | Bajo | Uso personal de Giovanni |
| **B. `localStorage` + Export/Import JSON** ⭐ | Navegador + archivo `.json` portable | Manual (pasar el JSON) | base64 embebidas | Bajo-medio | **MVP recomendado** |
| **C. Vercel + Supabase** | Nube (BD real) | ✅ live, por link | Supabase Storage | Alto | Producto para todo el equipo |

**Recomendación: hacer B ahora, dejar C para después.** B mantiene la naturaleza "un archivo,
doble clic", permite editar todo desde la UI y **exportar un JSON** que se versiona/commitea o
se pasa a otro. C es el salto a "app compartida" y se justifica solo si varias personas deben
editar y ver lo mismo en vivo.

### ⚠️ Gotcha crítico del link de Artifact (leer antes de decidir)
El **link publicado en claude.ai** corre bajo un **CSP estricto que bloquea toda petición
externa** (fetch, imágenes remotas, Supabase). Consecuencias:
- **Opción C NO funciona dentro del link de artifact** (Supabase quedaría bloqueado). Para C hay
  que **desplegar en Vercel** (como el dashboard de P1), no como artifact.
- El link de artifact es un **snapshot estático**: lo que Giovanni edite ahí con `localStorage`
  **no lo ve el jefe** (localStorage es por-visitante). Para compartir cambios con B: exportar el
  JSON, regenerar y **volver a publicar** el artifact.
- Las **imágenes base64 embebidas SÍ funcionan** en el artifact (van dentro del HTML) — por eso
  en Fase 1 las fotos van en base64, no como URL externa.

**Regla práctica:** local (doble clic) y Vercel = todo funciona. Link de artifact = solo datos
embebidos + base64, sin backend.

---

## Fase 1 — Edición local (sin backend) · MVP

### T1. Convertir `DATA` en un store mutable con persistencia
Hoy `const DATA = {...}` es fijo. Cambiar a: **SEED** (semilla, lo actual) + capa `localStorage`.

```js
const SEED = { inverters:[...], batteries:[...], panels:[] };   // lo que hoy es DATA
const LS_KEY = "matriz-respaldo.v1";
function loadStore(){
  try { const s = JSON.parse(localStorage.getItem(LS_KEY)); if(s && s.batteries) return s; } catch(e){}
  return structuredClone(SEED);
}
function saveStore(){ localStorage.setItem(LS_KEY, JSON.stringify(DATA)); }
let DATA = loadStore();
```
- IDs estables: hoy `_id` = `b0..`, `i0..`. Para nuevos: `crypto.randomUUID()` o `"b"+Date.now()`.
- Botón **"Restaurar original"** → `localStorage.removeItem(LS_KEY); DATA = structuredClone(SEED)`.
- ⚠️ Mantener SEED separado del store: si Giovanni actualiza el código, no se pierden ediciones
  (viven en localStorage), pero un cambio de SEED **no** se refleja si ya hay store guardado →
  documentar el botón "Restaurar" o hacer un merge por `_id` (avanzado, opcional).

### T2. Modo edición (toggle en la barra de controles)
- Botón **"Editar"** que activa `state.edit`. Con `state.edit` activo:
  - En cada tarjeta aparecen íconos **✎ Editar** y **🗑 Borrar** (esquina).
  - Aparece una tarjeta fantasma **"+ Agregar equipo"** al inicio de cada grupo (o un botón
    global "+ Nuevo" que abre el formulario con la pestaña actual).
- Sin modo edición, la vista queda idéntica a hoy (presentable al jefe sin botones).

### T3. Formulario Agregar/Editar (modal)
Un modal reutilizable; los campos se generan según la pestaña activa (`bat` / `inv` / `sol`).

- **Batería:** marca, modelo, kwh (nº), precio (nº o vacío=Cotizar), va, descarga, garantia,
  quimica, ciclos, dim, peso, origen (select Venezuela/China/—), datasheet, **imagen**.
- **Inversor:** marca, modelo/tipo, kw (nº), kva (nº), band (select 1–2/3–4/5–6/10–12), precio,
  vac, vdc, carga_red, pico, transfer, garantia, efic, fase, paralelismo, dim, peso, origen,
  datasheet, **imagen**.
- **Panel (nuevo, ver T8):** marca, modelo, wp (nº), precio, voc, isc, vmp, imp, efic,
  tecnologia, dim, peso, garantia, origen, datasheet, **imagen**.
- Validación mínima: marca y capacidad (kwh/kw/wp) obligatorias; precio numérico o vacío.
- Guardar → si tiene `_id` actualiza, si no crea (`push`) → `saveStore()` → `render()`.
- Para inversores, recalcular `band` desde `kw` si Giovanni prefiere automático (opcional).

### T4. Borrar (con confirmación)
`if(confirm("¿Borrar "+marca+" "+modelo+"?")){ DATA[list] = DATA[list].filter(x=>x._id!==id); saveStore(); render(); }`

### T5. Imágenes de referencia (base64 con compresión) — **lo que pidió Giovanni**
Subir foto desde el formulario (input file o arrastrar), **comprimir en el navegador** y guardar
como data-URI en `item.img`. Comprimir es clave: sin comprimir, 3-4 fotos llenan localStorage.

```js
function compressImage(file, maxPx=760, quality=0.78){
  return new Promise((res,rej)=>{
    const img = new Image();
    img.onload = ()=>{
      const s = Math.min(1, maxPx/Math.max(img.width,img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width*s); c.height = Math.round(img.height*s);
      c.getContext("2d").drawImage(img,0,0,c.width,c.height);
      res(c.toDataURL("image/jpeg", quality));   // ~30-60 KB por foto
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}
```
- Guardar el resultado en `item.img`. Mostrar **miniatura** en la tarjeta (arriba) y en la tabla;
  clic → **lightbox** (overlay a pantalla). Botón "Quitar imagen".
- Validar `file.type.startsWith("image/")` y tamaño de entrada (< ~8 MB).
- Opcional: galería `item.imgs[]` (varias fotos). Empezar con **una** imagen principal.
- ⚠️ EXIF: algunas fotos de celular salen rotadas; si pasa, usar `createImageBitmap(file,{imageOrientation:"from-image"})` antes de dibujar.

### T6. Exportar / Importar JSON (portabilidad y respaldo)
- **Descargar datos**: `Blob([JSON.stringify(DATA,null,1)],{type:"application/json"})` → `<a download="matriz-respaldo.json">`.
- **Cargar datos**: input file → `JSON.parse` → validar forma (`.batteries`,`.inverters`) →
  `DATA = parsed; saveStore(); render()`.
- Este JSON es el que se **commitea al repo** o se pasa a otra persona. Es el "guardar de verdad".

### T7. Render: mostrar la imagen
- En `card()`: si `item.img`, agregar `<img class="thumb" src="${item.img}" loading="lazy">` arriba
  del nombre (o como banda superior de la tarjeta). CSS: `object-fit:cover; height:120px; border-radius`.
- En `tableView()`: columna con miniatura pequeña (32-40px) o ícono 📷 si tiene foto.

### T8. Activar la pestaña Paneles (dejar de ser placeholder)
- `CFG.sol = { list:"panels", unit:"Wp", perU:"$/Wp", perKey:"usd_per_wp", capKey:"wp",
  groupKey:"band", groupLabel:g=>g, mapX:"Potencia (Wp)" }`.
- `usd_per_wp = precio / wp`. Bandas por Wp (ej. 400–550, 550–600…), o agrupar por `wp` redondeado.
- `panels:[]` arranca vacío; se llena desde la UI (T3) cuando lleguen los datasheets.
- Reemplazar `solarPanel()` (el placeholder) por el mismo `cardsView/tableView` cuando haya datos;
  si `panels` está vacío, mostrar un estado vacío "Agrega el primer panel".

---

## Fase 2 — Compartido en la nube (Vercel + Supabase) · opcional, "producto"
Solo si el objetivo es que **varias personas editen y todos vean lo mismo por un link**.
Reutiliza exactamente el stack de P1 (`dashboard/` Next.js + `backend/supabase/`).

- **BD**: tabla `equipos(id, tipo, marca, modelo, specs jsonb, precio, capacidad, img_url, ...)`
  o tres tablas (`baterias`/`inversores`/`paneles`). Migración en `backend/supabase/migrations/`.
- **Fotos**: bucket de **Supabase Storage** `equipos/`; subir con el SDK, guardar la URL pública.
- **Seguridad**: RLS — lectura pública o `authenticated`; escritura solo `authenticated`
  (mismo patrón que el dashboard tras 0007/0008).
- **App**: portar `index.html` a un componente Next.js, `fetch` al cargar, `upsert` al guardar.
- **Deploy**: **Vercel** (NO artifact — el CSP del artifact bloquea Supabase). Link compartible real.
- Esfuerzo: ~1-2 sesiones. Pro: multiusuario, sin exportar/importar. Contra: más piezas.

---

## Mapa de dónde tocar el código (`index.html`)
| Cambio | Sección actual |
|---|---|
| `SEED` + `loadStore/saveStore/DATA` | bloque `const DATA = …` |
| `CFG.sol` real + `usd_per_wp` | objeto `CFG` y el `forEach` de precompute |
| Barra: botones Editar / +Nuevo / Export / Import / Restaurar | `.ctrl` (HTML) + wiring al final |
| Modal de formulario (HTML+CSS+JS) | nuevo bloque; reusar tokens de color existentes |
| `compressImage()` + lightbox | nuevo; CSS de `.thumb`/`#lightbox` |
| `card()` y `tableView()` muestran `img` y botones ✎/🗑 en `state.edit` | funciones `card`, `tableView` |
| Reemplazar `solarPanel()` por vista real con vacío | función `solarPanel` |

---

## Checklist de prueba (Fase 1)
- [ ] Agregar una batería nueva → aparece en su grupo, recalcula $/kWh, barra y "mejor valor".
- [ ] Editar precio de un equipo → se re-rankea el grupo y el mapa de valor.
- [ ] Borrar un equipo → desaparece; el grupo recalcula.
- [ ] Subir foto → miniatura en tarjeta + lightbox; recargar la página → **persiste** (localStorage).
- [ ] Exportar JSON → abrir el archivo, ver los datos + `img` base64.
- [ ] Importar ese JSON en otra PC → se ve igual, con fotos.
- [ ] "Restaurar original" → vuelve a los 15+39 de la semilla.
- [ ] Modo edición **apagado** → vista limpia sin botones (presentable al jefe).
- [ ] Probar en el link de artifact: datos + fotos base64 se ven; recordar que localStorage ahí es local al visitante.

## Estimación
| Tarea | Esfuerzo |
|---|---|
| T1 store + persistencia | S |
| T2 modo edición | S |
| T3 formulario add/edit | M |
| T4 borrar | XS |
| T5 imágenes + compresión + lightbox | M |
| T6 export/import | S |
| T7 render imagen | S |
| T8 pestaña paneles real | S |
| **Fase 1 total** | **~1 sesión** |
| Fase 2 (Vercel+Supabase) | ~1-2 sesiones |
