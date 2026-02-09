import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '@/pages/home-page/home-page.vue'
import ProfilePage from '@/pages/profile-page/profile-page.vue'


const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),

  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage
    },

    {
      path: '/:userName',
      name: 'profile',
      component: ProfilePage
    }
  ]
})

export default router
