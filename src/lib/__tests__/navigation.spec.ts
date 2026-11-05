import { describe, expect, it, vi } from 'vitest'
import { createWebHistory } from 'vue-router'

import { testRouter } from '@/__tests__/helpers'
import { goBack, leaveStep } from '../navigation'

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

describe('leaveStep', () => {
  const at = (router: ReturnType<typeof testRouter>, path: string) =>
    vi.waitFor(() => expect(router.currentRoute.value.path).toBe(path))

  it('returns to your profile without leaving the upload or the timer behind', async () => {
    const router = testRouter(createWebHistory())
    await router.push('/')
    await router.push('/me')
    await router.push('/new')
    await router.replace('/practice/5') // the upload hands over to the timer

    await leaveStep(router, '/me')
    await at(router, '/me')
    // Back from the profile goes to where you were before it, not into the timer.
    expect(router.options.history.state.back).toBe('/')

    router.back()
    await at(router, '/')
  })

  it('takes the step’s place when the page is not the one before', async () => {
    const router = testRouter(createWebHistory())
    await router.push('/')
    await router.push('/new')
    await router.replace('/practice/5')

    await leaveStep(router, '/me')
    await at(router, '/me')
    expect(router.options.history.state.back).toBe('/')

    router.back()
    await at(router, '/')
  })
})
