// scripts/generate_bulk_users.mjs
// Lee el Excel de colaboradores y genera un bloque SQL para inserción masiva.
// Uso: node scripts/generate_bulk_users.mjs

import XLSX from 'xlsx';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXCEL_FILE = join(__dirname, '..', 'NOMBRES DE COLABORADORES IRONFLEX GROUP.xlsx');
const PASSWORD = '12345678';
const EMPRESA = 'Solutech';
const PUNTOS = 1000;

// Leer workbook
const workbook = XLSX.readFile(EXCEL_FILE);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

const DATA_START_ROW = 7;

const seenCI = new Set();
const duplicates = [];
const users = [];

for (let row = DATA_START_ROW; ; row++) {
  const ciCell = `C${row}`;
  const nameCell = `B${row}`;

  const name = (sheet[nameCell]?.v ?? '').toString().trim();
  const ciRaw = (sheet[ciCell]?.v ?? '').toString().trim();

  if (!name && !ciRaw) break;

  const ci = ciRaw.replace(/[,.\s]/g, '');

  if (!ci || ci === 'nan' || ci === '' || !/^\d+$/.test(ci)) {
    console.warn(`  ⚠ Ignorado: "${name}" → CI="${ciRaw}"`);
    continue;
  }

  if (seenCI.has(ci)) {
    duplicates.push({ name, ci });
    console.warn(`  ⚠ Duplicado: "${name}" → CI ${ci} (se ignora)`);
    continue;
  }

  seenCI.add(ci);
  const nombre = name.toUpperCase() === name
    ? name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
    : name;

  users.push({ name: nombre, ci });
}

console.log(`\n✅ Empleados válidos: ${users.length}`);
if (duplicates.length > 0) {
  console.warn(`⚠ Duplicados ignorados: ${duplicates.length}`);
}

// Generar bloque SQL
const calls = users.map(u => {
  const rif = `V${u.ci}`;
  const email = `${u.ci}@solutechquiniela.app`;
  const nombre = u.name.replace(/'/g, "''");
  return `  perform public_admin_create_user('${email}', '${PASSWORD}', '${rif}', '${nombre}', '', '', '', '${EMPRESA}', ${PUNTOS}, false);`;
}).join('\n');

const sql = `-- ============================================================
-- Bulk insert: ${users.length} empleados
-- Generado por scripts/generate_bulk_users.mjs
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
