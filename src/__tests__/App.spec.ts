import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRouter, createWebHistory } from 'vue-router'

import { stubApi, testPinia } from '@/__tests__/helpers'
import { useSessionStore } from '@/stores/session'
import App from '../App.vue'

const page = (text: string) => ({ render: () => text })

function testApp() {
  const pinia = testPinia()
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'home', component: page('home') },
      { path: '/me', component: page('me'), meta: { requiresAuth: true } },
      { path: '/plants/:id', component: page('plant'), meta: { requiresAuth: true } },
    ],
  })
  return { pinia, router }
}

describe('App', () => {
  beforeEach(() => window.history.replaceState(null, '', '/'))
  afterEach(() => vi.unstubAllGlobals())

  it('sends a remembered member home once the server says the session is over', async () => {
    stubApi({ '/api/me': Response.json({ error: 'Not logged in' }, { status: 401 }) })
    const { pinia, router } = testApp()
    const session = useSessionStore()
    session.me = { id: 1, username: 'nikki' }
    await router.push('/me')
    const wrapper = mount(App, { global: { plugins: [pinia, router] } })
    expect(wrapper.text()).toBe('me')

    await session.load()
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/')
    expect(wrapper.text()).toBe('home')
  })

  it('plays the entrance for a step forward, but not for a replaced page or a step back', async () => {
    stubApi({})
    const { pinia, router } = testApp()
    await router.push('/')
    const wrapper = mount(App, { global: { plugins: [pinia, router] } })
    const entered = () => wrapper.get('.pn-page').element

    const home = entered()
    await router.push('/me')
    await flushPromises()
    const me = entered()
    expect(me).not.toBe(home)

    await router.replace('/plants/2')
    await flushPromises()
    expect(wrapper.text()).toBe('plant')
    expect(entered()).toBe(me)
    expect(wrapper.find('.pn-page--back').exists()).toBe(false)

    router.back()
    await new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }))
    await flushPromises()
    expect(wrapper.text()).toBe('home')
    expect(entered()).toBe(me)
    // Lists on a page gone back to don't play their entrances again.
    expect(wrapper.find('.pn-page--back').exists()).toBe(true)
  })
})
