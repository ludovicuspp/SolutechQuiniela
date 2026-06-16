import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hthdeufxzrclpoysqctj.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) { console.error('❌ Define SUPABASE_SERVICE_ROLE_KEY=...'); process.exit(1) }

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  // Intentar crear el admin via el RPC existente
  const { data, error } = await supabase.rpc('public_admin_create_user', {
    p_email: 'admin@solutechquiniela.app',
    p_password: '123456',
    p_rif: 'V-00000000',
    p_nombre: 'Administrador',
    p_telefono: '+584246258204',
    p_zona: null,
    p_vendedor: null,
    p_empresa: 'Solutech',
    p_puntos: 1000,
    p_is_admin: true,
  })

  if (error) {
    console.error('RPC error:', error)
    process.exit(1)
  }

  console.log('✓ Admin creado/actualizado via RPC. ID:', data)
}

main()
