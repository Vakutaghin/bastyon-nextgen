<template>
  <div>
    <SC_Search>
      <InputSearch v-model:value="search" :placeholder="t('miniapps.searchPlaceholder')" />
    </SC_Search>

    <SC_Categories v-if="availableCategories.length > 0">
      <SC_CategoryChip
        :class="{ active: activeCategory === null }"
        type="button"
        @click="activeCategory = null"
      >
        {{ t('miniapps.allCategories') }}
      </SC_CategoryChip>
      <SC_CategoryChip
        v-for="id in availableCategories"
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

      <!-- Подгрузка при прокрутке. Метка заново после каждой страницы: иначе
           видимая метка второй раз не сработает. -->
      <SC_LoadMoreSentinel
        v-if="hasMore && !loadMoreFailed && !isLoading"
        ref="loadMoreSentinel"
        data-testid="miniapps-load-more-sentinel"
        aria-hidden="true"
      />
      <SC_LoadMore v-if="loadMoreFailed">
        <SC_LoadMoreBtn type="button" :disabled="isLoading" @click="loadMore">
          {{ isLoading ? t('miniapps.loading') : t('miniapps.loadMore') }}
        </SC_LoadMoreBtn>
      </SC_LoadMore>
      <SC_LoadMoreStatus v-else-if="isLoadingMore" role="status">
        {{ t('miniapps.loading') }}
      </SC_LoadMoreStatus>
    </SC_Section>
    <SC_Empty v-else-if="isLoading">{{ t('miniapps.loading') }}</SC_Empty>

    <!-- Загруженные самим пользователем (S51) -->
    <SC_Section v-if="filteredLocal.length > 0">
      <SC_SectionTitle>{{ t('miniapps.sectionLocal') }}</SC_SectionTitle>
      <SC_Grid>
        <CardItem
          v-for="app in filteredLocal"
          :key="'l:' + app.manifest.id"
          :id="app.manifest.id"
          :name="app.manifest.name"
          :description="localDescription(app)"
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
import { useRemoteApps } from './use-remote-apps'
import { useLoadMoreSentinel, type SentinelRef } from '@/composables/use-load-more-sentinel'
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
  SC_LoadMoreStatus,
  SC_LoadMoreSentinel,
  SC_Empty,
  SC_Error,
  SC_Footer,
  SC_FooterLink,
} from './mini-apps-grid.styled'

const router = useRouter()
const { t, locale } = useI18n()
const appsStore = useAppsStore()
const favStore = useFavoriteMiniAppsStore()
const shelfStore = useServicesShelfStore()
const sideloadOpen = ref(false)

onMounted(() => {
  void favStore.init()
  void shelfStore.load()
})

// «Установленные» = built-in + local. Каталог их не повторяет, а встроенные на
// странице не показываются вовсе. Remote-session app (открытая через каталог в
// этой сессии) остаётся в каталоге.
const persistedIds = computed(() => new Set(appsStore.forGrid.map((a) => a.manifest.id)))

const {
  search,
  items: remoteItems,
  hasMore,
  isLoading,
  isLoadingMore,
  loadMoreFailed,
  error,
  loadMore,
  activeCategory,
  availableCategories,
  toggleCategory,
} = useRemoteApps({ isHidden: (entry) => persistedIds.value.has(entry.id) })

const loadMoreSentinel: SentinelRef = ref(null)
useLoadMoreSentinel(loadMoreSentinel, () => void loadMore())

const matchesSearch = (...texts: string[]): boolean => {
  if (!search.value) return true
  const q = search.value.toLowerCase()
  return texts.some((text) => text.toLowerCase().includes(q))
}

function localDescription(app: InstalledApp): string {
  const lang = String(locale.value).slice(0, 2)
  return app.manifest.descriptions[lang] || app.manifest.description || ''
}

/** Загруженные самим пользователем. Разделов у них нет: видны, пока раздел не выбран. */
const filteredLocal = computed(() =>
  appsStore.forGrid.filter(
    (app) =>
      app.source === 'local' &&
      !activeCategory.value &&
      matchesSearch(app.manifest.name, localDescription(app))
  )
)

const filteredRemote = computed(() =>
  remoteItems.value.filter((e) => !persistedIds.value.has(e.id))
)

const nothingShown = computed(
  () => !isLoading.value && filteredRemote.value.length === 0 && filteredLocal.value.length === 0
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
