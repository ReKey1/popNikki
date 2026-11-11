import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// `public/_headers` is read by Cloudflare, not by any code here, so this guards it by hand.
const file = readFileSync(new URL('../../public/_headers', import.meta.url), 'utf8')

/** The headers listed under a path pattern. */
function headersFor(pattern: string): Record<string, string> {
  const lines = file.split('\n')
  const start = lines.indexOf(pattern)
  const headers: Record<string, string> = {}
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith('  ')) break
    const colon = line.indexOf(':')
    headers[line.slice(2, colon)] = line.slice(colon + 1).trim()
  }
  return headers
}

describe('page headers', () => {
  const pages = headersFor('/*')
  const csp = Object.fromEntries(
    pages['Content-Security-Policy']!.split('; ').map((directive) => {
      const [name, ...sources] = directive.split(' ')
      return [name, sources]
    }),
  )

  it('runs only the app’s own scripts', () => {
    expect(csp['default-src']).toEqual(["'self'"])
    expect(csp['script-src']).toEqual(["'self'"])
    expect(csp['object-src']).toEqual(["'none'"])
    expect(csp['base-uri']).toEqual(["'none'"])
  })

  it('sends data only to the app’s own server', () => {
    expect(csp['connect-src']).toEqual(["'self'"])
    expect(csp['form-action']).toEqual(["'self'"])
  })

  it('cannot be framed by another site', () => {
    expect(csp['frame-ancestors']).toEqual(["'none'"])
    expect(pages['X-Frame-Options']).toBe('DENY')
  })

  it('allows the camera and photo previews the app needs, and no more', () => {
    expect(csp['img-src']).toEqual(["'self'", 'blob:', 'data:'])
    expect(pages['Permissions-Policy']).toBe('camera=(self), microphone=(), geolocation=()')
  })

  it('leaks no address, stays on HTTPS and stays out of search results', () => {
    expect(pages['Referrer-Policy']).toBe('no-referrer')
    expect(pages['Strict-Transport-Security']).toMatch(/^max-age=\d{7,}/)
    expect(pages['X-Content-Type-Options']).toBe('nosniff')
    expect(pages['X-Robots-Tag']).toContain('noindex')
  })

  it('lets browsers keep the hashed files for good', () => {
    expect(headersFor('/assets/*')['Cache-Control']).toBe('public, max-age=31536000, immutable')
  })
})
