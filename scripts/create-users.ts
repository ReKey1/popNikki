// Creates users with fresh tag tokens, stores only the token hashes in D1, and prints each login link.
// Usage: npm run users:create -- <count> [--remote --base-url https://DOMAIN]
// Output goes to secrets/ (gitignored). Never commit it.
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

import { buildUsers } from './users.ts'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    remote: { type: 'boolean', default: false },
    'base-url': { type: 'string' },
  },
})

const count = Number(positionals[0])
const baseUrl = values['base-url'] ?? (values.remote ? undefined : 'http://localhost:5173')
if (!Number.isInteger(count) || count < 1 || !baseUrl) {
  console.error('Usage: npm run users:create -- <count> [--remote --base-url https://DOMAIN]')
  process.exit(1)
}

const { sql, links } = await buildUsers(count, baseUrl)
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const target = values.remote ? 'remote' : 'local'
const sqlFile = `secrets/users-${target}-${stamp}.sql`
const linksFile = `secrets/users-${target}-${stamp}.txt`
mkdirSync('secrets', { recursive: true })
writeFileSync(sqlFile, sql)
writeFileSync(linksFile, links.join('\n') + '\n')

const result = spawnSync(
  'npx',
  ['wrangler', 'd1', 'execute', 'popnikki', `--${target}`, '--file', sqlFile],
  { stdio: 'inherit', shell: process.platform === 'win32' },
)
if (result.status !== 0) {
  console.error(`wrangler failed; nothing was added. SQL kept in ${sqlFile}`)
  process.exit(result.status ?? 1)
}

console.log(
  `\nAdded ${count} user(s) to the ${target} database. Login links (also in ${linksFile}):`,
)
for (const link of links) console.log(link)
