<template>
  <SC_EmbedState v-if="isInvalidTxid">{{ t('postPage.notFound') }}</SC_EmbedState>
  <SC_EmbedState v-else-if="isLoading">{{ t('postPage.loading') }}</SC_EmbedState>
  <SC_EmbedState v-else-if="isMissing">{{ t('postPage.notFound') }}</SC_EmbedState>
  <SC_EmbedState v-else-if="isError">{{ t('postPage.error') }}</SC_EmbedState>

  <SC_Embed v-else-if="post" @click="onEmbedClick">
    <SC_EmbedHeader :href="profileUrl" target="_top" rel="noopener">
      <SC_EmbedAvatar>
        <img v-if="post.author?.avatar" :src="post.author.avatar" :alt="authorName" />
        <span v-else>{{ authorInitial }}</span>
      </SC_EmbedAvatar>
      <div>
        <SC_EmbedAuthor>{{ authorName }}</SC_EmbedAuthor>
        <div v-if="formattedTime">
          <SC_EmbedTime>{{ formattedTime }}</SC_EmbedTime>
        </div>
      </div>
    </SC_EmbedHeader>

    <SC_EmbedTitle v-if="decodedTitle">{{ decodedTitle }}</SC_EmbedTitle>

    <SC_EmbedMedia v-if="post.images && post.images.length > 0">
      <PostCardImages :images="post.images" />
    </SC_EmbedMedia>
    <SC_EmbedMedia v-else-if="(post.type === 'video' || post.type === 'audio') && post.videoUrl">
      <VideoPlayer
        :video-url="post.videoUrl"
        :is-audio="post.type === 'audio'"
        :title="decodedTitle || authorName || 'Bastyon'"
        :artist="authorName"
      />
    </SC_EmbedMedia>

    <PostCardContent :post="post" :show-full="true" />

    <SC_EmbedFooter>
      <SC_EmbedCta :href="postUrl" target="_top" rel="noopener">
        {{ t('embed.viewOnBastyon') }}
      </SC_EmbedCta>
    </SC_EmbedFooter>
  </SC_Embed>

  <!-- Галерея внутри embed: без неё клик по картинке ничего не делал (N33). -->
  <ImageGallery
    v-if="post?.images?.length"
    v-model:visible="isGalleryOpen"
    :images="post.images"
    :initial-index="galleryIndex"
    @hide="closeGallery"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { ImageGallery } from '@/components/image-gallery'
import { useModalStore } from '@/stores/modal-store'
import { useI18n } from 'vue-i18n'
import PostCardContent from '@/b-components/content/post-card/components/post-card-content/post-card-content.vue'
import PostCardImages from '@/b-components/content/post-card/components/post-card-images/post-card-images.vue'
import VideoPlayer from '@/b-components/content/video-player/video-player.vue'
import { usePostByTxid } from '@/b-components/messenger/components/post-embed/use-post-by-txid'
import { safeDecode } from '@/helpers/content/safe-decode'
import { publicShareOrigin } from '@/helpers/common/share-origin'
import {
  SC_Embed,
  SC_EmbedHeader,
  SC_EmbedAvatar,
  SC_EmbedAuthor,
  SC_EmbedTime,
  SC_EmbedTitle,
  SC_EmbedMedia,
  SC_EmbedFooter,
  SC_EmbedCta,
  SC_EmbedState,
} from './embed-post-page.styled'

const route = useRoute()
const { t, locale } = useI18n()
const modalStore = useModalStore()

const txid = computed<string>(() =>
  typeof route.params.txid === 'string' ? route.params.txid : ''
)
const { post, isLoading, isMissing, isError } = usePostByTxid(txid)

/** Битый txid: запрос даже не стартует, и раньше это был пустой iframe (N33). */
const isInvalidTxid = computed<boolean>(() => !/^[a-f0-9]{64}$/i.test(txid.value))

const isGalleryOpen = computed<boolean>({
  get: () => modalStore.imageGallery.isOpen,
  set: (value) => {
    if (!value) modalStore.closeImageGallery()
  },
})
const galleryIndex = computed<number>(() => modalStore.imageGallery.index)
function closeGallery(): void {
  modalStore.closeImageGallery()
}

// og:url и ссылки на профиль в embed читают внешние потребители (S20).
const origin = publicShareOrigin()

const authorName = computed<string>(
  () => post.value?.author?.name || post.value?.author?.address || ''
)
const authorInitial = computed<string>(() => authorName.value.charAt(0).toUpperCase() || '?')

const profileUrl = computed<string>(() => {
  const a = post.value?.author
  const handle = a?.name || a?.address
  return handle ? `${origin}/${handle}` : origin
})

const postUrl = computed<string>(() => {
  const p = post.value
  const id = String(p?.txid || p?.hash || p?.id || '')
  return id ? `${origin}/post/${id}` : origin
})

// post-mapper уже декодирует заголовок; повторный safeDecode — для старых
// дважды кодированных записей (идемпотентен на чистом тексте).
const decodedTitle = computed<string>(() => safeDecode(post.value?.title || ''))

/**
 * Клик по внутренней ссылке внутри embed (меншен, тег) открывал полное
 * приложение ПРЯМО В IFRAME на чужом сайте — с восстановленной сессией
 * посетителя (S67). Уводим такие переходы в верхнее окно, на публичный домен.
 */
function onEmbedClick(event: MouseEvent): void {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return
  const link = (event.target as HTMLElement | null)?.closest('a') as HTMLAnchorElement | null
  if (!link) return
  const href = link.getAttribute('href') ?? ''
  if (!href.startsWith('/')) return
  event.preventDefault()
  window.open(`${origin}${href}`, '_top', 'noopener')
}

const formattedTime = computed<string>(() => {
  const ts = Number(post.value?.time)
  if (!ts) return ''
  const ms = ts < 1e12 ? ts * 1000 : ts
  return new Date(ms).toLocaleDateString(locale.value)
})
</script>
