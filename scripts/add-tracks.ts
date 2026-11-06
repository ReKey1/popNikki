// Uploads every .mp3 / .m4a in music/ (gitignored) to R2 and adds it to the playlist in D1.
// Usage: npm run tracks:add [-- --remote]
// Only add songs the owner has confirmed permission for. Keep that record outside the repo.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

import { buildTracks } from './tracks.ts'

const DIR = 'music'
const { values } = parseArgs({ options: { remote: { type: 'boolean', default: false } } })
const target = values.remote ? 'remote' : 'local'

if (!existsSync(DIR)) {
  console.error(`Put your .mp3 or .m4a files in ${DIR}/ first.`)
  process.exit(1)
}
const files = readdirSync(DIR, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
const { uploads, sql, skipped } = buildTracks(files)
for (const file of skipped) console.warn(`Skipped ${file}: only .mp3 and .m4a are supported.`)
if (uploads.length === 0) {
  console.error(`No .mp3 or .m4a files in ${DIR}/.`)
  process.exit(1)
}

/** Runs wrangler with Node directly, so file names with spaces need no shell quoting. */
function wrangler(...args: string[]) {
  const bin = join('node_modules', 'wrangler', 'bin', 'wrangler.js')
  const result = spawnSync(process.execPath, [bin, ...args, `--${target}`], { stdio: 'inherit' })
  if (result.status !== 0) {
    console.error('wrangler failed; stopping.')
    process.exit(result.status ?? 1)
  }
}

for (const { file, key, contentType } of uploads) {
  console.log(`\nUploading ${file} -> ${key}`)
  wrangler(
    'r2',
    'object',
    'put',
    `popnikki-files/${key}`,
    '--file',
    join(DIR, file),
    '--content-type',
    contentType,
  )
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const sqlFile = `secrets/tracks-${target}-${stamp}.sql`
mkdirSync('secrets', { recursive: true })
writeFileSync(sqlFile, sql)
wrangler('d1', 'execute', 'popnikki', '--file', sqlFile)

console.log(`\nThe ${target} playlist now has: ${uploads.map((u) => u.file).join(', ')}`)
