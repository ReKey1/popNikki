import { describe, expect, it } from 'vitest'

import { hashToken, newToken } from '../lib/tokens'

describe('tokens', () => {
  it('makes a 22-character base64url tag token by default', () => {
    expect(newToken()).toMatch(/^[\w-]{22}$/)
  })

  it('makes a 43-character token from 32 bytes', () => {
    expect(newToken(32)).toMatch(/^[\w-]{43}$/)
  })

  it('never repeats a token', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => newToken()))
    expect(tokens.size).toBe(100)
  })

  it('hashes to the known SHA-256 hex digest', async () => {
    expect(await hashToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})
