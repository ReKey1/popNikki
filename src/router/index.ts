import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  // Back and forward restore the scroll position; a new page starts at the top.
  scrollBehavior: (_to, _from, savedPosition) => savedPosition ?? { top: 0 },
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/claim', name: 'claim', component: () => import('../views/ClaimView.vue') },
    { path: '/new', name: 'new-post', component: () => import('../views/NewPostView.vue') },
    { path: '/me', name: 'profile', component: () => import('../views/ProfileView.vue') },
    {
      path: '/practice/:id(\\d+)',
      name: 'practice',
      component: () => import('../views/PracticeView.vue'),
      props: true,
    },
    {
      path: '/plants/:id(\\d+)/:postId(\\d+)?',
      name: 'plant',
      component: () => import('../views/PlantView.vue'),
      props: true,
    },
  ],
})

export default router
