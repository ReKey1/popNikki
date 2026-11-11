import { hashToken, newToken } from '../server/lib/tokens.ts'
import { sqlString } from './sql.ts'

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

export type Revoke = { sql: string; link?: string }

/**
 * The SQL that shuts out a member's tag and logs out every device it logged in.
 * With a `baseUrl` the member gets a fresh token instead of being shut out: the SQL stores its
 * hash on the same row, so they keep their name and nikki, and the new login link is returned.
 * The last statement lists the member, which shows whether the name matched anyone.
 */
export async function buildRevoke(
  username: string,
  baseUrl?: string,
  now = Date.now(),
): Promise<Revoke> {
  const name = sqlString(username)
  const token = baseUrl === undefined ? undefined : newToken()
  const change = token
    ? `token_hash = '${await hashToken(token)}', revoked_at = NULL`
    : `revoked_at = ${now}`
  return {
    sql:
      `UPDATE users SET ${change} WHERE username = ${name};
` +
      `DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE username = ${name});
` +
      `SELECT id, username, revoked_at FROM users WHERE username = ${name};
`,
    link: token && `${new URL(baseUrl!).origin}/tag?t=${token}`,
  }
}
