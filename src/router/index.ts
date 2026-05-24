import { createRouter, createWebHistory } from 'vue-router'
import { getActivePinia } from 'pinia'
import { useAuthStore } from '@/blockchain'

// Lazy-loaded page components for code-splitting
const HomePage = () => import('@/pages/home-page/home-page.vue')
const ProfilePage = () => import('@/pages/profile-page/profile-page.vue')
const SettingsPage = () => import('@/pages/settings-page/settings-page.vue')
const LimitsPage = () => import('@/pages/limits-page/limits-page.vue')
const WalletsPage = () => import('@/pages/wallets-page/wallets-page.vue')
const MyVideosPage = () => import('@/pages/my-videos-page/my-videos-page.vue')
const BlockExplorerPage = () => import('@/pages/block-explorer-page/block-explorer-page.vue')
const ExplorerBlockPage = () => import('@/pages/block-explorer-page/block-page/block-page.vue')
const ExplorerTxPage    = () => import('@/pages/block-explorer-page/tx-page/tx-page.vue')
const ExplorerAddressPage = () => import('@/pages/block-explorer-page/address-page/address-page.vue')
const ExplorerPeersPage = () => import('@/pages/block-explorer-page/peers-page/peers-page.vue')
const SearchPage = () => import('@/pages/search-page/search-page.vue')

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
    // Block explorer routes must come BEFORE the catch-all /:userName below —
    // otherwise the profile route greedily matches `/explorer`, `/explorer/...`.
    {
      path: '/explorer',
      name: 'explorer',
      component: BlockExplorerPage
    },
    {
      path: '/explorer/block/:hashOrHeight',
      name: 'explorer-block',
      component: ExplorerBlockPage,
      props: true
    },
    {
      path: '/explorer/tx/:txid',
      name: 'explorer-tx',
      component: ExplorerTxPage,
      props: true
    },
    {
      path: '/explorer/address/:address',
      name: 'explorer-address',
      component: ExplorerAddressPage,
      props: true
    },
    {
      path: '/explorer/peers',
      name: 'explorer-peers',
      component: ExplorerPeersPage
    },
    // /search must be declared BEFORE the catch-all /:userName so the
    // profile route doesn't greedily match it.
    {
      path: '/search',
      name: 'search',
      component: SearchPage
    },
    {
      path: '/:userName',
      name: 'profile',
      component: ProfilePage
    }
  ]
})

router.beforeEach(async (to) => {
  if (!AUTH_REQUIRED_NAMES.has(to.name as string)) return
  const pinia = getActivePinia()
  if (!pinia) return
  const authStore = useAuthStore(pinia)
  await authStore.restoreSession()
  if (!authStore.isUserAuthenticated) {
    return { path: '/', replace: true }
  }
})

export default router
