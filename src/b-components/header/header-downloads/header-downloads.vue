<template>
  <!-- «Загрузки» в шапке: что качается сейчас и история скачанного. Значок
       остаётся, пока скачанное есть, — как история загрузок браузера. -->
  <Dropdown
    v-if="visible"
    v-model:open="open"
    :trigger="['click']"
    placement="bottomRight"
    :get-popup-container="popupContainer"
  >
    <SC_DownloadsButton
      v-key-activate="{ popup: true }"
      role="button"
      tabindex="0"
      aria-haspopup="true"
      :aria-expanded="open ? 'true' : 'false'"
      data-testid="header-downloads"
      :aria-label="label"
      :title="label"
      :class="{ active: activeCount > 0 }"
    >
      <OfflineRing v-if="activeCount > 0" :value="overall" />
      <DownloadOutlined v-else />
      <SC_DownloadsCount v-if="activeCount > 0">{{ activeCount }}</SC_DownloadsCount>
    </SC_DownloadsButton>

    <template #overlay>
      <SC_DownloadsMenu data-testid="header-downloads-menu" @click.stop @mousedown.stop>
        <SC_DownloadsHead>
          <DownloadOutlined />
          <SC_DownloadsTitle>{{ t('offlineVideo.downloadsTitle') }}</SC_DownloadsTitle>
          <HelpLink topic="offline-video#where" />
        </SC_DownloadsHead>

        <SC_DownloadsList role="list">
          <SC_DownloadRow
            v-for="item in shown"
            :key="item.id"
            role="listitem"
            data-testid="header-download"
            :data-status="item.state.status"
          >
            <SC_DownloadKind>
              <SoundOutlined v-if="item.meta.kind === 'audio'" />
              <PlayCircleOutlined v-else />
            </SC_DownloadKind>
            <SC_DownloadInfo>
              <SC_DownloadName>{{ item.meta.title || t('media.untitled') }}</SC_DownloadName>
              <SC_DownloadStatus>{{ statusOf(item) }}</SC_DownloadStatus>
              <SC_DownloadProgress
                v-if="isActive(item)"
                :value="receivedOf(item)"
                :max="totalOf(item) || 1"
              />
            </SC_DownloadInfo>
            <SC_DownloadActions>
              <SC_IconButton
                v-if="isActive(item)"
                type="button"
                :aria-label="t('offlineVideo.pause')"
                :title="t('offlineVideo.pause')"
                @click="store.pause(item.id)"
              >
                <PauseCircleOutlined />
              </SC_IconButton>
              <SC_IconButton
                v-else-if="item.state.status === 'paused' || item.state.status === 'failed'"
                type="button"
                :aria-label="t('offlineVideo.resume')"
                :title="t('offlineVideo.resume')"
                @click="store.resume(item.id)"
              >
                <ReloadOutlined />
              </SC_IconButton>
              <template v-else-if="item.state.status === 'done'">
                <SC_IconButton
                  type="button"
                  data-testid="header-download-play"
                  :aria-label="t('offlineVideo.play')"
                  :title="t('offlineVideo.play')"
                  @click="play(item)"
                >
                  <PlayIcon />
                </SC_IconButton>
                <SC_IconButton
                  type="button"
                  data-testid="header-download-save"
                  :disabled="saving === item.id"
                  :aria-label="t('offlineVideo.saveFile')"
                  :title="t('offlineVideo.saveFile')"
                  @click="save(item)"
                >
                  <LoadingOutlined v-if="saving === item.id" spin />
                  <SaveOutlined v-else />
                </SC_IconButton>
              </template>
            </SC_DownloadActions>
          </SC_DownloadRow>
        </SC_DownloadsList>

        <SC_DownloadsWhere>{{ t('offlineVideo.downloadsWhere') }}</SC_DownloadsWhere>
        <SC_FooterLink type="button" data-testid="header-downloads-all" @click="openAll">
          {{ t('offlineVideo.downloadsAll', { n: store.mine.length }, store.mine.length) }}
        </SC_FooterLink>
      </SC_DownloadsMenu>
    </template>
  </Dropdown>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Dropdown } from 'ant-design-vue'
import {
  DownloadOutlined,
  LoadingOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlayIcon,
  ReloadOutlined,
  SaveOutlined,
  SoundOutlined,
} from '@/components/icons'
import { appToast } from '@/b-components/app-toast'
import HelpLink from '@/b-components/help/help-link.vue'
import OfflineRing from '@/b-components/offline-video/offline-ring.vue'
import { offlineFraction, offlineStatusText } from '@/b-components/offline-video/offline-status'
import { useSaveOfflineFile } from '@/b-components/offline-video/use-save-offline-file'
import { useAuthStore } from '@/blockchain/store/auth-store'
import { useOfflineVideosStore } from '@/stores/offline-videos-store'
import type { OfflineItem } from '@/services/offline-video/types'
import { vKeyActivate } from '@/helpers/a11y/key-activate'
import {
  SC_DownloadActions,
  SC_DownloadInfo,
  SC_DownloadKind,
  SC_DownloadName,
  SC_DownloadProgress,
  SC_DownloadRow,
  SC_DownloadStatus,
  SC_DownloadsButton,
  SC_DownloadsCount,
  SC_DownloadsHead,
  SC_DownloadsList,
  SC_DownloadsMenu,
  SC_DownloadsTitle,
  SC_DownloadsWhere,
  SC_FooterLink,
  SC_IconButton,
} from './styled'

/** Сколько последних показать в выпадашке; остальное — в «Скачанном». */
const SHOWN = 8

const { t, locale } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const store = useOfflineVideosStore()
const { saving, save } = useSaveOfflineFile()
const open = ref(false)

/** Шапка закреплена: панель — в ней, чтобы не уезжала с прокруткой страницы. */
const popupContainer = (trigger: HTMLElement): HTMLElement =>
  trigger.closest<HTMLElement>('header') ?? document.body

const isActive = (item: OfflineItem): boolean =>
  item.state.status === 'downloading' || item.state.status === 'queued'

const visible = computed<boolean>(
  () => auth.isAuthenticated && store.available && store.mine.length > 0
)
const active = computed<OfflineItem[]>(() => store.mine.filter(isActive))
const activeCount = computed<number>(() => active.value.length)

/** Сначала то, что качается или ждёт, потом недавно скачанное. */
const shown = computed<OfflineItem[]>(() =>
  [...store.mine]
    .sort((a, b) => Number(b.state.status !== 'done') - Number(a.state.status !== 'done'))
    .slice(0, SHOWN)
)

const progressOf = (item: OfflineItem) => store.progress.get(item.id)
const receivedOf = (item: OfflineItem): number =>
  progressOf(item)?.received ?? item.state.received ?? 0
const totalOf = (item: OfflineItem): number =>
  progressOf(item)?.total || item.state.total || item.meta.size || 0

const overall = computed<number | null>(() =>
  offlineFraction(
    active.value.reduce((sum, i) => sum + receivedOf(i), 0),
    active.value.reduce((sum, i) => sum + totalOf(i), 0)
  )
)

const statusOf = (item: OfflineItem): string =>
  offlineStatusText(t, locale.value, item, progressOf(item))

const label = computed<string>(() =>
  activeCount.value
    ? t('offlineVideo.downloadsActive', { n: activeCount.value }, activeCount.value)
    : t('offlineVideo.downloadsTitle')
)

function play(item: OfflineItem): void {
  open.value = false
  store.openPlayer(item.id)
}

function openAll(): void {
  open.value = false
  const audioOnly = store.mine.every((i) => i.meta.kind === 'audio')
  void router.push(audioOnly ? '/audio/downloads' : '/video/downloads')
}

// Скачалось — сказать, даже если выпадашка закрыта: на телефоне об этом
// говорит уведомление службы, на компьютере и в браузере — только мы.
const seen = new Map<string, string>()
watch(
  () => store.mine.map((i) => [i.id, i.state.status, i.meta.title] as const),
  (list) => {
    for (const [id, status, title] of list) {
      const before = seen.get(id)
      if (before && before !== 'done' && status === 'done' && !open.value) {
        appToast.success({ message: t('offlineVideo.doneToast', { title: title || '' }) })
      }
      seen.set(id, status)
    }
  },
  { immediate: true }
)
</script>
