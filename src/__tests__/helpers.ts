import { createPinia, setActivePinia } from 'pinia'
import { vi } from 'vitest'
import { createMemoryHistory, createRouter, type RouterHistory } from 'vue-router'

/**
 * A router that matches every path, for components that render RouterLinks.
 * Pass `createWebHistory()` to test going back: only the browser history records the previous page.
 */
export function testRouter(history: RouterHistory = createMemoryHistory()) {
  return createRouter({
    history,
    routes: [{ path: '/:path(.*)*', component: { render: () => null } }],
  })
}

/** A fresh, empty set of stores, active for the test and ready to pass to `mount`. */
export function testPinia() {
  // The stores remember the viewer and the garden on the device.
  localStorage.clear()
  const pinia = createPinia()
  setActivePinia(pinia)
  return pinia
}

/** jsdom has no modal dialogs yet, so this adds the two methods BaseSheet uses. */
export function stubDialog() {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}

/**
 * Stubs `fetch` with fixed responses per URL; anything else gets a 404.
 * A key such as `POST /api/roll` answers only that method, ahead of the plain URL.
 */
export function stubApi(routes: Record<string, Response>) {
  const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
    async (url, init) =>
      (routes[`${init?.method ?? 'GET'} ${url}`] ?? routes[url])?.clone() ??
      Response.json({}, { status: 404 }),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}
