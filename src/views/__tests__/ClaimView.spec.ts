import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testPinia } from '@/__tests__/helpers'
import { useSessionStore } from '@/stores/session'
import ClaimView from '../ClaimView.vue'

const push = vi.fn<(to: string) => Promise<void>>()
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRouter: () => ({ push }),
}))

describe('ClaimView', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    push.mockReset()
  })

  it('sends the username and goes home', async () => {
    const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 204 }),
    )
    vi.stubGlobal('fetch', fetch)
    const wrapper = mount(ClaimView, { global: { plugins: [testPinia()] } })
    const session = useSessionStore()
    const reset = vi.spyOn(session, 'reset')

    await wrapper.find('input').setValue('nikki')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(fetch).toHaveBeenCalledWith('/api/claim', expect.objectContaining({ method: 'POST' }))
    expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({ username: 'nikki' })
    // The claim logged you in, so the session is fetched again on the way home.
    expect(reset).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith('/')
  })

  it('shows the server error when the name is taken', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<() => Promise<Response>>(async () =>
        Response.json({ error: 'That name is taken' }, { status: 409 }),
      ),
    )
    const wrapper = mount(ClaimView, { global: { plugins: [testPinia()] } })

    await wrapper.find('input').setValue('nikki')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toBe('That name is taken')
    expect(push).not.toHaveBeenCalled()
  })
})
