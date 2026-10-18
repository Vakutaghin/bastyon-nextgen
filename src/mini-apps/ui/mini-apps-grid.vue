<template>
  <div>
    <SC_Search>
      <InputSearch v-model:value="search" :placeholder="t('miniapps.searchPlaceholder')" />
    </SC_Search>

    <SC_Categories v-if="categoryChips.length > 0">
      <SC_CategoryChip
        :class="{ active: activeCategory === null }"
        type="button"
        @click="activeCategory = null"
      >
        {{ t('miniapps.allCategories') }}
      </SC_CategoryChip>
      <SC_CategoryChip
        v-for="id in categoryChips"
        :key="id"
        :class="{ active: activeCategory === id }"
        type="button"
        @click="toggleCategory(id)"
      >
        {{ t(`miniapps.categories.${id}`) }}
      </SC_CategoryChip>
    </SC_Categories>

    <SC_Error v-if="error">
      {{ t('miniapps.catalogLoadFailed', { message: error.message }) }}
    </SC_Error>

    <!-- Каталог из RPC getapps, сначала популярные -->
    <SC_Section v-if="filteredRemote.length > 0">
      <SC_SectionTitle>{{ t('miniapps.sectionPopular') }}</SC_SectionTitle>
      <SC_Grid>
        <CardItem
          v-for="entry in filteredRemote"
          :key="'r:' + entry.id"
          :id="entry.id"
          :name="entry.name"
          :description="entry.description"
          :icon="entry.icon ?? ''"
          :is-fav="favStore.isFavorite(entry.id)"
          @open="openRemote(entry)"
          @toggle-favorite="toggleFavRemote(entry)"
        />
      </SC_Grid>

      <SC_LoadMore v-if="hasMore">
        <SC_LoadMoreBtn type="button" :disabled="isLoading" @click="loadMore">
          {{ isLoading ? t('miniapps.loading') : t('miniapps.loadMore') }}
        </SC_LoadMoreBtn>
      </SC_LoadMore>
    </SC_Section>
    <SC_Empty v-else-if="isLoading">{{ t('miniapps.loading') }}</SC_Empty>

    <!-- Встроенные в Bastyon -->
    <SC_Section v-if="filteredBuiltIn.length > 0">
      <SC_SectionTitle>{{ t('miniapps.sectionBuiltIn') }}</SC_SectionTitle>
      <SC_Grid>
        <CardItem
          v-for="app in filteredBuiltIn"
          :key="'i:' + app.manifest.id"
          :id="app.manifest.id"
          :name="app.manifest.name"
          :description="installedDescription(app)"
          :icon="app.icon"
          :is-fav="favStore.isFavorite(app.manifest.id)"
          @open="openInstalled(app.manifest.id)"
          @toggle-favorite="toggleFavInstalled(app)"
        />
      </SC_Grid>
    </SC_Section>

    <!-- Загруженные самим пользователем (S51) -->
    <SC_Section v-if="filteredLocal.length > 0">
      <SC_SectionTitle>{{ t('miniapps.sectionLocal') }}</SC_SectionTitle>
      <SC_Grid>
        <CardItem
          v-for="app in filteredLocal"
          :key="'l:' + app.manifest.id"
          :id="app.manifest.id"
          :name="app.manifest.name"
          :description="installedDescription(app)"
          :icon="app.icon"
          :is-fav="favStore.isFavorite(app.manifest.id)"
          :can-delete="true"
          @open="openInstalled(app.manifest.id)"
          @toggle-favorite="toggleFavInstalled(app)"
          @remove="askRemove(app)"
        />
      </SC_Grid>
    </SC_Section>

    <SC_Empty v-if="nothingShown">
      {{ search || activeCategory ? t('miniapps.nothingFound') : t('miniapps.catalogEmpty') }}
    </SC_Empty>

    <SC_Footer>
      <SC_FooterLink v-if="shelfStore.hidden" type="button" @click="shelfStore.setHidden(false)">
        {{ t('miniapps.shelfShowAgain') }}
      </SC_FooterLink>
      <SC_FooterLink type="button" @click="sideloadOpen = true">
        {{ t('miniapps.sideloadButton') }}
      </SC_FooterLink>
    </SC_Footer>

    <SideloadModal :open="sideloadOpen" @close="sideloadOpen = false" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Modal } from 'ant-design-vue'
import { useAppsStore } from '@/mini-apps/store/apps-store'
import { useFavoriteMiniAppsStore } from '@/mini-apps/store/favorites-store'
import { useServicesShelfStore } from '@/mini-apps/store/shelf-store'
import {
  BUILT_IN_CATEGORIES,
  MINI_APP_CATEGORIES,
  type MiniAppCategoryId,
} from '@/mini-apps/catalog/categories'
import { useRemoteApps } from './use-remote-apps'
import CardItem from './mini-apps-grid-card.vue'
import SideloadModal from './sideload-modal.vue'
import InputSearch from '@/components/input-search/input-search.vue'
import type { RemoteAppEntry } from '@/mini-apps/registry/remote-registry'
import type { InstalledApp } from '@/mini-apps/types/app'
import { getBuiltInIconUrl } from '@/mini-apps/registry/built-in'
import {
  SC_Search,
  SC_Categories,
  SC_CategoryChip,
  SC_Section,
  SC_SectionTitle,
  SC_Grid,
  SC_LoadMore,
  SC_LoadMoreBtn,
  SC_Empty,
  SC_Error,
  SC_Footer,
  SC_FooterLink,
} from './mini-apps-grid.styled'

const router = useRouter()
const { t, te, locale } = useI18n()
const appsStore = useAppsStore()
const favStore = useFavoriteMiniAppsStore()
const shelfStore = useServicesShelfStore()
const sideloadOpen = ref(false)

onMounted(() => {
  void favStore.init()
  void shelfStore.load()
})

// «Установленные» = built-in + local. Каталог не должен повторно показывать их,
// но remote-session app (открытая через каталог в этой сессии) пусть остаётся в каталоге.
const persistedIds = computed(() => new Set(appsStore.forGrid.map((a) => a.manifest.id)))

const {
  search,
  items: remoteItems,
  hasMore,
  isLoading,
  error,
  loadMore,
  activeCategory,
  availableCategories,
  toggleCategory,
} = useRemoteApps({ isHidden: (entry) => persistedIds.value.has(entry.id) })

const matchesSearch = (...texts: string[]): boolean => {
  if (!search.value) return true
  const q = search.value.toLowerCase()
  return texts.some((text) => text.toLowerCase().includes(q))
}

/** Описание встроенного — своё, короткое: в их манифестах тексты не про них. */
const BUILT_IN_DESCRIPTION_KEYS: Readonly<Record<string, string>> = {
  'barteron.pocketnet.app': 'barteron',
  'app.pocketnet.docs': 'docs',
  'app.pocketnet.blockexplorer': 'blockExplorer',
  'p2p.pkoin.app': 'pkoinExchange',
  'swipelux.app': 'swipelux',
  'wpkoin.app': 'wpkoin',
}

function installedDescription(app: InstalledApp): string {
  const key = BUILT_IN_DESCRIPTION_KEYS[app.manifest.id]
  if (key && te(`miniapps.builtInDescriptions.${key}`)) {
    return t(`miniapps.builtInDescriptions.${key}`)
  }
  const lang = String(locale.value).slice(0, 2)
  return app.manifest.descriptions[lang] || app.manifest.description || ''
}

const visibleInstalled = computed(() =>
  appsStore.forGrid.filter((app) => {
    if (!matchesSearch(app.manifest.name, installedDescription(app))) return false
    if (!activeCategory.value) return true
    return BUILT_IN_CATEGORIES[app.manifest.id] === activeCategory.value
  })
)
const filteredBuiltIn = computed(() => visibleInstalled.value.filter((a) => a.source !== 'local'))
const filteredLocal = computed(() => visibleInstalled.value.filter((a) => a.source === 'local'))

const CATEGORY_ORDER = MINI_APP_CATEGORIES.map((c) => c.id)

/** Чипы: разделы, где есть приложения каталога или встроенные. */
const categoryChips = computed<MiniAppCategoryId[]>(() => {
  const ids = new Set<MiniAppCategoryId>(availableCategories.value)
  for (const app of appsStore.forGrid) {
    const id = BUILT_IN_CATEGORIES[app.manifest.id]
    if (id) ids.add(id)
  }
  return [...ids].sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b))
})

const filteredRemote = computed(() =>
  remoteItems.value.filter((e) => !persistedIds.value.has(e.id))
)

const nothingShown = computed(
  () => !isLoading.value && filteredRemote.value.length === 0 && visibleInstalled.value.length === 0
)

const openInstalled = (appId: string) => {
  void router.push(`/app/${encodeURIComponent(appId)}`)
}

const openRemote = (entry: RemoteAppEntry) => {
  // null → запись отклонена как импресонатор built-in (P2-13), не открываем.
  const app = appsStore.installFromRemoteEntry(entry)
  if (!app) return
  void router.push(`/app/${encodeURIComponent(entry.id)}`)
}

const toggleFavInstalled = (app: InstalledApp) => {
  void favStore.toggle({
    id: app.manifest.id,
    name: app.manifest.name,
    scope: app.scope,
    icon: app.icon || getBuiltInIconUrl(app.scope),
  })
}

/**
 * Удаление сайдлоад-приложения (S51). Сносит локальный оверрайд, его
 * permissions и запись в избранном — иначе манифест чужого хоста
 * перечитывается при каждом старте.
 */
const askRemove = (app: InstalledApp) => {
  Modal.confirm({
    title: t('miniapps.deleteConfirmTitle', { name: app.manifest.name }),
    content: t('miniapps.deleteConfirmContent'),
    okText: t('miniapps.deleteApp'),
    cancelText: t('miniapps.cancel'),
    okType: 'danger',
    centered: true,
    onOk: async () => {
      await appsStore.uninstall(app.manifest.id)
      await favStore.remove(app.manifest.id)
    },
  })
}

const toggleFavRemote = (entry: RemoteAppEntry) => {
  void favStore.toggle({
    id: entry.id,
    name: entry.name,
    scope: entry.scope,
    icon: entry.icon ?? getBuiltInIconUrl(entry.scope),
  })
}
</script>
