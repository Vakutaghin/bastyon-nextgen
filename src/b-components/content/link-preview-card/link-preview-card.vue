<template>
  <!-- Настройка «Предпросмотр ссылок» выключает карточку и в ленте, и в композере. -->
  <SC_LinkPreviewWrap v-if="prefs.linkPreviews" ref="root">
    <!-- Картинка — квадрат слева, по нажатию открывается в просмотрщике; всё
         остальное — ссылка в новом окне (растянута на карточку, см. styled). -->
    <SC_Card v-if="card" data-testid="link-preview-card">
      <SC_Media v-if="card.image && !imageFailed">
        <TorImage
          :src="card.image"
          alt=""
          loading="lazy"
          @load="imageReady = true"
          @error="imageFailed = true"
        />
        <SC_Zoom
          v-if="imageReady"
          type="button"
          :aria-label="t('linkPreview.openImage')"
          :title="t('linkPreview.openImage')"
          @click="openImage"
        >
          <ZoomInOutlined />
        </SC_Zoom>
      </SC_Media>
      <SC_Body
        :href="url"
        :class="{ 'has-remove': removable }"
        target="_blank"
        rel="noopener noreferrer nofollow"
      >
        <SC_Site>{{ card.siteName || host }}</SC_Site>
        <SC_Title v-if="card.title">{{ card.title }}</SC_Title>
        <SC_Description v-if="card.description">{{ card.description }}</SC_Description>
      </SC_Body>
      <SC_Remove
        v-if="removable"
        type="button"
        :aria-label="t('linkPreview.remove')"
        :title="t('linkPreview.remove')"
        :disabled="disabled"
        @click="emit('remove')"
      >
        <CloseOutlined />
      </SC_Remove>
    </SC_Card>
  </SC_LinkPreviewWrap>
</template>

<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { CloseOutlined, ZoomInOutlined } from '@/components/icons'
import TorImage, { getTorImageUrl } from '@/components/tor-image'
import type { LinkPreview } from '@/services/link-preview-service'
import { useAppPreferencesStore } from '@/stores/app-preferences-store'
import { useModalStore } from '@/stores/modal-store'
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
  SC_Zoom,
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
    /** Композер: идёт публикация — крестик не нажимается. */
    disabled?: boolean
  }>(),
  { lazy: false, removable: false, fallback: false, disabled: false }
)
const emit = defineEmits<{ (e: 'remove'): void }>()

const { t } = useI18n()
const prefs = useAppPreferencesStore()
const modalStore = useModalStore()

// ref на styled-компоненте — экземпляр компонента; наблюдать нужно его $el.
const root = ref<{ $el?: Element } | HTMLElement | null>(null)
const rootEl = computed<HTMLElement | null>(() => {
  const r = root.value
  if (!r) return null
  return r instanceof HTMLElement ? r : ((r.$el as HTMLElement | undefined) ?? null)
})
const { preview, loading } = useLinkPreviewCard(toRef(props, 'url'), rootEl, props.lazy)

const imageFailed = ref(false)
/** Картинка показана: под Tor — только после нажатия на заглушку TorImage. */
const imageReady = ref(false)
watch(
  () => props.url,
  () => {
    imageFailed.value = false
    imageReady.value = false
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

/** Под Tor просмотрщику — blob уже загруженной картинки, прямой адрес заблокирован CSP. */
function openImage(): void {
  const image = card.value?.image
  if (image) modalStore.openImageGallery([getTorImageUrl(image) ?? image], 0)
}
</script>
