import { describe, expect, it } from 'vitest'

import { hashToken } from '../../server/lib/tokens.ts'
import { buildRevoke, buildUsers } from '../users.ts'

describe('buildUsers', () => {
  it('returns one login link per user on the given origin', async () => {
    const { links } = await buildUsers(3, 'http://localhost:5173/ignored/path')
    expect(links).toHaveLength(3)
    for (const link of links) expect(link).toMatch(/^http:\/\/localhost:5173\/tag\?t=[\w-]{22}$/)
    expect(new Set(links).size).toBe(3)
  })

  it('stores token hashes in the SQL, never the tokens', async () => {
    const { sql, links } = await buildUsers(2, 'https://example.com', 1234)
    for (const link of links) {
      const token = new URL(link).searchParams.get('t')!
      expect(sql).not.toContain(token)
      expect(sql).toContain(`('${await hashToken(token)}', 1234)`)
    }
    expect(sql).toMatch(/^INSERT INTO users \(token_hash, created_at\) VALUES/)
  })

  it('rejects a count that is not a positive integer', async () => {
    await expect(buildUsers(0, 'https://example.com')).rejects.toThrow(
      'count must be a positive integer',
    )
    await expect(buildUsers(1.5, 'https://example.com')).rejects.toThrow(
      'count must be a positive integer',
    )
  })
})

describe('buildRevoke', () => {
  it('shuts the tag out and logs out every device', async () => {
    const { sql, link } = await buildRevoke('nikki', undefined, 1234)
    expect(link).toBeUndefined()
    expect(sql).toContain("UPDATE users SET revoked_at = 1234 WHERE username = 'nikki';")
    expect(sql).toContain(
      "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE username = 'nikki');",
    )
  })

  it('gives the member a new link on the same row when replacing the tag', async () => {
    const { sql, link } = await buildRevoke('nikki', 'https://example.com/ignored')
    expect(link).toMatch(/^https:\/\/example\.com\/tag\?t=[\w-]{22}$/)
    const token = new URL(link!).searchParams.get('t')!
    expect(sql).not.toContain(token)
    expect(sql).toContain(
      `UPDATE users SET token_hash = '${await hashToken(token)}', revoked_at = NULL WHERE username = 'nikki';`,
    )
    expect(sql).toContain('DELETE FROM sessions')
  })

  it('escapes quotes in the name', async () => {
    const { sql } = await buildRevoke("d'arcy")
    expect(sql).toContain("WHERE username = 'd''arcy';")
    expect(sql).not.toContain("'d'arcy'")
  })
})
