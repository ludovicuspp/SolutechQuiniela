import pg from 'pg'

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:0E7fGenR9mjM4zXt@db.slnhwbuoyiowlppzrlkq.supabase.co:5432/postgres'
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })

async function run() {
  await client.connect()

  // 1. Ver el teléfono tal como está guardado en public.users
  console.log('=== Búsqueda en public.users por teléfono 4246828939 ===')
  const variants = [
    '+584246828939',
    '584246828939',
    '04246828939',
    '4246828939',
  ]
  for (const v of variants) {
    const res = await client.query(
      `select pu.id, pu.nombre, pu.telefono, au.email
       from public.users pu
       join auth.users   au on au.id = pu.id
       where regexp_replace(pu.telefono, '\D', '', 'g') = regexp_replace($1, '\D', '', 'g')`,
      [v]
    )
    console.log(`  '${v}' →`, res.rows.length ? res.rows[0] : 'no match')
  }

  // 2. Probar el RPC tal cual lo llama la app
  console.log('\n=== RPC get_email_by_phone(+584246828939) ===')
  const rpc1 = await client.query(`select public.get_email_by_phone('+584246828939') as email`)
  console.log('  Resultado:', rpc1.rows[0].email)

  console.log('\n=== RPC get_email_by_phone(4246828939) ===')
  const rpc2 = await client.query(`select public.get_email_by_phone('4246828939') as email`)
  console.log('  Resultado:', rpc2.rows[0].email)

  console.log('\n=== RPC get_email_by_phone(04246828939) ===')
  const rpc3 = await client.query(`select public.get_email_by_phone('04246828939') as email`)
  console.log('  Resultado:', rpc3.rows[0].email)

  // 3. Listar todos los usuarios con su email y teléfono (solo diagnóstico)
  console.log('\n=== Todos los usuarios con su email/teléfono ===')
  const all = await client.query(
    `select pu.rif, pu.nombre, pu.telefono, au.email, au.created_at
     from public.users pu
     join auth.users   au on au.id = pu.id
     order by au.created_at desc
     limit 20`
  )
  all.rows.forEach(r => console.log(`  ${r.telefono} | ${r.email} | ${r.nombre}`))

  await client.end()
}

run().catch(err => { console.error(err); process.exit(1) })
