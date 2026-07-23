# EMPEZAR AQUÍ — Setup de la Mac del trabajo (para Claude)

> Hola Claude. Luis va a trabajar este proyecto en **dos Macs** que sincronizan por un repo
> privado de GitHub. Esta es la Mac del trabajo. Tu tarea: **clonar el workspace, dejarlo listo
> para trabajar y explicarle a Luis qué falta.** Sigue los pasos en orden.

## 0. Datos
- **Repo (privado):** `https://github.com/luisrogeliogomezmontes-eng/suspensiones-ccs-workspace.git`
- **Cuenta GitHub:** `luisrogeliogomezmontes-eng` (misma en ambas Macs)
- **Identidad git (usar exactamente esta):**
  - `user.name` = `rogelio2904`
  - `user.email` = `luisrogeliogomezmontes@gmail.com`

## 1. Clonar (extraer) el proyecto
```bash
# ubícalo donde Luis quiera trabajar, p.ej. ~/Documents/
git clone https://github.com/luisrogeliogomezmontes-eng/suspensiones-ccs-workspace.git
cd suspensiones-ccs-workspace
git config user.name  "rogelio2904"
git config user.email "luisrogeliogomezmontes@gmail.com"
```
> Si pide login de GitHub: `gh auth login` (o un Personal Access Token con scope `repo`).

## 2. Recrear los SECRETOS (no viajan por git — están git-ignored)
El repo **no** trae credenciales. Hay que crear estos archivos a mano. Pídeselos a Luis
(o él los copia de la otra Mac por AirDrop). Plantillas incluidas en el repo:
```bash
cp firmware/secrets.h.example        firmware/secrets.h          # WiFi + Supabase + DEVICE_TOKEN
cp dashboard/.env.local.example      dashboard/.env.local        # URL + anon key de Supabase
# .env.supabase  → 1 línea: SUPABASE_ACCESS_TOKEN=<token NUEVO ya rotado>
# .env.cs-team-key → solo si vas a tocar la API pública v1
```
⚠️ **Pídele a Luis los valores reales.** Sin `firmware/secrets.h` el firmware no compila con
credenciales; sin `dashboard/.env.local` el dashboard corre en modo demo.

## 3. Ponerte al día (SIEMPRE antes de trabajar)
Lee, en este orden, para saber en qué va el proyecto:
1. `CLAUDE.md` — reglas del workspace y protocolo de inicio/cierre de sesión.
2. `MEMORY.md` — estado vivo (decisiones D1–D36, roadmap, to-do, pinout).
3. `docs/BITACORA.md` — qué se hizo en cada sesión (arriba lo más reciente).

## 4. Flujo de trabajo entre las dos Macs
- **Al empezar:** `git pull`
- **Al terminar:** `git add -A && git commit -m "..." && git push`
- En la otra Mac, Luis hace `git pull` para traer lo que avanzaste.
- Trabajar en simultáneo funciona; solo eviten editar **los mismos archivos** a la vez
  (para no chocar en el merge).

## 5. Pendiente de seguridad (recordárselo a Luis)
🔴 **Rotar el Supabase access token `sbp_...`** — quedó leakeado en la historia del repo
viejo (`suspensiones-esp32-telemetria`). Revocar en
`https://supabase.com/dashboard/account/tokens`, generar uno nuevo y ponerlo en `.env.supabase`
en **ambas** Macs. Este repo (`suspensiones-ccs-workspace`) ya tiene historia limpia, sin el token.

---
*Este repo es el punto de sync personal de Luis (historia limpia). El repo original con colegas
es `suspensiones-esp32-telemetria` — no se toca desde aquí.*
