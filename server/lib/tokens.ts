import { encodeBase64Url } from 'hono/utils/encode'

/** A random base64url token without padding. 16 bytes give 22 characters. */
export function newToken(bytes = 16): string {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(bytes)).buffer).replace(/=+$/, '')
}

/** SHA-256 of a token as lowercase hex. Only this hash is stored in D1. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
