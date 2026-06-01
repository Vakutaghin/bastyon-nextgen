import { watch } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { getActivePinia } from 'pinia'
import { useAuthStore } from '@/blockchain'
import { setDocumentTitle } from '@/composables/use-document-title'
import { i18n, t } from '@/i18n'

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
const PostPage = () => import('@/pages/post-page/post-page.vue')

/** Маршруты, для которых нужна авторизация (перед проверкой вызываем restoreSession). */
const AUTH_REQUIRED_NAMES = new Set(['limits', 'wallets', 'settings', 'my-videos'])

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),

  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage,
      meta: { titleKey: 'routes.home' },
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsPage,
      meta: { titleKey: 'routes.settings' },
    },
    {
      path: '/limits',
      name: 'limits',
      component: LimitsPage,
      meta: { titleKey: 'routes.limits' },
    },
    {
      path: '/wallets',
      name: 'wallets',
      component: WalletsPage,
      meta: { titleKey: 'routes.wallets' },
    },
    {
      path: '/my-videos',
      name: 'my-videos',
      component: MyVideosPage,
      meta: { titleKey: 'routes.my-videos' },
    },
    // Block explorer routes must come BEFORE the catch-all /:userName below —
    // otherwise the profile route greedily matches `/explorer`, `/explorer/...`.
    {
      path: '/explorer',
      name: 'explorer',
      component: BlockExplorerPage,
      meta: { titleKey: 'routes.explorer' },
    },
    {
      path: '/explorer/block/:hashOrHeight',
      name: 'explorer-block',
      component: ExplorerBlockPage,
      props: true,
      meta: { titleKey: 'routes.explorer-block' },
    },
    {
      path: '/explorer/tx/:txid',
      name: 'explorer-tx',
      component: ExplorerTxPage,
      props: true,
      meta: { titleKey: 'routes.explorer-tx' },
    },
    {
      path: '/explorer/address/:address',
      name: 'explorer-address',
      component: ExplorerAddressPage,
      props: true,
      meta: { titleKey: 'routes.explorer-address' },
    },
    {
      path: '/explorer/peers',
      name: 'explorer-peers',
      component: ExplorerPeersPage,
      meta: { titleKey: 'routes.explorer-peers' },
    },
    // /search must be declared BEFORE the catch-all /:userName so the
    // profile route doesn't greedily match it.
    {
      path: '/search',
      name: 'search',
      component: SearchPage,
      meta: { titleKey: 'routes.search' },
    },
    // Мини-приложения — список и iframe. Также объявляем ДО catch-all /:userName.
    {
      path: '/miniapps',
      name: 'miniapps',
      component: MiniAppsPage,
      meta: { titleKey: 'routes.miniapps' },
    },
    {
      path: '/app/:appId/:innerPath(.*)?',
      name: 'mini-app',
      component: MiniAppPage,
      props: true,
      meta: { titleKey: 'routes.mini-app' },
    },
    // Отдельный пост (deep-link, в т.ч. на комментарий: /post/:txid?commentid=&parentid=).
    // ДО catch-all /:userName.
    {
      path: '/post/:txid',
      name: 'post',
      component: PostPage,
      props: true,
      meta: { titleKey: 'routes.post' },
    },
    {
      path: '/:userName',
      name: 'profile',
      component: ProfilePage,
      meta: { titleKey: 'routes.profile' },
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
  const titleKey = typeof to.meta?.titleKey === 'string' ? to.meta.titleKey : null
  setDocumentTitle(titleKey ? t(titleKey) : null)
})

// Реактивно обновлять document.title при смене языка — afterEach срабатывает
// только на навигацию, watch на locale ловит смену языка на той же странице.
watch(
  () => i18n.global.locale.value,
  () => {
    const titleKey =
      typeof router.currentRoute.value.meta?.titleKey === 'string'
        ? router.currentRoute.value.meta.titleKey
        : null
    setDocumentTitle(titleKey ? t(titleKey) : null)
  }
)

export default router
