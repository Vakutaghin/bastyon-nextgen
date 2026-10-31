<template>
  <Modal
    :open="!!item"
    :width="860"
    :centered="true"
    :z-index="2600"
    :footer="null"
    :destroy-on-close="true"
    @cancel="store.closePlayer()"
  >
    <SC_PlayerBody v-if="item" data-testid="offline-player">
      <VideoPlayer
        :video-url="item.meta.peertubeUrl"
        :autoplay="true"
        :is-audio="item.meta.kind === 'audio'"
        :chapters="chapters"
        :title="item.meta.title || 'Bastyon'"
        :artist="authorName"
      />
      <SC_PlayerTitle>{{ item.meta.title || t('media.untitled') }}</SC_PlayerTitle>
      <SC_PlayerAuthor>
        <img v-if="avatar" :src="avatar" alt="" />
        <span>{{ authorName }}</span>
      </SC_PlayerAuthor>
      <SC_PlayerLinks>
        <SC_Deleted v-if="item.meta.authorDeleted" data-testid="offline-author-deleted">
          <DeleteOutlined /> {{ t('offlineVideo.authorDeleted') }}
        </SC_Deleted>
        <Button v-if="online && item.meta.postId" size="small" @click="openPost">
          {{ t('offlineVideo.openPost') }}
        </Button>
        <Button size="small" danger @click="remove">{{ t('offlineVideo.remove') }}</Button>
      </SC_PlayerLinks>
      <SC_PlayerDescription v-if="description">{{ description }}</SC_PlayerDescription>
    </SC_PlayerBody>
  </Modal>
</template>

<script setup lang="ts">
// Скачанный ролик окном без ноды: всё из meta.json и папки ролика — название,
// автор, описание и главы, плеер играет файл с диска. С сетью — ссылка на пост.

import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Button, Modal } from 'ant-design-vue'
import VideoPlayer from '@/b-components/content/video-player/video-player.vue'
import { DeleteOutlined } from '@/components/icons'
import { useOnline } from '@/composables/use-online'
import { extractPlainTextFromContent, parseTimecodes } from '@/helpers/content/timecode-parser'
import { userName } from '@/services/user-names'
import { useOfflineVideosStore } from '@/stores/offline-videos-store'
import { useOfflineFile } from './use-offline-file'
import {
  SC_Deleted,
  SC_PlayerAuthor,
  SC_PlayerBody,
  SC_PlayerDescription,
  SC_PlayerLinks,
  SC_PlayerTitle,
} from './offline-video.styled'

const { t } = useI18n()
const router = useRouter()
const store = useOfflineVideosStore()
const online = useOnline()

const item = computed(() => store.opened)
const avatar = useOfflineFile(() => item.value, 'avatar.jpg')
const authorName = computed(() =>
  item.value ? userName(item.value.meta.author.address, item.value.meta.author.name) : ''
)
const description = computed(() =>
  extractPlainTextFromContent(item.value?.meta.description ?? '').trim()
)
const chapters = computed(() => parseTimecodes(item.value?.meta.description ?? ''))

// Открыли с сетью — заодно проверить, не удалил ли автор.
watch(
  () => item.value?.id,
  () => {
    if (item.value && online.value) store.noteOpened(item.value.meta.peertubeUrl)
  }
)

function openPost(): void {
  const postId = item.value?.meta.postId
  store.closePlayer()
  if (postId) void router.push(`/post/${postId}`)
}

function remove(): void {
  const id = item.value?.id
  store.closePlayer()
  if (id) void store.remove(id)
}
</script>
