// Shuts out a tag that was lost or whose link got out: it stops working and every device it
// logged in is logged out. With --replace the member gets a new link for a new tag instead, and
// keeps their name and nikki.
// Usage: npm run users:revoke -- <username> [--replace] [--remote --base-url https://DOMAIN]
// A new link goes to secrets/ (gitignored). Never commit it.
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

import { buildRevoke } from './users.ts'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    replace: { type: 'boolean', default: false },
    remote: { type: 'boolean', default: false },
    'base-url': { type: 'string' },
  },
})

const username = positionals[0]
const baseUrl = values['base-url'] ?? (values.remote ? undefined : 'http://localhost:5173')
if (!username || (values.replace && !baseUrl)) {
  console.error(
    'Usage: npm run users:revoke -- <username> [--replace] [--remote --base-url https://DOMAIN]',
  )
  process.exit(1)
}

const { sql, link } = await buildRevoke(username, values.replace ? baseUrl : undefined)
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const target = values.remote ? 'remote' : 'local'
const sqlFile = `secrets/revoke-${target}-${stamp}.sql`
mkdirSync('secrets', { recursive: true })
writeFileSync(sqlFile, sql)

const result = spawnSync(
  'npx',
  ['wrangler', 'd1', 'execute', 'popnikki', `--${target}`, '--file', sqlFile],
  { stdio: 'inherit', shell: process.platform === 'win32' },
)
if (result.status !== 0) {
  console.error(`wrangler failed; nothing was changed. SQL kept in ${sqlFile}`)
  process.exit(result.status ?? 1)
}

// The last statement lists the member, so an empty result above means the name matched no one.
if (link) {
  const linkFile = `secrets/revoke-${target}-${stamp}.txt`
  writeFileSync(linkFile, link + '\n')
  console.log(
    `\nIf ${username} is listed above, their old tag is dead. New link (also in ${linkFile}):`,
  )
  console.log(link)
} else {
  console.log(`\nIf ${username} is listed above, their tag is dead and they are logged out.`)
}
