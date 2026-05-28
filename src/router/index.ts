import { createRouter, createWebHistory } from 'vue-router'
import { getActivePinia } from 'pinia'
import { useAuthStore } from '@/blockchain'
import { setDocumentTitle } from '@/composables/use-document-title'

// Lazy-loaded page components for code-splitting
const HomePage = () => import('@/pages/home-page/home-page.vue')
const ProfilePage = () => import('@/pages/profile-page/profile-page.vue')
const SettingsPage = () => import('@/pages/settings-page/settings-page.vue')
const LimitsPage = () => import('@/pages/limits-page/limits-page.vue')
const WalletsPage = () => import('@/pages/wallets-page/wallets-page.vue')
const MyVideosPage = () => import('@/pages/my-videos-page/my-videos-page.vue')
const BlockExplorerPage = () => import('@/pages/block-explorer-page/block-explorer-page.vue')
const ExplorerBlockPage = () => import('@/pages/block-explorer-page/block-page/block-page.vue')
const ExplorerTxPage = () => import('@/pages/block-explorer-page/tx-page/tx-page.vue')
const ExplorerAddressPage = () =>
  import('@/pages/block-explorer-page/address-page/address-page.vue')
const ExplorerPeersPage = () => import('@/pages/block-explorer-page/peers-page/peers-page.vue')
const SearchPage = () => import('@/pages/search-page/search-page.vue')
const MiniAppsPage = () => import('@/pages/mini-apps-page/mini-apps-page.vue')
const MiniAppPage = () => import('@/pages/mini-app-page/mini-app-page.vue')

/** Маршруты, для которых нужна авторизация (перед проверкой вызываем restoreSession). */
const AUTH_REQUIRED_NAMES = new Set(['limits', 'wallets', 'settings', 'my-videos'])

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),

  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage,
      meta: { title: 'Главная' },
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsPage,
      meta: { title: 'Настройки' },
    },
    {
      path: '/limits',
      name: 'limits',
      component: LimitsPage,
      meta: { title: 'Лимиты' },
    },
    {
      path: '/wallets',
      name: 'wallets',
      component: WalletsPage,
      meta: { title: 'Кошельки' },
    },
    {
      path: '/my-videos',
      name: 'my-videos',
      component: MyVideosPage,
      meta: { title: 'Мои видео' },
    },
    // Block explorer routes must come BEFORE the catch-all /:userName below —
    // otherwise the profile route greedily matches `/explorer`, `/explorer/...`.
    {
      path: '/explorer',
      name: 'explorer',
      component: BlockExplorerPage,
      meta: { title: 'Блок-эксплорер' },
    },
    {
      path: '/explorer/block/:hashOrHeight',
      name: 'explorer-block',
      component: ExplorerBlockPage,
      props: true,
      meta: { title: 'Блок' },
    },
    {
      path: '/explorer/tx/:txid',
      name: 'explorer-tx',
      component: ExplorerTxPage,
      props: true,
      meta: { title: 'Транзакция' },
    },
    {
      path: '/explorer/address/:address',
      name: 'explorer-address',
      component: ExplorerAddressPage,
      props: true,
      meta: { title: 'Адрес' },
    },
    {
      path: '/explorer/peers',
      name: 'explorer-peers',
      component: ExplorerPeersPage,
      meta: { title: 'Пиры сети' },
    },
    // /search must be declared BEFORE the catch-all /:userName so the
    // profile route doesn't greedily match it.
    {
      path: '/search',
      name: 'search',
      component: SearchPage,
      meta: { title: 'Поиск' },
    },
    // Мини-приложения — список и iframe. Также объявляем ДО catch-all /:userName.
    {
      path: '/miniapps',
      name: 'miniapps',
      component: MiniAppsPage,
      meta: { title: 'Мини-приложения' },
    },
    {
      path: '/app/:appId/:innerPath(.*)?',
      name: 'mini-app',
      component: MiniAppPage,
      props: true,
      meta: { title: 'Мини-приложение' },
    },
    {
      path: '/:userName',
      name: 'profile',
      component: ProfilePage,
      meta: { title: 'Профиль' },
    },
  ],
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

router.afterEach((to) => {
  const metaTitle = typeof to.meta?.title === 'string' ? to.meta.title : null
  setDocumentTitle(metaTitle)
})

export default router
