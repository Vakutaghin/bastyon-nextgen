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
  AppstoreOutlined
} from '@ant-design/icons-vue'

import { useFiltersStore } from '@/stores/filters-store'
import { useAuthStore } from '@/blockchain'
import { SC_Tabs, SC_TabsItem, SC_TabsLabel } from './styled'


export const sidebarTabsOptions = defineComponent({
  name: 'SidebarTabs',
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
    SC_Tabs,
    SC_TabsItem,
    SC_TabsLabel
  },
  emits: ['tab-changed'],
  setup(_p, { emit }) {
    const filtersStore = useFiltersStore()
    const authStore = useAuthStore()
    const router = useRouter()
    const route = useRoute()

    const tabsData = computed(() => filtersStore.tabs)

    const pendingTab = ref<number | null>(null)

    watch(() => authStore.isUserAuthenticated, (isAuthorized) => {
      filtersStore.updateTabsAvailability(isAuthorized)

      if (isAuthorized && pendingTab.value === 2) {
        selectTab(2)
        pendingTab.value = null
      }
    }, { immediate: true })

    watch(() => route.path, (path) => {
      if (path === '/') {
        // If back to home, restore tab based on feedMode?
        // filtersStore usually keeps state, so it might be fine.
      }
    })

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

      // Обновляем URL параметр
      if (tabId === 2) {
        updateUrlParam('subscriptions')
      } else if (tabId === 3) {
        updateUrlParam('video')
      } else if (tabId === 4) {
        updateUrlParam('audio')
      } else if (tabId === 5) {
        updateUrlParam('article')
      } else if (tabId === 6) {
        updateUrlParam('favorites')
      } else if (tabId === 7) {
        updateUrlParam('discussed')
      } else {
        updateUrlParam(null)
      }
    }

    onMounted(() => {
      if (route.path === '/messages') {
        filtersStore.selectTab(9)
      }
    })

    return { filtersStore, tabsData, selectTab }
  }
})
