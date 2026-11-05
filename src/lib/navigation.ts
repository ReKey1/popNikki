import type { RouteLocationRaw, Router } from 'vue-router'

/** Goes to the previous in-app page, or to `fallback` when the app was opened on this page. */
export function goBack(router: Router, fallback: RouteLocationRaw = '/'): void {
  if (router.options.history.state.back) router.back()
  else void router.push(fallback)
}
