import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/claim', name: 'claim', component: () => import('../views/ClaimView.vue') },
    { path: '/new', name: 'new-post', component: () => import('../views/NewPostView.vue') },
    {
      path: '/plants/:id(\\d+)',
      name: 'plant',
      component: () => import('../views/PlantView.vue'),
      props: true,
    },
  ],
})

export default router
