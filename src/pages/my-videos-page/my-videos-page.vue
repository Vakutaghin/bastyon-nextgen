<template>
  <!-- «Медиастудия» — как раздел «Контент» творческой студии YouTube: загрузка
       и свои ролики — из постов и на видеосерверах; плиткой или списком, с
       поиском, фильтром и порядком. Ролик открывается окном: сведения,
       обложка, статистика. -->
  <SC_MyVideosWork>
    <SC_MyVideosPage>
      <SC_Header>
        <SC_HeaderText>
          <SC_MyVideosTitle>{{ t('misc.myVideos') }}</SC_MyVideosTitle>
          <SC_Summary v-if="signedIn && videos.length">{{ summary }}</SC_Summary>
        </SC_HeaderText>
        <SC_HeaderActions>
          <Button
            v-if="signedIn"
            :loading="loading"
            :title="t('videoStudio.refresh')"
            :aria-label="t('videoStudio.refresh')"
            @click="load"
          >
            <template #icon><ReloadOutlined /></template>
          </Button>
          <Button @click="limitsOpen = true">
            <template #icon><InfoCircleOutlined /></template>
            {{ t('mediaStudio.limits.button') }}
          </Button>
          <Button type="primary" @click="uploads.openDialog()">
            <template #icon><UploadOutlined /></template>
            {{ t('videoStudio.upload') }}
          </Button>
        </SC_HeaderActions>
      </SC_Header>

      <SC_Note v-if="!signedIn">
        {{ t('videoStudio.signIn') }}
        <Button type="link" @click="modalStore.openAuthModal('login')">
          {{ t('videoStudio.signInButton') }}
        </Button>
      </SC_Note>

      <SC_Section v-else>
        <SC_Toolbar v-if="videos.length">
          <SC_Search>
            <Input
              v-model:value="search"
              allow-clear
              :placeholder="t('mediaStudio.search')"
              :aria-label="t('mediaStudio.search')"
            >
              <template #prefix><SearchOutlined /></template>
            </Input>
          </SC_Search>
          <Select
            v-model:value="filter"
            :options="filterOptions"
            :aria-label="t('mediaStudio.filterLabel')"
            :dropdown-match-select-width="false"
          />
          <Select
            v-model:value="sort"
            :options="sortOptions"
            :aria-label="t('mediaStudio.sortLabel')"
            :dropdown-match-select-width="false"
          />
          <SC_ViewSwitch role="group" :aria-label="t('mediaStudio.viewLabel')">
            <button
              v-for="option in viewOptions"
              :key="option.key"
              type="button"
              :class="{ active: view === option.key }"
              :aria-pressed="view === option.key"
              :aria-label="option.label"
              :title="option.label"
              @click="setView(option.key)"
            >
              <component :is="option.icon" />
            </button>
          </SC_ViewSwitch>
        </SC_Toolbar>

        <!-- Видеосерверы отвечают кто за секунду, кто за минуту: что пришло, уже
             в списке, а пока ждём остальных — строка загрузки. -->
        <SC_Loading v-if="loading && videos.length" role="status" data-testid="studio-loading">
          <Spin size="small" />
          {{ t('videoStudio.loadingMore') }}
        </SC_Loading>
        <Spin v-if="loading && !videos.length" />
        <SC_Note v-else-if="loaded && !videos.length && failedHosts.length" role="alert">
          {{ t('videoStudio.listFailed') }}
          <Button type="link" @click="load">{{ t('videoStudio.retry') }}</Button>
        </SC_Note>
        <SC_Note v-else-if="loaded && !videos.length">
          {{ t('videoStudio.empty') }}
        </SC_Note>
        <SC_Note v-else-if="videos.length && !shown.length">
          {{ t('mediaStudio.nothingFound') }}
          <Button type="link" @click="resetFilters">{{ t('mediaStudio.resetFilters') }}</Button>
        </SC_Note>

        <template v-if="shown.length">
          <SC_ListHead v-if="view === 'list'" aria-hidden="true">
            <span class="video">{{ t('mediaStudio.columnVideo') }}</span>
            <span>{{ t('mediaStudio.columnStatus') }}</span>
            <span>{{ t('mediaStudio.columnDate') }}</span>
            <span class="views">{{ t('mediaStudio.columnViews') }}</span>
          </SC_ListHead>
          <SC_Videos :class="view">
            <StudioVideoItem
              v-for="video in shown"
              :key="video.pointer"
              :video="video"
              :layout="view"
              :publishing="isPublishing(video)"
              :opening-txid="openingTxid"
              @details="(tab) => openDetails(video, tab)"
              @play="playingVideo = video"
              @open-post="openPost"
              @create-post="createPost(video)"
              @remove="confirmRemove(video)"
            />
          </SC_Videos>
        </template>
      </SC_Section>
    </SC_MyVideosPage>

    <VideoDetailsModal
      v-if="detailsVideo"
      :key="detailsVideo.pointer"
      :video="detailsVideo"
      :initial-tab="detailsTab"
      :publishing="isPublishing(detailsVideo)"
      @close="detailsVideo = null"
      @changed="onDetailsChanged"
      @play="playingVideo = detailsVideo"
      @open-post="openPost"
      @create-post="createPost(detailsVideo!)"
      @remove="confirmRemove(detailsVideo!)"
    />

    <UploadLimitsModal v-if="limitsOpen" @close="limitsOpen = false" />

    <StudioPlayerModal
      v-if="playingVideo"
      :key="playingVideo.pointer"
      :video="playingVideo"
      @close="playingVideo = null"
    />
  </SC_MyVideosWork>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Input, Modal, Select, Spin } from 'ant-design-vue'

import {
  AppstoreOutlined,
  InfoCircleOutlined,
  ListViewIcon,
  ReloadOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@/components/icons'
import { appToast } from '@/b-components/app-toast'
import { useModalStore } from '@/stores/modal-store'
import { useVideoUploadsStore } from '@/stores/video-uploads-store'
import { useOpenComposerWithVideo } from '@/b-components/video-studio/use-open-composer-with-video'
import { Z_INDEX } from '@/styles/design-tokens'
import { useServerVideos, type ServerVideo } from './use-server-videos'
import { fetchVideoPost } from './fetch-video-post'
import {
  loadStudioView,
  saveStudioView,
  studioTotals,
  studioVideos,
  type StudioFilter,
  type StudioSort,
  type StudioView,
} from './studio-list'
import { formatCount } from './studio-format'
import StudioVideoItem from './studio-video-item.vue'
import type { ListChanges } from './use-video-details'
import VideoDetailsModal, { type DetailsTab } from './video-details/video-details-modal.vue'
import StudioPlayerModal from './studio-player-modal.vue'
import UploadLimitsModal from './upload-limits-modal.vue'
import {
  SC_MyVideosWork,
  SC_MyVideosPage,
  SC_Header,
  SC_HeaderText,
  SC_HeaderActions,
  SC_MyVideosTitle,
  SC_Summary,
  SC_Section,
  SC_Note,
  SC_Loading,
  SC_Toolbar,
  SC_Search,
  SC_ViewSwitch,
  SC_ListHead,
  SC_Videos,
} from './my-videos-page.styled'

const { t } = useI18n()
const modalStore = useModalStore()
const uploads = useVideoUploadsStore()
const openComposer = useOpenComposerWithVideo()
const { videos, loading, loaded, failedHosts, signedIn, load, remove, patch, isPublishing } =
  useServerVideos()

onMounted(() => void load())

// Загрузка закончилась — ролик уже на сервере.
const doneCount = computed(() => uploads.jobs.filter((job) => job.status === 'done').length)
watch(doneCount, (now, before) => {
  if (now > before) void load()
})

watch(signedIn, (yes) => {
  if (yes) void load()
})

// ─── список ─────────────────────────────────────────────────────────────────

const search = ref('')
const filter = ref<StudioFilter>('all')
const sort = ref<StudioSort>('newest')
const view = ref<StudioView>(loadStudioView())

function setView(next: StudioView): void {
  view.value = next
  saveStudioView(next)
}

const shown = computed(() =>
  studioVideos(videos.value, {
    search: search.value,
    filter: filter.value,
    sort: sort.value,
    isPublishing,
  })
)

function resetFilters(): void {
  search.value = ''
  filter.value = 'all'
}

const summary = computed(() => {
  const { count, views } = studioTotals(videos.value)
  return [
    t('mediaStudio.videosCount', { n: formatCount(count) }, count),
    t('mediaStudio.viewsCount', { n: formatCount(views) }, views),
  ].join(' · ')
})

const filterOptions = computed(() => [
  { value: 'all', label: t('mediaStudio.filterAll') },
  { value: 'posted', label: t('mediaStudio.filterPosted') },
  { value: 'unposted', label: t('mediaStudio.filterUnposted') },
])

const sortOptions = computed(() => [
  { value: 'newest', label: t('mediaStudio.sortNewest') },
  { value: 'oldest', label: t('mediaStudio.sortOldest') },
  { value: 'views', label: t('mediaStudio.sortViews') },
  { value: 'name', label: t('mediaStudio.sortName') },
])

const viewOptions = computed(() => [
  { key: 'grid' as const, label: t('mediaStudio.viewGrid'), icon: AppstoreOutlined },
  { key: 'list' as const, label: t('mediaStudio.viewList'), icon: ListViewIcon },
])

// ─── окно ролика ────────────────────────────────────────────────────────────

const detailsVideo = ref<ServerVideo | null>(null)
const detailsTab = ref<DetailsTab>('details')
/** Ролик в окне плеера — обложкой, пунктом «Смотреть» или из окна ролика. */
const playingVideo = ref<ServerVideo | null>(null)
/** Окно «Лимиты загрузки» — кнопкой рядом с «Загрузить». */
const limitsOpen = ref(false)

function openDetails(video: ServerVideo, tab: DetailsTab): void {
  detailsTab.value = tab
  detailsVideo.value = video
}

/** Сохранили в окне — список показывает новое сразу, без перезагрузки. */
function onDetailsChanged(changes: ListChanges): void {
  const video = detailsVideo.value
  if (!video) return
  patch(video.pointer, changes)
  // Список могли обновить, пока окно открыто: тогда в окне прежний объект.
  Object.assign(video, changes)
}

// ─── посты ──────────────────────────────────────────────────────────────────

/** Пост, который сейчас грузится для окна поста. */
const openingTxid = ref<string | null>(null)

async function openPost(txid: string): Promise<void> {
  if (openingTxid.value) return
  openingTxid.value = txid
  try {
    const post = await fetchVideoPost(txid)
    if (!post) throw new Error('post_not_found')
    // Окно ролика стоит выше обычных окон, и пост открывался под ним. Закрываем,
    // как при «Создать пост»: поднять пост нельзя — окна из поста (репост,
    // правка) открылись бы уже под ним.
    detailsVideo.value = null
    // Окно поста типизировано под пост ленты; адаптер отдаёт тот же формат.
    modalStore.openPostModal(post as never)
  } catch {
    appToast.error({ message: t('videoStudio.openPostFailed') })
  } finally {
    openingTxid.value = null
  }
}

function createPost(video: ServerVideo): void {
  // Окно поста — поверх; окно ролика закрываем, чтобы не оставалось под ним.
  detailsVideo.value = null
  openComposer({ pointer: video.pointer, title: video.name })
}

// ─── удаление ───────────────────────────────────────────────────────────────

function confirmRemove(video: ServerVideo): void {
  const inPost = video.posted || isPublishing(video)
  Modal.confirm({
    title: t('mediaStudio.deleteTitle'),
    content: inPost ? t('mediaStudio.deletePosted') : t('mediaStudio.deleteUnposted'),
    okText: t('videoStudio.delete'),
    cancelText: t('videoStudio.cancel'),
    okButtonProps: { danger: true },
    zIndex: Z_INDEX.CONFIRM,
    onOk: () => removeVideo(video),
  })
}

async function removeVideo(video: ServerVideo): Promise<void> {
  try {
    await remove(video)
    if (detailsVideo.value?.pointer === video.pointer) detailsVideo.value = null
    appToast.success({ message: t('videoStudio.deleted') })
  } catch {
    appToast.error({ message: t('videoStudio.deleteFailed') })
  }
}
</script>
