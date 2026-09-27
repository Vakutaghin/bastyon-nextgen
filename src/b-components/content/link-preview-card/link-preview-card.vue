<template>
  <!-- Настройка «Предпросмотр ссылок» выключает карточку и в ленте, и в композере. -->
  <SC_LinkPreviewWrap v-if="prefs.linkPreviews" ref="root">
    <template v-if="card">
      <SC_Card :href="url" :wide="wide" target="_blank" rel="noopener noreferrer nofollow">
        <SC_Media v-if="card.image && !imageFailed" :wide="wide">
          <TorImage
            :src="card.image"
            alt=""
            loading="lazy"
            @load="onImageLoad"
            @error="imageFailed = true"
          />
        </SC_Media>
        <SC_Body>
          <SC_Site>{{ card.siteName || host }}</SC_Site>
          <SC_Title v-if="card.title">{{ card.title }}</SC_Title>
          <SC_Description v-if="card.description">{{ card.description }}</SC_Description>
        </SC_Body>
      </SC_Card>
      <SC_Remove
        v-if="removable"
        type="button"
        :aria-label="t('linkPreview.remove')"
        :title="t('linkPreview.remove')"
        @click="emit('remove')"
      >
        <CloseOutlined />
      </SC_Remove>
    </template>
  </SC_LinkPreviewWrap>
</template>

<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { CloseOutlined } from '@/components/icons'
import TorImage from '@/components/tor-image'
import type { LinkPreview } from '@/services/link-preview-service'
import { useAppPreferencesStore } from '@/stores/app-preferences-store'
import { useLinkPreviewCard } from './use-link-preview-card'
import {
  SC_Body,
  SC_Card,
  SC_Description,
  SC_LinkPreviewWrap,
  SC_Media,
  SC_Remove,
  SC_Site,
  SC_Title,
} from './styled'

const props = withDefaults(
  defineProps<{
    url: string
    /** Лента: спрашивать ноду, только когда карточка подъехала к экрану. */
    lazy?: boolean
    /** Композер: крестик «не прикреплять ссылку». */
    removable?: boolean
    /** Композер: без превью показать хотя бы адрес — ссылка всё равно уйдёт в пост. */
    fallback?: boolean
  }>(),
  { lazy: false, removable: false, fallback: false }
)
const emit = defineEmits<{ (e: 'remove'): void }>()

const { t } = useI18n()
const prefs = useAppPreferencesStore()

/** Картинка шире этого — крупно над текстом, как у старого клиента (`bigimageinlink`). */
const WIDE_IMAGE_MIN_WIDTH = 500

// ref на styled-компоненте — экземпляр компонента; наблюдать нужно его $el.
const root = ref<{ $el?: Element } | HTMLElement | null>(null)
const rootEl = computed<HTMLElement | null>(() => {
  const r = root.value
  if (!r) return null
  return r instanceof HTMLElement ? r : ((r.$el as HTMLElement | undefined) ?? null)
})
const { preview, loading } = useLinkPreviewCard(toRef(props, 'url'), rootEl, props.lazy)

const imageFailed = ref(false)
const wide = ref(false)
watch(
  () => props.url,
  () => {
    imageFailed.value = false
    wide.value = false
  }
)

const host = computed<string>(() => {
  try {
    return new URL(props.url).hostname.replace(/^www\./, '')
  } catch {
    return props.url
  }
})

const card = computed<LinkPreview | null>(() => {
  if (preview.value) return preview.value
  return props.fallback && props.url && !loading.value ? { url: props.url } : null
})

function onImageLoad(event: Event): void {
  const img = event.target as HTMLImageElement | null
  wide.value = !!img && img.naturalWidth >= WIDE_IMAGE_MIN_WIDTH
}
</script>
