// scripts/execute_bulk_insert.mjs
// Ejecuta la inserción masiva de empleados vía Supabase REST API (RPC).
// Lee personas del pasley.json y llama public_admin_create_user para cada uno.
// Uso: node scripts/execute_bulk_insert.mjs

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY requeridos en .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const JSON_FILE = join(__dirname, '..', 'personas del pasley.json');
const raw = JSON.parse(readFileSync(JSON_FILE, 'utf8'));
const colaboradores = raw.colaboradores || [];

const PASSWORD = '12345678';
const EMPRESA = 'Solutech';
const PUNTOS = 1000;

let ok = 0, skipped = 0, errors = 0;

for (const item of colaboradores) {
  const name = (item.colaborador ?? '').trim();
  const ci = (item.ci ?? '').toString().trim().replace(/[,.\s]/g, '');

  if (!ci || ci === 'nan' || !/^\d+$/.test(ci)) {
    console.warn(`  ⚠ Ignorado: "${name}" → CI="${item.ci}"`);
    skipped++;
    continue;
  }

  const nombre = name === name.toUpperCase()
    ? name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
    : name;

  const rif = `V${ci}`;
  const email = `${ci}@solutechquiniela.app`;

  const { data, error } = await supabase.rpc('public_admin_create_user', {
    p_email: email,
    p_password: PASSWORD,
    p_rif: rif,
    p_nombre: nombre,
    p_telefono: '',
    p_zona: '',
    p_vendedor: '',
    p_empresa: EMPRESA,
    p_puntos: PUNTOS,
    p_is_admin: false,
  });

  if (error) {
    const msg = error.message || String(error);
    if (msg.includes('already exists') || msg.includes('duplicate key') || msg.includes('unique') || msg.includes('23505')) {
      console.log(`  ~ SKIP  ${nombre} (${rif}) — ya existe`);
      skipped++;
    } else {
      console.error(`  ✗ ERROR ${nombre} (${rif}): ${msg.substring(0, 120)}`);
      errors++;
    }
  } else {
    console.log(`  ✓ OK    ${nombre} (${rif})`);
    ok++;
  }
}

console.log(`\n═══ Resumen ═══`);
console.log(`  ✓ Insertados: ${ok}`);
console.log(`  ~ Omitidos:   ${skipped}`);
console.log(`  ✗ Errores:    ${errors}`);
console.log(`═══ ${errors === 0 ? '✅ Completado' : '⚠️  Con errores'} ═══`);
process.exit(errors === 0 ? 0 : 1);
