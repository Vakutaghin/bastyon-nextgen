<template>
  <SC_Shelf v-if="visible" aria-labelledby="services-shelf-title">
    <SC_ShelfHead>
      <SC_ShelfHeadText>
        <SC_ShelfTitle id="services-shelf-title">
          <AppstoreOutlined />
          {{ t('miniapps.shelfTitle') }}
        </SC_ShelfTitle>
        <SC_ShelfHint>{{ t('miniapps.shelfHint') }}</SC_ShelfHint>
      </SC_ShelfHeadText>
      <SC_ShelfAll type="button" @click="openCatalog">
        {{ t('miniapps.shelfAll') }}
        <RightOutlined />
      </SC_ShelfAll>
      <SC_ShelfClose
        type="button"
        :title="t('miniapps.shelfHide')"
        :aria-label="t('miniapps.shelfHide')"
        @click="hide"
      >
        <CloseOutlined />
      </SC_ShelfClose>
    </SC_ShelfHead>

    <SC_ShelfRow>
      <template v-if="apps">
        <SC_ShelfTile
          v-for="app in apps"
          :key="app.id"
          type="button"
          :title="app.description || app.name"
          @click="open(app)"
        >
          <SC_ShelfIcon>
            <img
              v-if="app.icon && !brokenIcons.has(app.id)"
              :src="app.icon"
              alt=""
              loading="lazy"
              @error="brokenIcons.add(app.id)"
            />
            <template v-else>{{ initials(app.name) }}</template>
          </SC_ShelfIcon>
          <SC_ShelfName>{{ app.name }}</SC_ShelfName>
        </SC_ShelfTile>
      </template>
      <template v-else>
        <SC_ShelfTile v-for="n in 6" :key="n" type="button" disabled aria-hidden="true">
          <SC_ShelfIcon class="skeleton" />
        </SC_ShelfTile>
      </template>
    </SC_ShelfRow>
  </SC_Shelf>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { AppstoreOutlined, CloseOutlined, RightOutlined } from '@/components/icons'
import { useAppsStore } from '@/mini-apps/store/apps-store'
import { useServicesShelfStore } from '@/mini-apps/store/shelf-store'
import { loadPopularApps } from '@/mini-apps/catalog/popular-apps'
import type { RemoteAppEntry } from '@/mini-apps/registry/remote-registry'
import { useTorStore } from '@/stores/tor-store'
import {
  SC_Shelf,
  SC_ShelfHead,
  SC_ShelfHeadText,
  SC_ShelfTitle,
  SC_ShelfHint,
  SC_ShelfAll,
  SC_ShelfClose,
  SC_ShelfRow,
  SC_ShelfTile,
  SC_ShelfIcon,
  SC_ShelfName,
} from './mini-apps-shelf.styled'

/**
 * Полка «Сервисы» над лентой: популярные мини-приложения в один ряд. Кнопка
 * мини-приложений в меню незаметна, а здесь сразу видно, что за ней —
 * радио, видео, игры. Скрывается крестиком, вернуть — внизу страницы «Сервисы».
 */

const router = useRouter()
const { t } = useI18n()
const appsStore = useAppsStore()
const shelfStore = useServicesShelfStore()
const torStore = useTorStore()

/** `null` — ещё грузится (показываем заготовки той же высоты, лента не прыгает). */
const apps = ref<RemoteAppEntry[] | null>(null)
const failed = ref(false)
const brokenIcons = reactive(new Set<string>())

// Под Tor мини-приложения не открываются, а иконки грузились бы напрямую с
// чужих сайтов, мимо Tor, — полки нет вовсе.
const visible = computed(
  () =>
    shelfStore.hidden === false &&
    !torStore.wantsTor &&
    !failed.value &&
    (apps.value === null || apps.value.length > 0)
)

async function ensureLoaded(): Promise<void> {
  if (apps.value !== null || failed.value) return
  try {
    apps.value = await loadPopularApps()
  } catch {
    // Каталог недоступен — полка просто не показывается.
    failed.value = true
  }
}

onMounted(() => {
  void shelfStore.load()
})

// Грузим, только когда полку покажут: её могут вернуть со страницы «Сервисы»
// или выключить Tor, пока лента открыта.
watch(
  () => shelfStore.hidden === false && !torStore.wantsTor,
  (show) => {
    if (show) void ensureLoaded()
  },
  { immediate: true }
)

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function open(entry: RemoteAppEntry): void {
  const app = appsStore.installFromRemoteEntry(entry)
  if (!app) return
  void router.push(`/app/${encodeURIComponent(entry.id)}`)
}

function openCatalog(): void {
  void router.push('/miniapps')
}

function hide(): void {
  void shelfStore.setHidden(true)
}
</script>
