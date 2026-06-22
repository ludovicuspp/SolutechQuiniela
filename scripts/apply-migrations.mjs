// scripts/apply-migrations.mjs
//
// Aplica TODAS las migraciones de supabase/migrations/ en orden cronológico.
// Tres modos soportados:
//
//   1. node scripts/apply-migrations.mjs --bundle FILE
//      → consolida todas las migraciones en un único .sql
//
//   2. node scripts/apply-migrations.mjs
//      → usa DATABASE_URL + pg client (requiere acceso IPv4 a la BD)
//
//   3. SUPABASE_ACCESS_TOKEN=... node scripts/apply-migrations.mjs --management-api
//      → usa la Management API de Supabase (HTTPS, funciona con VPN/IPv6)

import pg from 'pg'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import dns from 'node:dns/promises'

if (existsSync('.env')) {
  const { config } = await import('dotenv')
  config({ path: '.env' })
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations')

const FILES = [
  'prize_winners.sql',
  'security_hardening.sql',
  'add_jugada_columns_to_bets.sql',
  'add_alias_rebranding.sql',
  'add_email_to_register_profile.sql',
  'add_get_email_by_phone.sql',
  'add_get_email_by_rif.sql',
  'add_phone_exists.sql',
  'add_dieciseisavos_fase.sql',
  'fix_batch_upsert_goles.sql',
  'add_penalties_to_matches.sql',
  'admin_recharge_points.sql',
  'admin_void_bet.sql',
  'phase_prizes_cumulative.sql',
  'normalize_phones.sql',
  'schedule_sync_matches.sql',
  'fix_place_bet_canonical.sql',
  'fix_admin_panel_functions.sql',
  'fix_auto_resolve_trigger.sql',
  'admin_resolve_match.sql',
  'fix_admin_history_rpcs.sql',
]

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || ''
const DEFAULT_DB_URL = ''
let connectionString = process.env.DATABASE_URL || DEFAULT_DB_URL
let useManagementApi = process.argv.includes('--management-api')

// ── Parser SQL: respeta bloques $$ ... $$ ──
function splitSql(sql) {
  const statements = []
  let current = ''
  let inDollar = false
  for (let i = 0; i < sql.length; i++) {
    if (sql[i] === '$' && sql[i + 1] === '$') {
      inDollar = !inDollar
      current += '$$'
      i++
      continue
    }
    if (sql[i] === ';' && !inDollar) {
      const stmt = current.trim()
      if (stmt && !stmt.startsWith('--')) statements.push(stmt)
      current = ''
      continue
    }
    current += sql[i]
  }
  const tail = current.trim()
  if (tail) statements.push(tail)
  return statements
}

async function ensureReachable() {
  const m = connectionString.match(/@([^:/]+):(\d+)/)
  if (!m) return
  const host = m[1]
  const port = Number(m[2])
  let resolved
  try { resolved = await dns.resolve4(host) }
  catch {
    try {
      const aaaa = await dns.resolve6(host)
      resolved = aaaa
      const ipv6 = aaaa[0]
      connectionString = connectionString.replace(`@${host}:`, `@[${ipv6}]:`)
      console.log(`  ⚠  ${host} solo resuelve a IPv6 → usando [${ipv6}]`)
    } catch { throw new Error(`No se pudo resolver ${host}`) }
  }
  console.log(`  → ${host} → ${resolved[0]} (puerto ${port})`)
}

// ── Modo 1: Management API ──
async function applyViaManagementApi(filename) {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN
  if (!accessToken) throw new Error('SUPABASE_ACCESS_TOKEN no definida')

  const sql = readFileSync(join(MIGRATIONS_DIR, filename), 'utf8')
  console.log(`\n── ${filename}  (vía Management API, 1 request)`)

  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })

  if (!res.ok) {
    const text = await res.text()
    // La Management API solo ejecuta la query como un todo; cualquier error
    // en un statement aborta los siguientes. La mayoría de statements usan
    // IF EXISTS / OR REPLACE así que es parcialmente idempotente.
    console.error(`  ✗ ERROR HTTP ${res.status}`)
    console.error(`    ${text.substring(0, 500)}`)
    return { ok: 0, skipped: 0, errors: 1, fatal: true }
  }
  const data = await res.json()
  console.log(`  ✓ OK`)
  return { ok: 1, skipped: 0, errors: 0 }
}

// ── Modo 2: pg client directo ──
async function applyViaPg(filename) {
  const sql = readFileSync(join(MIGRATIONS_DIR, filename), 'utf8')
  const statements = splitSql(sql)
  console.log(`\n── ${filename}  (${statements.length} statements)`)

  let ok = 0, skipped = 0, errors = 0
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    const preview = stmt.substring(0, 70).replace(/\n/g, ' ')
    try {
      await client.query(stmt)
      console.log(`  [${i + 1}/${statements.length}] OK    ${preview}...`)
      ok++
    } catch (err) {
      const msg = err.message || String(err)
      if (msg.includes('already exists') || msg.includes('does not exist') ||
          msg.includes('duplicate key') || msg.includes('cannot drop') ||
          msg.includes('permission denied')) {
        console.log(`  [${i + 1}/${statements.length}] SKIP  ${preview}...`)
        skipped++
      } else {
        console.error(`  [${i + 1}/${statements.length}] ERROR ${preview}...`)
        console.error(`    → ${msg}`)
        errors++
      }
    }
  }
  return { ok, skipped, errors }
}

let client

async function run() {
  // ── Modo bundle ──
  const bundleIdx = process.argv.indexOf('--bundle')
  if (bundleIdx !== -1) {
    const out = process.argv[bundleIdx + 1] || 'migrations-bundle.sql'
    const outPath = join(__dirname, '..', out)

    // --only "a.sql,b.sql" filtra a esos archivos
    const onlyIdx = process.argv.indexOf('--only')
    const onlyList = onlyIdx !== -1
      ? process.argv[onlyIdx + 1].split(',').map(s => s.trim())
      : null
    const filesToBundle = onlyList
      ? FILES.filter(f => onlyList.includes(f))
      : FILES

    const bundle = filesToBundle.map(f =>
      `-- ════════════════════════════════════════════════════════════════════\n` +
      `--  ${f}\n` +
      `-- ════════════════════════════════════════════════════════════════════\n` +
      readFileSync(join(MIGRATIONS_DIR, f), 'utf8')
    ).join('\n\n')
    writeFileSync(outPath, bundle)
    console.log(`✓ Bundle escrito: ${outPath}  (${filesToBundle.length} archivos, ${bundle.length} chars)`)
    if (onlyList) console.log(`  (filtrado por --only: ${onlyList.join(', ')})`)
    return
  }

  if (useManagementApi) {
    console.log('Modo: Supabase Management API')
    console.log('Project:', PROJECT_REF)
    const accessToken = process.env.SUPABASE_ACCESS_TOKEN
    if (!accessToken) {
      console.error('❌ Define SUPABASE_ACCESS_TOKEN (Personal Access Token de https://supabase.com/dashboard/account/tokens)')
      process.exit(1)
    }
    console.log('Token:', accessToken.substring(0, 12) + '...\n')

    // Verificar token con un SELECT
    const test = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: "select current_user, current_database()" }),
    })
    if (!test.ok) {
      const t = await test.text()
      console.error('❌ Token inválido o sin permisos. Respuesta:', t.substring(0, 300))
      process.exit(1)
    }
    const testData = await test.json()
    console.log('Conectado ✓  user=' + testData[0]?.current_user + '  db=' + testData[0]?.current_database + '\n')

    const summary = []
    for (const file of FILES) {
      summary.push({ file, ...(await applyViaManagementApi(file)) })
    }

    console.log('\n── Resumen ──')
    for (const r of summary) {
      console.log(`  ${r.file.padEnd(40)}  OK=${r.ok}  ERR=${r.errors}`)
    }
    const totalErr = summary.reduce((s, r) => s + r.errors, 0)
    console.log(`\n${totalErr === 0 ? '✅ Todas las migraciones aplicadas' : `⚠️  ${totalErr} archivos con error`}`)
    process.exit(totalErr === 0 ? 0 : 1)
  }

  // ── Modo pg directo ──
  console.log('Connecting to', connectionString.replace(/:[^:@]+@/, ':***@'))
  await ensureReachable()
  client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })
  await client.connect()
  console.log('Connected ✓\n')

  const { rows } = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('users','wallets','bets','matches','prizes','notifications','verification_codes')
    ORDER BY table_name
  `)
  const tablas = rows.map(r => r.table_name)
  console.log('Tablas detectadas en public:', tablas.join(', '))
  if (!tablas.includes('users') || !tablas.includes('matches')) {
    throw new Error('❌ schema.sql NO está aplicado. Ejecuta primero: node scripts/setup-db.mjs')
  }
  console.log('✓ schema.sql verificado\n')

  const summary = []
  for (const file of FILES) {
    summary.push({ file, ...(await applyViaPg(file)) })
  }

  // ── Verificación post-migración ──
  console.log('\n── Verificación post-migración ──')
  const checks = [
    { name: 'RPC phone_exists',         sql: `SELECT 1 FROM pg_proc WHERE proname='phone_exists' AND pronamespace='public'::regnamespace` },
    { name: 'RPC email_exists',         sql: `SELECT 1 FROM pg_proc WHERE proname='email_exists' AND pronamespace='public'::regnamespace` },
    { name: 'RPC get_email_by_phone',   sql: `SELECT 1 FROM pg_proc WHERE proname='get_email_by_phone' AND pronamespace='public'::regnamespace` },
    { name: 'RPC get_email_by_rif',    sql: `SELECT 1 FROM pg_proc WHERE proname='get_email_by_rif' AND pronamespace='public'::regnamespace` },
    { name: 'RPC rif_exists',           sql: `SELECT 1 FROM pg_proc WHERE proname='rif_exists' AND pronamespace='public'::regnamespace` },
    { name: 'RPC is_admin',             sql: `SELECT 1 FROM pg_proc WHERE proname='is_admin' AND pronamespace='public'::regnamespace` },
    { name: 'RPC get_bet_multiplier',   sql: `SELECT 1 FROM pg_proc WHERE proname='get_bet_multiplier' AND pronamespace='public'::regnamespace` },
    { name: 'RPC get_phase_ranking',    sql: `SELECT 1 FROM pg_proc WHERE proname='get_phase_ranking' AND pronamespace='public'::regnamespace` },
    { name: 'RPC assign_phase_prizes',  sql: `SELECT 1 FROM pg_proc WHERE proname='assign_phase_prizes' AND pronamespace='public'::regnamespace` },
    { name: 'Columna users.email',      sql: `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='email'` },
    { name: 'Columna users.alias',      sql: `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='alias'` },
    { name: 'Columna bets.tipo_jugada', sql: `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bets' AND column_name='tipo_jugada'` },
    { name: 'UNIQUE bets(user,match)',  sql: `SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='bets' AND indexname='uniq_bet_user_match'` },
    { name: 'Time-lock en place_bet',   sql: `SELECT prosrc FROM pg_proc WHERE proname='place_bet' AND pronamespace='public'::regnamespace`, isTimeLock: true },
  ]
  for (const c of checks) {
    try {
      const { rows: r } = await client.query(c.sql)
      if (c.isTimeLock) {
        const src = r[0]?.prosrc || ''
        const ok = src.includes('ventana_cierre') && src.includes('ventana_inicio')
        console.log(`  ${ok ? '✓' : '✗'} ${c.name}`)
      } else {
        console.log(`  ${r.length > 0 ? '✓' : '✗'} ${c.name}`)
      }
    } catch (err) {
      console.log(`  ✗ ${c.name} — ${err.message}`)
    }
  }

  console.log('\n── Resumen ──')
  for (const r of summary) {
    console.log(`  ${r.file.padEnd(40)}  OK=${r.ok}  SKIP=${r.skipped}  ERR=${r.errors}`)
  }
  const totalErr = summary.reduce((s, r) => s + r.errors, 0)
  console.log(`\n${totalErr === 0 ? '✅ Todas las migraciones aplicadas' : `⚠️  ${totalErr} statements con error`}`)

  await client.end()
  process.exit(totalErr === 0 ? 0 : 1)
}

run().catch(err => {
  console.error('\n❌ Fatal:', err.message)
  if (err.code) console.error(`  código: ${err.code}`)
  process.exit(1)
})

