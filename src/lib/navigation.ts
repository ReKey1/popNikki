import type { RouteLocationRaw, Router } from 'vue-router'

/** Goes to the previous in-app page, or to `fallback` when the app was opened on this page. */
export function goBack(router: Router, fallback: RouteLocationRaw = '/'): void {
  if (router.options.history.state.back) router.back()
  else void router.push(fallback)
}

/**
 * Leaves a step of posting (camera, upload, practice) for `to`, without leaving the step in
 * the history: Back from `to` must never land on a finished step. Goes back when `to` is the
 * page just before; otherwise this history entry becomes `to`.
 */
export function leaveStep(router: Router, to: string): Promise<unknown> {
  if (router.options.history.state.back === to) {
    router.back()
    return Promise.resolve()
  }
  return router.replace(to)
}
