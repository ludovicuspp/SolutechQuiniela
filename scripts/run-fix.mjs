import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const connectionString = 'postgresql://postgres:0E7fGenR9mjM4zXt@db.slnhwbuoyiowlppzrlkq.supabase.co:5432/postgres';

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function run() {
  console.log('Conectando a Supabase...');
  await client.connect();
  console.log('Conectado!');

  const sql = readFileSync(join(__dirname, '..', 'supabase', 'migrations', 'time_lock_definitive_fix.sql'), 'utf8');

  const statements = [];
  let current = '';
  let inDollarQuote = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    if (sql[i] === '$' && sql[i + 1] === '$') {
      inDollarQuote = !inDollarQuote;
      current += '$$';
      i++;
      continue;
    }
    if (char === ';' && !inDollarQuote) {
      const stmt = current.trim();
      if (stmt && !stmt.startsWith('--')) {
        statements.push(stmt);
      }
      current = '';
      continue;
    }
    current += char;
  }

  console.log(`Ejecutando ${statements.length} statements...`);
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim();
    if (!stmt || stmt.startsWith('--')) continue;
    try {
      await client.query(stmt);
      const preview = stmt.substring(0, 80).replace(/\n/g, ' ');
      console.log(`  [${i+1}/${statements.length}] OK: ${preview}...`);
    } catch (err) {
      const preview = stmt.substring(0, 80).replace(/\n/g, ' ');
      if (err.message.includes('already exists') || err.message.includes('does not exist')) {
        console.log(`  [${i+1}/${statements.length}] SKIP: ${preview}...`);
      } else {
        console.error(`  [${i+1}/${statements.length}] ERROR: ${preview}...`);
        console.error(`    ${err.message}`);
      }
    }
  }

  console.log('\nVerificando fix...');
  const result = await client.query(`
    SELECT prosrc FROM pg_proc WHERE proname = 'place_bet' AND pronamespace::regnamespace::text = 'public'
  `);
  const src = result.rows[0]?.prosrc || '';
  console.log('place_bet contiene "12:00 PM":', src.includes('12:00 PM'));
  console.log('place_bet contiene "10 minutos":', src.includes('10 minutos'));

  await client.end();
  console.log('\nListo!');
}

run().catch(err => {
  console.error('Error fatal:', err.message);
  process.exit(1);
});
