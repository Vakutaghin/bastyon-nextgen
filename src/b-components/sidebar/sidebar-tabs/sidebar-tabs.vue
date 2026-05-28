<template>
  <div>
    <SC_Tabs :class="{ collapsed }">
      <SC_TabsItem
        v-for="tab in tabsData"
        :key="tab.id"
        :active="tab.active"
        :disabled="tab.disabled"
        type="button"
        @click="!tab.disabled && selectTab(tab.id)"
      >
        <HomeOutlined v-if="tab.icon === 'HomeOutlined'" />
        <TeamOutlined v-else-if="tab.icon === 'TeamOutlined'" />
        <PlayCircleOutlined v-else-if="tab.icon === 'PlayCircleOutlined'" />
        <SoundOutlined v-else-if="tab.icon === 'SoundOutlined'" />
        <FileTextOutlined v-else-if="tab.icon === 'FileTextOutlined'" />
        <BookOutlined v-else-if="tab.icon === 'BookOutlined'" />
        <StarOutlined v-else-if="tab.icon === 'StarOutlined'" />
        <MessageOutlined v-else-if="tab.icon === 'MessageOutlined'" />
        <BlockOutlined v-else-if="tab.icon === 'BlockOutlined'" />
        <AppstoreOutlined v-else />
        <SC_TabsLabel v-if="!collapsed">{{ tab.name }}</SC_TabsLabel>
      </SC_TabsItem>
    </SC_Tabs>

    <!-- Закреплённые миниаппы (favorites) — управляются через звёздочки в каталоге -->
    <SidebarFavorites :collapsed="collapsed" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
  BlockOutlined,
} from '@ant-design/icons-vue'
import { useFiltersStore } from '@/stores/filters-store'
import { useAuthStore } from '@/blockchain'
import SidebarFavorites from './sidebar-favorites.vue'
import { SC_Tabs, SC_TabsItem, SC_TabsLabel } from './styled'

withDefaults(defineProps<{ collapsed?: boolean }>(), { collapsed: false })
const emit = defineEmits<{ 'tab-changed': [tabId: string | number] }>()

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
    // miniapp-таб (id=8) или эксплорер (id=9). feedMode через query
    // сохраняется отдельно.
    if (path === '/') {
      if (filtersStore.activeTab === 8 || filtersStore.activeTab === 9) {
        filtersStore.selectTab(1)
      }
      return
    }
    // /miniapps и /app/* — общий таб мини-приложений. Активная подсветка
    // конкретного pinned-аппа (включая Barteron) рендерится отдельно
    // в `sidebar-favorites.vue` по route.path.
    if (path === '/miniapps' || path.startsWith('/app/')) {
      filtersStore.selectTab(8)
      return
    }
    // /explorer и любые вложенные маршруты блок-эксплорера.
    if (path === '/explorer' || path.startsWith('/explorer/')) {
      filtersStore.selectTab(9)
    }
  },
  { immediate: true }
)

function updateUrlParam(mode: string | null): void {
  const url = new URL(window.location.href)
  const current = url.searchParams.get('feedMode')

  if (mode === null) {
    if (current !== null) {
      url.searchParams.delete('feedMode')
      window.history.replaceState({}, '', url.toString())
    }
  } else if (current !== mode) {
    url.searchParams.set('feedMode', mode)
    window.history.replaceState({}, '', url.toString())
  }
}

function selectTab(tabId: string | number): void {
  const tab = filtersStore.tabs.find((t) => t.id === tabId)
  if (tab && tab.disabled) return

  filtersStore.selectTab(tabId)
  emit('tab-changed', tabId)

  // Мини-приложения — отдельный route, не feed-фильтр.
  if (tabId === 8) {
    if (route.path !== '/miniapps') void router.push('/miniapps')
    return
  }

  // Блок-эксплорер — тоже отдельный route, как и miniapps.
  if (tabId === 9) {
    if (route.path !== '/explorer' && !route.path.startsWith('/explorer/')) {
      void router.push('/explorer')
    }
    return
  }

  // Если уходим с /miniapps, /app/* или /explorer на feed-фильтр —
  // возвращаемся на главную.
  if (
    route.path === '/miniapps' ||
    route.path.startsWith('/app/') ||
    route.path === '/explorer' ||
    route.path.startsWith('/explorer/')
  ) {
    void router.push('/')
  }

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
</script>
