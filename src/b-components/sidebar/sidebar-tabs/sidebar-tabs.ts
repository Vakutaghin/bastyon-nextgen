import { defineComponent, watch, onMounted, computed, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  HomeOutlined,
  TeamOutlined,
  PlayCircleOutlined,
  SoundOutlined,
  FileTextOutlined,
  BookOutlined,
  StarOutlined,
  MessageOutlined,
  AppstoreOutlined,
  ShopOutlined,
} from '@ant-design/icons-vue'

const BARTERON_PATH = '/app/barteron.pocketnet.app'

import { useFiltersStore } from '@/stores/filters-store'
import { useAuthStore } from '@/blockchain'
import { SC_Tabs, SC_TabsItem, SC_TabsLabel } from './styled'

export const sidebarTabsOptions = defineComponent({
  name: 'SidebarTabs',
  props: {
    collapsed: {
      type: Boolean,
      default: false,
    },
  },
  components: {
    HomeOutlined,
    TeamOutlined,
    PlayCircleOutlined,
    SoundOutlined,
    FileTextOutlined,
    BookOutlined,
    StarOutlined,
    MessageOutlined,
    AppstoreOutlined,
    ShopOutlined,
    SC_Tabs,
    SC_TabsItem,
    SC_TabsLabel,
  },
  emits: ['tab-changed'],
  setup(_p, { emit }) {
    const filtersStore = useFiltersStore()
    const authStore = useAuthStore()
    const router = useRouter()
    const route = useRoute()

    const tabsData = computed(() => filtersStore.tabs)

    const pendingTab = ref<number | null>(null)

    watch(
      () => authStore.isUserAuthenticated,
      (isAuthorized) => {
        filtersStore.updateTabsAvailability(isAuthorized)

        if (isAuthorized && pendingTab.value === 2) {
          selectTab(2)
          pendingTab.value = null
        }
      },
      { immediate: true }
    )

    watch(
      () => route.path,
      (path) => {
        // Главная — сбрасываем активный таб на «Ленту» (id=1) если ранее был
        // miniapp-таб (8 или 9). feedMode через query сохраняется отдельно.
        if (path === '/') {
          const current = filtersStore.activeTab
          if (current === 8 || current === 9) {
            filtersStore.selectTab(1)
          }
          return
        }
        // Barteron — отдельный пин-таб
        if (path === BARTERON_PATH || path.startsWith(BARTERON_PATH + '/')) {
          filtersStore.selectTab(9)
          return
        }
        // Прочие /miniapps и /app/* — общий таб мини-приложений
        if (path === '/miniapps' || path.startsWith('/app/')) {
          filtersStore.selectTab(8)
        }
      },
      { immediate: true }
    )

    const updateUrlParam = (mode: string | null) => {
      const url = new URL(window.location.href)
      const current = url.searchParams.get('feedMode')

      if (mode === null) {
        if (current !== null) {
          url.searchParams.delete('feedMode')
          window.history.replaceState({}, '', url.toString())
        }
      } else {
        if (current !== mode) {
          url.searchParams.set('feedMode', mode)
          window.history.replaceState({}, '', url.toString())
        }
      }
    }

    const selectTab = (tabId: string | number) => {
      const tab = filtersStore.tabs.find((t: any) => t.id === tabId)
      // Не позволяем выбирать disabled вкладки
      if (tab && tab.disabled) {
        return
      }

      filtersStore.selectTab(tabId)
      emit('tab-changed', tabId)

      // Мини-приложения — отдельный route, не feed-фильтр.
      if (tabId === 8) {
        if (route.path !== '/miniapps') {
          void router.push('/miniapps')
        }
        return
      }

      // Barteron — прямой пин на конкретную миниаппу
      if (tabId === 9) {
        if (route.path !== BARTERON_PATH) {
          void router.push(BARTERON_PATH)
        }
        return
      }

      // Если уходим с /miniapps на feed-фильтр — возвращаемся на главную.
      if (route.path === '/miniapps' || route.path.startsWith('/app/')) {
        void router.push('/')
      }

      // Обновляем URL параметр
      const TAB_URL_MAPPING: Record<number, string> = {
        2: 'subscriptions',
        3: 'video',
        4: 'audio',
        5: 'article',
        6: 'favorites',
        7: 'discussed',
      }
      updateUrlParam(TAB_URL_MAPPING[tabId as number] ?? null)
    }

    onMounted(() => {
      if (route.path === '/messages') {
        filtersStore.selectTab(9)
      }
    })

    return { filtersStore, tabsData, selectTab }
  },
})
