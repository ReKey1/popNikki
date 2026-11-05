import { describe, expect, it, vi } from 'vitest'
import { createWebHistory } from 'vue-router'

import { testRouter } from '@/__tests__/helpers'
import { goBack } from '../navigation'

describe('goBack', () => {
  it('returns to the previous in-app page', async () => {
    const router = testRouter(createWebHistory())
    await router.push('/plants/2')
    await router.push('/plants/2/4')

    goBack(router)
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/plants/2'))
  })

  it('goes to the fallback when the app was opened on this page', async () => {
    const router = testRouter()
    await router.push('/me')

    goBack(router)
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/'))

    goBack(router, '/me')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/me'))
  })
})
