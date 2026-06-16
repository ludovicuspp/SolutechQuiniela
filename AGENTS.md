# SolutechQuiniela

PWA de quiniela interna para empleados de Solutech · FIFA World Cup 2026.

React 19 + Vite 8 + Tailwind v4 + Supabase.

## Comandos

```bash
npm run dev       # Dev server
npm run build     # Production build (PWA-ready)
npm run lint      # ESLint
npm run preview   # Preview production build
npm run test      # Vitest
```

## Setup inicial

```bash
# Aplicar schema + migraciones a Supabase (Management API):
SUPABASE_PROJECT_REF=<ref> SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-migrations.mjs --management-api

# O bien via conexión directa a la BD:
DATABASE_URL=postgresql://... node scripts/setup-db.mjs
node scripts/apply-migrations.mjs
```

## Tech stack

- React 19, Vite 8, Tailwind v4 (plugin `@tailwindcss/vite`)
- Supabase (auth, Postgres, RLS)
- Zustand (estado), Framer Motion (animación), React Router v7
- `react-hot-toast` para notificaciones
- PWA: `vite-plugin-pwa` (auto-update, service worker, instalable)

## Variables de entorno

```
VITE_SUPABASE_URL=https://hthdeufxzrclpoysqctj.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> `VITE_FOOTBALL_API_KEY` ya **no va** en el bundle — la key vive como secret del Edge Function `sync-matches` en Supabase.

## Arquitectura

- `src/lib/supabase.js` — cliente Supabase
- `src/store/` — stores Zustand (auth, match, bet, admin, notification, theme)
- `scripts/apply-migrations.mjs` — aplica migraciones pendientes
- `supabase/config.toml` — config del proyecto Supabase CLI
- `supabase/functions/sync-matches/index.ts` — Edge Function (sync server-side cada 1 min via pg_cron)
- `supabase/migrations/schedule_sync_matches.sql` — schedule del cron

## Sync de partidos (Edge Function)

El sync ya no se hace desde el cliente. Flujo actual:

```
pg_cron (cada 1 min)
  → cron_sync_matches() [SQL wrapper]
    → net.http_post → Edge Function sync-matches
      → API-Football /fixtures + /standings
        → batch_upsert_matches RPC
```

**Secrets requeridos en Supabase Vault:**
- `sync_matches_function_url` → `https://<ref>.supabase.co/functions/v1/sync-matches`
- `supabase_service_role_key` → la service role key del proyecto

**Deploy del Edge Function:**
```bash
supabase login
supabase link --project-ref <ref>
supabase secrets set FOOTBALL_API_KEY=<key>
supabase functions deploy sync-matches
# luego aplicar la migración de cron:
SUPABASE_PROJECT_REF=<ref> SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-migrations.mjs --management-api
```

## Reglas de negocio

- **Solo el administrador crea usuarios** desde el panel Admin (no hay auto-registro)
- **Saldo inicial**: 1000 pts por defecto al crear empleado
- **Puntos**: solo crecen por premios de apuestas ganadas
- Cada empleado se identifica con su **Cédula** (campo `rif` en la BD)

## API-Football

- League: 1 (FIFA World Cup), Season: 2026
- Llamadas directas server-side (Edge Function) — ya no expuesto al cliente
-Grupos (A–L) resueltos cruzando con `/standings` dentro de la Edge Function

## Pendiente

1. **AdminPage: input de penales** — el RPC `admin_set_penalties` ya existe en la BD y el formulario está en la pestaña Sincronizar. Falta verificar que el resolvedor de apuestas use los campos `penales_local/penales_visitante` aliquidar.
