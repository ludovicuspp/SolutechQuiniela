import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hthdeufxzrclpoysqctj.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_ROLE_KEY) process.exit(1)

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log('Creando usuario admin via Auth Admin API...')

  const { data, error } = await supabase.auth.admin.createUser({
    email: 'admin@solutechquiniela.app',
    password: '123456',
    email_confirm: true,
    user_metadata: { nombre: 'Administrador', rif: 'V-00000000' },
  })

  if (error) {
    console.error('createUser error:', error)
    process.exit(1)
  }

  const userId = data.user.id
  console.log('✓ Auth user creado:', userId)

  // Crear public.users
  const { error: uErr } = await supabase.from('users').insert({
    id: userId,
    email: 'admin@solutechquiniela.app',
    nombre: 'Administrador',
    rif: 'V-00000000',
    telefono: '+584246258204',
    is_admin: true,
  })
  if (uErr) { console.error('public.users error:', uErr); process.exit(1) }
  console.log('✓ public.users insertado')

  // Crear wallet
  const { error: wErr } = await supabase.from('wallets').insert({
    user_id: userId,
    balance: 1000,
  })
  if (wErr) { console.error('wallet error:', wErr); process.exit(1) }
  console.log('✓ Wallet creada con 1000 pts')

  console.log('\n✅ Admin listo! Login: 4246258204 / 123456')
}

main()
