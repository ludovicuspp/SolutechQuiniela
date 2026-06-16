import pg from 'pg'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const connectionString = process.env.DATABASE_URL
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })

async function run() {
  console.log('Connecting to Supabase database...')
  await client.connect()
  console.log('Connected!')

  const sql = readFileSync(join(__dirname, '..', 'supabase', 'schema.sql'), 'utf8')

  // Split by semicolons but respect function bodies ($$...$$)
  const statements = []
  let current = ''
  let inDollarQuote = false

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i]

    if (sql[i] === '$' && sql[i + 1] === '$') {
      inDollarQuote = !inDollarQuote
      current += '$$'
      i++
      continue
    }

    if (char === ';' && !inDollarQuote) {
      const stmt = current.trim()
      if (stmt && !stmt.startsWith('--')) {
        statements.push(stmt)
      }
      current = ''
      continue
    }

    current += char
  }

  console.log(`Executing ${statements.length} statements...`)

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim()
    if (!stmt || stmt.startsWith('--')) continue

    try {
      await client.query(stmt)
      const preview = stmt.substring(0, 60).replace(/\n/g, ' ')
      console.log(`  [${i + 1}/${statements.length}] OK: ${preview}...`)
    } catch (err) {
      const preview = stmt.substring(0, 60).replace(/\n/g, ' ')
      if (err.message.includes('already exists')) {
        console.log(`  [${i + 1}/${statements.length}] SKIP (exists): ${preview}...`)
      } else {
        console.error(`  [${i + 1}/${statements.length}] ERROR: ${preview}...`)
        console.error(`    ${err.message}`)
      }
    }
  }

  console.log('\nDone!')
  await client.end()
}

run().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
