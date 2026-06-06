<template>
  <SC_Related v-if="videos.length > 0">
    <SC_RelatedTitle>{{ t('relatedVideos.title') }}</SC_RelatedTitle>
    <SC_RelatedList>
      <SC_RelatedItem
        v-for="video in videos"
        :key="video.txid || video.hash || video.id"
        type="button"
        @click="open(video)"
      >
        <SC_RelatedThumb>
          <SoundOutlined v-if="video.type === 'audio'" />
          <PlayCircleOutlined v-else />
        </SC_RelatedThumb>
        <SC_RelatedInfo>
          <SC_RelatedName>{{ titleOf(video) }}</SC_RelatedName>
          <SC_RelatedMeta>{{ video.author?.name || video.author?.address }}</SC_RelatedMeta>
        </SC_RelatedInfo>
      </SC_RelatedItem>
    </SC_RelatedList>
  </SC_Related>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { PlayCircleOutlined, SoundOutlined } from '@ant-design/icons-vue'
import { useRelatedVideos } from '@/composables/use-related-videos'
import type { AdaptedPost } from '@/composables/use-feed'
import {
  SC_Related,
  SC_RelatedTitle,
  SC_RelatedList,
  SC_RelatedItem,
  SC_RelatedThumb,
  SC_RelatedInfo,
  SC_RelatedName,
  SC_RelatedMeta,
} from './styled'

const props = defineProps<{ authorAddress: string; excludeTxid: string }>()

const { t } = useI18n()
const router = useRouter()

const { videos } = useRelatedVideos(
  () => props.authorAddress,
  () => props.excludeTxid
)

function titleOf(video: AdaptedPost): string {
  const raw = video.title || ''
  let title = raw
  if (/%[0-9A-Fa-f]{2}/.test(raw)) {
    try {
      title = decodeURIComponent(raw.replace(/\+/g, ' '))
    } catch {
      title = raw
    }
  }
  return title.trim() || t('relatedVideos.untitled')
}

function open(video: AdaptedPost): void {
  const id = String(video.txid || video.hash || video.id || '')
  if (id) router.push(`/post/${id}`)
}
</script>
