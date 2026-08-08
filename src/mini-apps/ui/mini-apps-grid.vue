<template>
  <div>
    <SC_Search>
      <InputSearch v-model:value="search" :placeholder="t('miniapps.searchPlaceholder')" />
    </SC_Search>

    <SC_Categories v-if="availableTags.length > 0">
      <SC_CategoryChip
        :class="{ active: activeTag === null }"
        type="button"
        @click="activeTag = null"
      >
        {{ t('miniapps.allCategories') }}
      </SC_CategoryChip>
      <SC_CategoryChip
        v-for="tag in availableTags"
        :key="tag"
        :class="{ active: activeTag === tag }"
        type="button"
        @click="toggleTag(tag)"
      >
        {{ tag }}
      </SC_CategoryChip>
    </SC_Categories>

    <SC_SideloadBar>
      <SC_SideloadBtn type="button" @click="sideloadOpen = true">
        {{ t('miniapps.sideloadButton') }}
      </SC_SideloadBtn>
    </SC_SideloadBar>

    <SC_Error v-if="error">
      {{ t('miniapps.catalogLoadFailed', { message: error.message }) }}
    </SC_Error>

    <!-- Установленные (built-in + локальные) -->
    <SC_Section v-if="filteredInstalled.length > 0">
      <SC_SectionTitle>{{ t('miniapps.sectionInstalled') }}</SC_SectionTitle>
      <SC_Grid>
        <CardItem
          v-for="app in filteredInstalled"
          :key="'i:' + app.manifest.id"
          :id="app.manifest.id"
          :name="app.manifest.name"
          :icon="app.icon"
          :is-fav="favStore.isFavorite(app.manifest.id)"
          @open="openInstalled(app.manifest.id)"
          @toggle-favorite="toggleFavInstalled(app)"
        />
      </SC_Grid>
    </SC_Section>

    <!-- Каталог из RPC getapps -->
    <SC_Section v-if="filteredRemote.length > 0">
      <SC_SectionTitle>{{ t('miniapps.sectionCatalog') }}</SC_SectionTitle>
      <SC_Grid>
        <CardItem
          v-for="entry in filteredRemote"
          :key="'r:' + entry.id"
          :id="entry.id"
          :name="entry.name"
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

    <SC_Empty v-if="!isLoading && filteredInstalled.length === 0 && filteredRemote.length === 0">
      {{ search ? t('miniapps.nothingFound') : t('miniapps.catalogEmpty') }}
    </SC_Empty>

    <SideloadModal :open="sideloadOpen" @close="sideloadOpen = false" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAppsStore } from '@/mini-apps/store/apps-store'
import { useFavoriteMiniAppsStore } from '@/mini-apps/store/favorites-store'
import { useRemoteApps } from './use-remote-apps'
import CardItem from './mini-apps-grid-card.vue'
import SideloadModal from './sideload-modal.vue'
import InputSearch from '@/components/input-search/input-search.vue'
import type { RemoteAppEntry } from '@/mini-apps/registry/remote-registry'
import type { InstalledApp } from '@/mini-apps/types/app'
import { getBuiltInIconUrl } from '@/mini-apps/registry/built-in'
import {
  SC_Search,
  SC_SideloadBar,
  SC_SideloadBtn,
  SC_Categories,
  SC_CategoryChip,
  SC_Section,
  SC_SectionTitle,
  SC_Grid,
  SC_LoadMore,
  SC_LoadMoreBtn,
  SC_Empty,
  SC_Error,
} from './mini-apps-grid.styled'

const router = useRouter()
const { t } = useI18n()
const appsStore = useAppsStore()
const favStore = useFavoriteMiniAppsStore()
const sideloadOpen = ref(false)

onMounted(() => {
  void favStore.init()
})

const {
  search,
  items: remoteItems,
  hasMore,
  isLoading,
  error,
  loadMore,
  activeTag,
  availableTags,
  toggleTag,
} = useRemoteApps()

const matchesSearch = (text: string): boolean => {
  if (!search.value) return true
  return text.toLowerCase().includes(search.value.toLowerCase())
}

const filteredInstalled = computed(() => {
  return appsStore.forGrid.filter((app) => matchesSearch(app.manifest.name))
})

// «Установленные» = built-in + local. Каталог не должен повторно показывать их,
// но remote-session app (открытая через каталог в этой сессии) пусть остаётся в каталоге.
const persistedIds = computed(() => new Set(appsStore.forGrid.map((a) => a.manifest.id)))
const filteredRemote = computed(() =>
  remoteItems.value.filter((e) => !persistedIds.value.has(e.id))
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

const toggleFavRemote = (entry: RemoteAppEntry) => {
  void favStore.toggle({
    id: entry.id,
    name: entry.name,
    scope: entry.scope,
    icon: entry.icon ?? getBuiltInIconUrl(entry.scope),
  })
}
</script>
