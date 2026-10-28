<template>
  <SC_SectionWork>
    <SC_SectionPage :class="{ narrow: kind !== 'video' }">
      <SC_Status v-if="loading && !collection" role="status">{{
        t('collections.loading')
      }}</SC_Status>
      <SC_Status v-else-if="!collection" role="alert">
        {{ failed ? t('collections.loadFailed') : t('collections.notFound') }}
      </SC_Status>

      <template v-else>
        <SC_Header :class="{ square: kind === 'audio' }">
          <SC_HeaderCover>
            <img v-if="coverSrc" :src="coverSrc" alt="" @error="onCoverError" />
            <SC_CoverIcon v-else>
              <AudioPlaylistIcon v-if="kind === 'audio'" />
              <VideoPlaylistIcon v-else-if="kind === 'video'" />
              <CollectionIcon v-else />
            </SC_CoverIcon>
          </SC_HeaderCover>
          <SC_HeaderInfo>
            <SC_Kind>
              {{ t(`collections.kinds.${kind}`) }}
              <SC_StateBadge v-if="stateLabel" :class="{ failed: collection.failed }">{{
                stateLabel
              }}</SC_StateBadge>
            </SC_Kind>
            <SC_Name>{{ collection.caption || t('media.untitled') }}</SC_Name>
            <router-link :to="authorPath" class="author">
              <Avatar
                :src="authorAvatar"
                :alt="authorName"
                :fallback-text="authorName"
                :size="24"
              />
              <span>{{ authorName }}</span>
            </router-link>
            <SC_Meta>{{ meta }}</SC_Meta>
            <SC_Description v-if="collection.description">{{
              collection.description
            }}</SC_Description>
            <SC_Actions>
              <Button
                v-if="mediaItems.length"
                type="primary"
                data-testid="play-all"
                @click="play(false)"
              >
                <template #icon><PlayIcon /></template>
                {{ t('media.playAll') }}
              </Button>
              <Button v-if="mediaItems.length > 1" @click="play(true)">
                <template #icon><ShuffleIcon /></template>
                {{ t('media.shuffle') }}
              </Button>
              <Button @click="share">
                <template #icon><ShareAltOutlined /></template>
                {{ t('collections.share') }}
              </Button>
              <template v-if="isOwn && !collection.pending">
                <Button @click="edit">
                  <template #icon><EditOutlined /></template>
                  {{ t('collections.edit') }}
                </Button>
                <Button danger @click="confirmDelete">
                  <template #icon><DeleteOutlined /></template>
                  {{ t('collections.delete') }}
                </Button>
              </template>
              <Button v-if="isOwn && collection.failed" @click="dismissFailed">
                {{ t('collections.dismissFailed') }}
              </Button>
            </SC_Actions>
          </SC_HeaderInfo>
        </SC_Header>

        <SC_Removed v-if="removedCount">
          {{ t('collections.removedItems', { n: removedCount }, removedCount) }}
          <Button v-if="isOwn && !collection.pending" size="small" @click="dropRemoved">
            {{ t('collections.dropRemoved') }}
          </Button>
        </SC_Removed>

        <VideoGrid
          v-if="kind === 'video'"
          :posts="livePosts"
          :info="info"
          :loading="loading"
          :error="false"
          :has-more="false"
          :empty-text="t('collections.empty')"
          :source="source"
          playable
        />
        <TrackList
          v-else-if="kind === 'audio'"
          :posts="livePosts"
          :info="info"
          :source="source"
          numbered
        />
        <SC_Posts v-else>
          <PostCard v-for="post in livePosts" :key="postId(post)" :post="post" />
          <SC_Status v-if="!livePosts.length && !loading">{{ t('collections.empty') }}</SC_Status>
        </SC_Posts>
      </template>
    </SC_SectionPage>
  </SC_SectionWork>
</template>

<script setup lang="ts">
// Страница коллекции или плейлиста (`/collection/<txid>`, по ссылке прежнего
// клиента `collection?c=<txid>`). Видео — сеткой, аудио — треками с номерами,
// публикации — карточками, как лента. Удалённые элементы считаются отдельно:
// автор может убрать их одной правкой.

import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { Button, Modal } from 'ant-design-vue'
import {
  AudioPlaylistIcon,
  CollectionIcon,
  DeleteOutlined,
  EditOutlined,
  PlayIcon,
  ShareAltOutlined,
  ShuffleIcon,
  VideoPlaylistIcon,
} from '@/components/icons'
import Avatar from '@/components/avatar/avatar.vue'
import PostCard from '@/b-components/content/post-card/post-card.vue'
import VideoGrid from '@/b-components/media/video-grid/video-grid.vue'
import TrackList from '@/b-components/media/track-list/track-list.vue'
import { appToast } from '@/b-components/app-toast'
import { useAuthStore } from '@/blockchain'
import { useMediaLibrary } from '@/composables/use-media-library'
import { usePlayback } from '@/composables/use-playback'
import { useDocumentTitle } from '@/composables/use-document-title'
import { useBlockedAuthors } from '@/composables/use-blocked-authors'
import { useCollectionEditorStore } from '@/stores/collection-editor-store'
import { draftOf, type CollectionView } from '@/stores/collections-store'
import { fetchMediaInfo, type MediaInfo } from '@/services/media/media-info'
import { formatDuration, mediaTypeOf, postId, toQueueItem } from '@/services/media/media-post'
import { userName, userAvatar } from '@/services/user-names'
import { copyText } from '@/helpers/common/clipboard'
import { publicCollectionUrl } from '@/helpers/common/share-origin'
import { Z_INDEX } from '@/styles/design-tokens'
import type { QueueItem } from '@/stores/playback-queue-store'
import type { AdaptedPost } from '@/types/adapted-post'
import { SC_SectionPage, SC_SectionWork } from '../media-section/media-section.styled'
import {
  SC_Actions,
  SC_CoverIcon,
  SC_Description,
  SC_Header,
  SC_HeaderCover,
  SC_HeaderInfo,
  SC_Kind,
  SC_Meta,
  SC_Name,
  SC_Posts,
  SC_Removed,
  SC_StateBadge,
  SC_Status,
} from './collection-page.styled'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const editor = useCollectionEditorStore()
const { collections } = useMediaLibrary()
const { queue, playAll } = usePlayback()
const { filterBlocked } = useBlockedAuthors()

const txid = computed(() => (typeof route.params.txid === 'string' ? route.params.txid : ''))
const collection = ref<CollectionView | null>(null)
const items = shallowRef<(AdaptedPost | null)[]>([])
const info = shallowRef<Map<string, MediaInfo>>(new Map())
const loading = ref(false)
const failed = ref(false)
const coverFailed = ref(false)
const fallbackFailed = ref(false)
let generation = 0

async function load(): Promise<void> {
  const mine = ++generation
  loading.value = true
  failed.value = false
  coverFailed.value = false
  fallbackFailed.value = false
  try {
    const result = await collections.loadCollection(txid.value)
    if (mine !== generation) return
    collection.value = result?.collection ?? null
    items.value = result?.items ?? []
    const urls = items.value
      .filter((p): p is AdaptedPost => !!p && !!mediaTypeOf(p))
      .map((p) => p.videoUrl!)
    const fresh = await fetchMediaInfo(urls)
    if (mine === generation) info.value = fresh
  } catch {
    if (mine === generation) failed.value = true
  } finally {
    if (mine === generation) loading.value = false
  }
}

watch(txid, () => void load(), { immediate: true })

// Своя правка подтвердилась или ушла — показать свежее.
watch(
  () => collections.ownCollection(txid.value)?.contentIds.join(',') ?? '',
  (now, before) => {
    if (now !== before) void load()
  }
)

const kind = computed(() => collection.value?.kind ?? 'posts')

/** Своя обложка не загрузилась — превью первого элемента, потом значок. */
const coverSrc = computed(() => {
  const c = collection.value
  if (!c) return null
  if (!coverFailed.value) return c.cover
  return !fallbackFailed.value && c.fallbackCover && c.fallbackCover !== c.cover
    ? c.fallbackCover
    : null
})
function onCoverError(): void {
  if (coverFailed.value) fallbackFailed.value = true
  coverFailed.value = true
}
const livePosts = computed(() => filterBlocked(items.value.filter((p): p is AdaptedPost => !!p)))
const removedCount = computed(() => items.value.filter((p) => !p).length)
const mediaItems = computed(() =>
  livePosts.value
    .map((p) => toQueueItem(p, info.value.get(p.videoUrl ?? '')))
    .filter((x): x is QueueItem => !!x)
)

const isOwn = computed(
  () => !!collection.value && collection.value.address === authStore.getUserAddress
)
const authorName = computed(() => userName(collection.value?.address))
const authorAvatar = computed(() => userAvatar(collection.value?.address) ?? undefined)
const authorPath = computed(() => `/${collection.value?.address ?? ''}`)

const stateLabel = computed(() => {
  const c = collection.value
  if (!c) return ''
  if (c.failed) return t('collections.notInBlock')
  if (c.pending === 'delete') return t('collections.deleting')
  if (c.pending || c.queued) return t('collections.publishing')
  return ''
})

const meta = computed(() => {
  const n = collection.value?.contentIds.length ?? 0
  const parts = [t(`collections.kindCount.${kind.value}`, { n }, n)]
  const total = mediaItems.value.reduce((sum, x) => sum + (info.value.get(x.url)?.duration ?? 0), 0)
  if (total > 0) parts.push(formatDuration(total))
  return parts.join(' · ')
})

const source = computed(() => ({
  title: collection.value?.caption || t('media.untitled'),
  path: `/collection/${txid.value}`,
}))

useDocumentTitle(() => collection.value?.caption || t('collections.titleFallback'))

function play(shuffled: boolean): void {
  const list = mediaItems.value
  if (!list.length) return
  if (queue.shuffle !== shuffled) queue.toggleShuffle()
  playAll(list, shuffled ? Math.floor(Math.random() * list.length) : 0, source.value)
}

async function share(): Promise<void> {
  const ok = await copyText(publicCollectionUrl(txid.value))
  if (ok) appToast.success({ message: t('collections.linkCopied') })
}

function edit(): void {
  if (!collection.value) return
  editor.open({ mode: 'edit', kind: kind.value, rootTxid: collection.value.txid })
}

function confirmDelete(): void {
  const c = collection.value
  if (!c) return
  Modal.confirm({
    title: t('collections.deleteConfirmTitle'),
    content: t('collections.deleteConfirmText'),
    okText: t('collections.delete'),
    okType: 'danger',
    cancelText: t('collections.cancel'),
    zIndex: Z_INDEX.CONFIRM,
    onOk: async () => {
      try {
        await collections.remove(c.txid, draftOf(c))
        appToast.success({ message: t('collections.deleteSent') })
        void router.push(`/${c.address}`)
      } catch (e) {
        appToast.error({ message: e instanceof Error ? e.message : t('collections.sendFailed') })
      }
    },
  })
}

async function dropRemoved(): Promise<void> {
  const c = collection.value
  if (!c) return
  const keep = c.contentIds.filter((id, i) => items.value[i] !== null || !id)
  try {
    await collections.edit(c.txid, draftOf(c, keep))
    appToast.success({ message: t('collections.saved') })
  } catch (e) {
    appToast.error({ message: e instanceof Error ? e.message : t('collections.sendFailed') })
  }
}

function dismissFailed(): void {
  if (collection.value) collections.dismissFailed(collection.value.txid)
  void load()
}
</script>
