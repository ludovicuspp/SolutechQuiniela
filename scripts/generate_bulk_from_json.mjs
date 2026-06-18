// scripts/generate_bulk_from_json.mjs
// Lee personas del pasley.json y genera SQL para inserción masiva.
// Uso: node scripts/generate_bulk_from_json.mjs

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const JSON_FILE = join(__dirname, '..', 'personas del pasley.json');
const PASSWORD = '12345678';
const EMPRESA = 'Solutech';
const PUNTOS = 1000;

const raw = JSON.parse(readFileSync(JSON_FILE, 'utf8'));
const colaboradores = raw.colaboradores || [];

const seenCI = new Set();
const duplicates = [];
const users = [];

for (const item of colaboradores) {
  const name = (item.colaborador ?? '').trim();
  const ci = (item.ci ?? '').toString().trim().replace(/[,.\s]/g, '');

  if (!name && !ci) continue;
  if (!ci || ci === 'nan' || !/^\d+$/.test(ci)) {
    console.warn(`  ⚠ Ignorado: "${name}" → CI="${item.ci}"`);
    continue;
  }

  if (seenCI.has(ci)) {
    duplicates.push({ name, ci });
    console.warn(`  ⚠ Duplicado en JSON: "${name}" → CI ${ci}`);
    continue;
  }
  seenCI.add(ci);

  const nombre = name === name.toUpperCase()
    ? name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
    : name;

  users.push({ name: nombre, ci });
}

console.log(`\n✅ Empleados válidos en JSON: ${users.length}`);
if (duplicates.length > 0) {
  console.warn(`⚠ Duplicados internos ignorados: ${duplicates.length}`);
}

const calls = users.map(u => {
  const rif = `V${u.ci}`;
  const email = `${u.ci}@solutechquiniela.app`;
  const nombre = u.name.replace(/'/g, "''");
  return `  perform public_admin_create_user('${email}', '${PASSWORD}', '${rif}', '${nombre}', '', '', '', '${EMPRESA}', ${PUNTOS}, false);`;
}).join('\n');

const sql = `-- ============================================================
-- Bulk insert: ${users.length} empleados
-- Generado desde personas del pasley.json
-- ============================================================

do $$
begin
${calls}
end;
$$;

-- Verificación
select rif, nombre, empresa, is_admin, created_at
from public.users
where rif in (${users.map(u => `'V${u.ci}'`).join(', ')})
order by created_at;
`;

const OUT_FILE = join(__dirname, '..', 'supabase', 'migrations', 'bulk_insert_employees.sql');
writeFileSync(OUT_FILE, sql, 'utf8');
console.log(`\n📄 SQL generado: ${OUT_FILE}`);
console.log(`   Empleados válidos: ${users.length}`);
console.log(`\n➡️  Copiá el contenido de ese archivo y pegalo en el SQL Editor de Supabase.`);
