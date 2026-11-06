import { createRouter, createWebHistory } from 'vue-router'

import { useSessionStore } from '@/stores/session'
import HomeView from '../views/HomeView.vue'
import PlantView from '../views/PlantView.vue'
import ProfileView from '../views/ProfileView.vue'

declare module 'vue-router' {
  interface RouteMeta {
    /** Logged-out visitors are sent to the home page, which asks them to tap their tag. */
    requiresAuth?: boolean
  }
}

// The pages you move between are in the main bundle, so opening one never waits on a download.
// The camera, claim and practice pages load on demand.
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  // Back and forward restore the scroll position; a new page starts at the top.
  scrollBehavior: (_to, _from, savedPosition) => savedPosition ?? { top: 0 },
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/claim', name: 'claim', component: () => import('../views/ClaimView.vue') },
    {
      path: '/new',
      name: 'new-post',
      component: () => import('../views/NewPostView.vue'),
      meta: { requiresAuth: true },
    },
    { path: '/me', name: 'profile', component: ProfileView, meta: { requiresAuth: true } },
    {
      // Without an id, the practice waits for the upload that is still in progress.
      path: '/practice/:id(\\d+)?',
      name: 'practice',
      component: () => import('../views/PracticeView.vue'),
      props: true,
      meta: { requiresAuth: true },
    },
    {
      path: '/plants/:id(\\d+)/:postId(\\d+)?',
      name: 'plant',
      component: PlantView,
      props: true,
      meta: { requiresAuth: true },
    },
  ],
})

// The session is fetched before the first page renders, then reused by every later navigation.
router.beforeEach(async (to) => {
  const session = useSessionStore()
  await session.load()
  if (to.meta.requiresAuth && !session.me) return { name: 'home' }
})

export default router
