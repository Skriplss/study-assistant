#!/usr/bin/env node
// Run an ad-hoc query against this project's Supabase (service-role).
// Usage:  node .claude/skills/supabase/query.mjs "<async js body using `db`>"
// In scope: `db` (Supabase client), `console`. Example:
//   node .claude/skills/supabase/query.mjs "const {data}=await db.from('quizzes').select('id,title,status'); console.table(data)"
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const require = createRequire(projectRoot + '/')
const { createClient } = require('@supabase/supabase-js')

const env = Object.fromEntries(
  readFileSync(resolve(projectRoot, '.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    })
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const db = createClient(url, key)

const body = process.argv[2]
if (!body) {
  console.error('Provide a query body, e.g.:\n  node query.mjs "const {data}=await db.from(\'quizzes\').select(\'*\'); console.table(data)"')
  process.exit(1)
}

const run = new Function('db', 'console', `return (async () => { ${body} })()`)
try {
  await run(db, console)
} catch (e) {
  console.error('Query error:', e.message)
  process.exit(1)
}
