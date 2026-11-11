import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testRouter } from '@/__tests__/helpers'
import NikkiTile from '../NikkiTile.vue'

async function mountTile(sealed: boolean) {
  const router = testRouter()
  await router.push('/')
  const wrapper = mount(NikkiTile, {
    props: { to: '/plants/2', name: 'けんじ', src: '/t.jpg', ago: '2h', day: 23, posts: 9, sealed },
    global: { plugins: [router] },
  })
  return { router, wrapper }
}

describe('NikkiTile', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the name, time and meta, and opens at once when not sealed', async () => {
    const { router, wrapper } = await mountTile(false)
    expect(wrapper.text()).toContain('けんじ')
    expect(wrapper.text()).toContain('2h')
    expect(wrapper.text()).toContain('DAY 23 · 9 NIKKI')
    expect(wrapper.get('img').attributes('src')).toBe('/t.jpg')

    await wrapper.get('a').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/plants/2')
  })

  it('breaks the seal before following the link', async () => {
    vi.useFakeTimers()
    const { router, wrapper } = await mountTile(true)
    expect(wrapper.get('a').attributes('aria-label')).toBe('けんじ, new nikki')
    expect(wrapper.find('.seal').exists()).toBe(true)

    await wrapper.get('a').trigger('click')
    expect(wrapper.get('.seal').classes()).toContain('seal--breaking')
    expect(router.currentRoute.value.path).toBe('/')

    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()
    expect(wrapper.find('.seal').exists()).toBe(false)
    expect(router.currentRoute.value.path).toBe('/plants/2')
  })
})
