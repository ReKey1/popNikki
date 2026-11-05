import { vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

/** A router that matches every path, for components that render RouterLinks. */
export function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:path(.*)*', component: { render: () => null } }],
  })
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

/** Stubs `fetch` with fixed responses per URL; anything else gets a 404. */
export function stubApi(routes: Record<string, Response>) {
  const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
    async (url) => routes[url]?.clone() ?? Response.json({}, { status: 404 }),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}
