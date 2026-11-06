import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubApi, testPinia } from '@/__tests__/helpers'
import { usePendingPostStore } from '../pendingPost'

vi.mock('@/lib/image', () => ({
  resizeToJpeg: async () => new Blob(['jpeg'], { type: 'image/jpeg' }),
}))

describe('pending post store', () => {
  beforeEach(testPinia)
  afterEach(() => vi.unstubAllGlobals())

  it('uploads in the background and resolves to the post id', async () => {
    stubApi({ '/api/posts': Response.json({ id: 5 }, { status: 201 }) })
    const pending = usePendingPostStore()
    void pending.start(new Blob(['x']), 'leaf')
    expect(await pending.upload).toBe(5)
  })

  it('sends the same photo again after a failure', async () => {
    const fetch = stubApi({
      '/api/posts': Response.json({ error: 'Upload is too large' }, { status: 413 }),
    })
    const pending = usePendingPostStore()
    await expect(pending.start(new Blob(['x']), 'leaf')).rejects.toThrow('Upload is too large')

    fetch.mockResolvedValueOnce(Response.json({ id: 6 }, { status: 201 }))
    expect(await pending.again()).toBe(6)
    const form = fetch.mock.calls[1]![1]!.body as FormData
    expect(form.get('description')).toBe('leaf')
  })

  it('has nothing to send after it is cleared', () => {
    stubApi({})
    const pending = usePendingPostStore()
    void pending.start(new Blob(['x']), 'leaf').catch(() => {})
    pending.clear()
    expect(pending.upload).toBeNull()
    expect(pending.again()).toBeNull()
  })
})
