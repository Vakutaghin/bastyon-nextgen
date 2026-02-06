import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/home-page/home-page.vue'
import ProfileView from '@/views/profile-page/profile-page.vue'


const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),

  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/:userName',
      name: 'profile',
      component: ProfileView
    }
  ]
})

export default router
