import { watch } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { getActivePinia } from 'pinia'
import { useAuthStore } from '@/blockchain'
import { requireAuth } from '@/composables/use-auth-gate'
import { setDocumentTitle } from '@/composables/use-document-title'
import { i18n, t } from '@/i18n'

// Lazy-loaded page components for code-splitting
const HomePage = () => import('@/pages/home-page/home-page.vue')
const ProfilePage = () => import('@/pages/profile-page/profile-page.vue')
const SettingsPage = () => import('@/pages/settings-page/settings-page.vue')
const LimitsPage = () => import('@/pages/limits-page/limits-page.vue')
const WalletsPage = () => import('@/pages/wallets-page/wallets-page.vue')
const MyVideosPage = () => import('@/pages/my-videos-page/my-videos-page.vue')
const PaidSubscriptionsPage = () =>
  import('@/pages/paid-subscriptions-page/paid-subscriptions-page.vue')
const MyFilesPage = () => import('@/pages/my-files-page/my-files-page.vue')
const MeshPage = () => import('@/pages/mesh-page/mesh-page.vue')
const BlockExplorerPage = () => import('@/pages/block-explorer-page/block-explorer-page.vue')
const ExplorerBlockPage = () => import('@/pages/block-explorer-page/block-page/block-page.vue')
const ExplorerTxPage = () => import('@/pages/block-explorer-page/tx-page/tx-page.vue')
const ExplorerAddressPage = () =>
  import('@/pages/block-explorer-page/address-page/address-page.vue')
const ExplorerNetworkPage = () =>
  import('@/pages/block-explorer-page/network-page/network-page.vue')
const SearchPage = () => import('@/pages/search-page/search-page.vue')
const TopAccountsPage = () => import('@/pages/top-accounts-page/top-accounts-page.vue')
const MiniAppsPage = () => import('@/pages/mini-apps-page/mini-apps-page.vue')
const MiniAppPage = () => import('@/pages/mini-app-page/mini-app-page.vue')
const PostPage = () => import('@/pages/post-page/post-page.vue')
const ComposePage = () => import('@/pages/compose-page/compose-page.vue')
const HelpPage = () => import('@/pages/help-page/help-page.vue')
const EmbedPostPage = () => import('@/pages/embed-post-page/embed-post-page.vue')
const VideoPage = () => import('@/pages/video-page/video-page.vue')
const AudioPage = () => import('@/pages/audio-page/audio-page.vue')
const CollectionPage = () => import('@/pages/collection-page/collection-page.vue')
const LibraryPage = () => import('@/pages/library-page/library-page.vue')
const MyCollectionsPage = () => import('@/pages/my-collections-page/my-collections-page.vue')

/** Маршруты, для которых нужна авторизация (перед проверкой вызываем restoreSession). */
const AUTH_REQUIRED_NAMES = new Set([
  'limits',
  'wallets',
  'settings',
  'my-videos',
  'paid-subscriptions',
  'my-files',
  'mesh',
  'library',
])

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),

  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage,
      // Прежние режимы ленты «Видео» и «Аудио» стали разделами.
      beforeEnter: (to) => {
        const mode = to.query.feedMode
        if (mode === 'video' || mode === 'audio') return { path: `/${mode}`, replace: true }
        return true
      },
      meta: { titleKey: 'routes.home', helpTopic: 'feed' },
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsPage,
      meta: { titleKey: 'routes.settings', helpTopic: 'settings' },
    },
    {
      path: '/limits',
      name: 'limits',
      component: LimitsPage,
      meta: { titleKey: 'routes.limits', helpTopic: 'limits' },
    },
    {
      path: '/wallets',
      name: 'wallets',
      component: WalletsPage,
      meta: { titleKey: 'routes.wallets', helpTopic: 'wallet' },
    },
    {
      path: '/my-videos',
      name: 'my-videos',
      component: MyVideosPage,
      meta: { titleKey: 'routes.my-videos', helpTopic: 'media-studio' },
    },
    {
      path: '/paid-subscriptions',
      name: 'paid-subscriptions',
      component: PaidSubscriptionsPage,
      meta: { titleKey: 'routes.paid-subscriptions', helpTopic: 'paid-subscriptions' },
    },
    {
      path: '/my-files',
      name: 'my-files',
      component: MyFilesPage,
      meta: { titleKey: 'routes.my-files', helpTopic: 'my-files' },
    },
    {
      path: '/mesh',
      name: 'mesh',
      component: MeshPage,
      meta: { titleKey: 'routes.mesh', helpTopic: 'mesh' },
    },
    // Block explorer routes must come BEFORE the catch-all /:userName below —
    // otherwise the profile route greedily matches `/explorer`, `/explorer/...`.
    {
      path: '/explorer',
      name: 'explorer',
      component: BlockExplorerPage,
      meta: { titleKey: 'routes.explorer', helpTopic: 'explorer' },
    },
    {
      path: '/explorer/block/:hashOrHeight',
      name: 'explorer-block',
      component: ExplorerBlockPage,
      props: true,
      meta: { titleKey: 'routes.explorer-block', helpTopic: 'explorer' },
    },
    {
      path: '/explorer/tx/:txid',
      name: 'explorer-tx',
      component: ExplorerTxPage,
      props: true,
      meta: { titleKey: 'routes.explorer-tx', helpTopic: 'explorer' },
    },
    {
      path: '/explorer/address/:address',
      name: 'explorer-address',
      component: ExplorerAddressPage,
      props: true,
      meta: { titleKey: 'routes.explorer-address', helpTopic: 'explorer' },
    },
    {
      path: '/explorer/network',
      name: 'explorer-network',
      component: ExplorerNetworkPage,
      meta: { titleKey: 'routes.explorer-network', helpTopic: 'explorer' },
    },
    // Прежняя страница «Пиры сети» — теперь вкладка «Сеть».
    { path: '/explorer/peers', redirect: { name: 'explorer-network' } },
    // /search must be declared BEFORE the catch-all /:userName so the
    // profile route doesn't greedily match it.
    {
      path: '/search',
      name: 'search',
      component: SearchPage,
      meta: { titleKey: 'routes.search', helpTopic: 'search' },
    },
    // Топ аккаунтов по репутации и по PKOIN. ДО catch-all /:userName.
    {
      path: '/top',
      name: 'top-accounts',
      component: TopAccountsPage,
      meta: { titleKey: 'routes.top-accounts', helpTopic: 'top-accounts' },
    },
    // Мини-приложения — список и iframe. Также объявляем ДО catch-all /:userName.
    {
      path: '/miniapps',
      name: 'miniapps',
      component: MiniAppsPage,
      meta: { titleKey: 'routes.miniapps', helpTopic: 'mini-apps' },
    },
    {
      path: '/app/:appId/:innerPath(.*)?',
      name: 'mini-app',
      component: MiniAppPage,
      props: true,
      meta: { titleKey: 'routes.mini-app', helpTopic: 'mini-apps' },
    },
    // Разделы «Видео» и «Аудио»: вкладка — в адресе (`/video/subscriptions`).
    // ДО catch-all /:userName.
    {
      path: '/video/:tab?',
      name: 'video',
      component: VideoPage,
      meta: { titleKey: 'routes.video', helpTopic: 'video-section' },
    },
    {
      path: '/audio/:tab?',
      name: 'audio',
      component: AudioPage,
      meta: { titleKey: 'routes.audio', helpTopic: 'audio-section' },
    },
    // Коллекция или плейлист. Прежний клиент ссылается на `collection?c=<txid>`.
    {
      path: '/collection/:txid',
      name: 'collection',
      component: CollectionPage,
      meta: { titleKey: 'routes.collection', helpTopic: 'collections' },
    },
    {
      path: '/collection',
      redirect: (to) => {
        const c = typeof to.query.c === 'string' ? to.query.c.toLowerCase() : ''
        return /^[0-9a-f]{64}$/.test(c) ? { path: `/collection/${c}`, query: {} } : { path: '/' }
      },
    },
    // Свои коллекции, плейлисты и личные списки — все в одном месте.
    {
      path: '/collections',
      name: 'my-collections',
      component: MyCollectionsPage,
      meta: { titleKey: 'routes.myCollections', helpTopic: 'collections' },
    },
    // Личный список: «Сохранённые», «Смотреть позже», «Моя музыка», личный плейлист.
    {
      path: '/library/:listId',
      name: 'library',
      component: LibraryPage,
      meta: { titleKey: 'routes.library', helpTopic: 'media-library' },
    },
    // Отдельный пост (deep-link, в т.ч. на комментарий: /post/:txid?commentid=&parentid=).
    // ДО catch-all /:userName.
    {
      path: '/post/:txid',
      name: 'post',
      component: PostPage,
      props: true,
      meta: { titleKey: 'routes.post', helpTopic: 'post-card' },
    },
    // Композер поста (deep-link / мобильный full-screen). ДО catch-all /:userName.
    {
      path: '/compose',
      name: 'compose',
      component: ComposePage,
      meta: { titleKey: 'routes.compose', helpTopic: 'post-composer' },
    },
    // Справка: статьи из help/<язык>/*.md, `/help` — главная. Вход не нужен:
    // справка нужнее всего до регистрации. ДО catch-all /:userName.
    {
      path: '/help/:topic?',
      name: 'help',
      component: HelpPage,
      meta: { titleKey: 'routes.help', helpTopic: 'using-help' },
    },
    // О Bastyon, частые вопросы, начало работы и PKOIN переехали в справку.
    { path: '/info/about', redirect: '/help/about' },
    { path: '/info/faq', redirect: '/help/faq' },
    { path: '/info/help', redirect: '/help/getting-started' },
    { path: '/info/howtobuy', redirect: '/help/how-to-buy-pkoin' },
    // Встраиваемая (iframe) вьюха поста — без chrome (meta.embed). ДО catch-all /:userName.
    {
      path: '/embed/post/:txid',
      name: 'embed-post',
      component: EmbedPostPage,
      meta: { titleKey: 'routes.post', embed: true },
    },
    {
      path: '/:userName',
      name: 'profile',
      component: ProfilePage,
      meta: { titleKey: 'routes.profile', helpTopic: 'profile' },
    },
  ],
})

router.beforeEach(async (to, from) => {
  if (!AUTH_REQUIRED_NAMES.has(to.name as string)) return
  const pinia = getActivePinia()
  if (!pinia) return
  const authStore = useAuthStore(pinia)
  await authStore.restoreSession()
  if (authStore.isUserAuthenticated) return
  // Гостю — окно входа, а раздел откроется после входа. Раньше гостя молча
  // уводило на ленту, и казалось, что пункт меню не работает. Переход изнутри
  // приложения отменяем: гость остаётся там, где был. По ссылке и при запуске
  // под окном входа показываем ленту.
  requireAuth(() => void router.push(to.fullPath))
  return from.matched.length > 0 ? false : { path: '/', replace: true }
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
