import { createRouter, createWebHistory } from 'vue-router'
import { getActivePinia } from 'pinia'
import HomePage from '@/pages/home-page/home-page.vue'
import ProfilePage from '@/pages/profile-page/profile-page.vue'
import SettingsPage from '@/pages/settings-page/settings-page.vue'
import LimitsPage from '@/pages/limits-page/limits-page.vue'
import WalletsPage from '@/pages/wallets-page/wallets-page.vue'
import MyVideosPage from '@/pages/my-videos-page/my-videos-page.vue'
import { useAuthStore } from '@/blockchain'

/** Маршруты, для которых нужна авторизация (перед проверкой вызываем restoreSession). */
const AUTH_REQUIRED_NAMES = new Set(['limits', 'wallets', 'settings', 'my-videos'])

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),

  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsPage
    },
    {
      path: '/limits',
      name: 'limits',
      component: LimitsPage
    },
    {
      path: '/wallets',
      name: 'wallets',
      component: WalletsPage
    },
    {
      path: '/my-videos',
      name: 'my-videos',
      component: MyVideosPage
    },
    {
      path: '/:userName',
      name: 'profile',
      component: ProfilePage
    }
  ]
})

router.beforeEach(async (to) => {
  if (!AUTH_REQUIRED_NAMES.has(to.name)) return
  const pinia = getActivePinia()
  if (!pinia) return
  const authStore = useAuthStore(pinia)
  await authStore.restoreSession()
  if (!authStore.isUserAuthenticated) {
    return { path: '/', replace: true }
  }
})

export default router
