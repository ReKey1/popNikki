import { hashToken, newToken } from '../server/lib/tokens.ts'

export type NewUsers = { sql: string; links: string[] }

/** Creates `count` tag tokens. Returns the SQL that stores their hashes and the login links. */
export async function buildUsers(
  count: number,
  baseUrl: string,
  now = Date.now(),
): Promise<NewUsers> {
  if (!Number.isInteger(count) || count < 1) throw new Error('count must be a positive integer')
  const origin = new URL(baseUrl).origin
  const tokens = Array.from({ length: count }, () => newToken())
  const hashes = await Promise.all(tokens.map(hashToken))
  const values = hashes.map((hash) => `('${hash}', ${now})`).join(',\n  ')
  return {
    sql: `INSERT INTO users (token_hash, created_at) VALUES\n  ${values};\n`,
    links: tokens.map((token) => `${origin}/tag?t=${token}`),
  }
}
