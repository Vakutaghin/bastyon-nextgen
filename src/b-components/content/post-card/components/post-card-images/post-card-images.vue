<template>
  <!-- Одна картинка — во всю ширину, высота по самой картинке. -->
  <SC_PostImage v-if="imageCount === 1">
    <SC_ImageWrapper :style="getImageWrapperStyle(0)" @click.stop="openImageGallery(0)">
      <TorImage
        :src="firstImage"
        :alt="t('postCard.imageAlt', { index: 1 })"
        :style="getImageStyle(0)"
        loading="lazy"
        decoding="async"
        @error="handleImageError"
        @load="(e: Event) => handleImageLoad(e, 0)"
      />
      <SC_ImageOverlay @click.stop="openImageGallery(0)">
        <SC_ZoomIconCircle>
          <ZoomInOutlined />
        </SC_ZoomIconCircle>
      </SC_ImageOverlay>
    </SC_ImageWrapper>
  </SC_PostImage>

  <!-- Несколько — сетка по пропорциям картинок, как альбом во ВКонтакте.
       Координаты плиток — inline: свои у каждой плитки каждого поста, через
       styled-пропсы это был бы отдельный CSS-класс на плитку. -->
  <SC_ImageGrid v-else-if="imageCount > 1" :style="gridStyle">
    <SC_GridTile
      v-for="({ tile, src }, idx) in cells"
      :key="idx"
      :style="tileStyle(tile)"
      @click.stop="openImageGallery(idx)"
    >
      <SC_GridCell :style="cellStyle(tile)">
        <TorImage
          :src="src"
          :alt="t('postCard.imageAlt', { index: idx + 1 })"
          loading="lazy"
          decoding="async"
          @error="(e: Event) => handleGridError(e, idx)"
          @load="(e: Event) => handleGridLoad(e, idx)"
        />
        <SC_GridMore v-if="hiddenCount > 0 && idx === cells.length - 1">
          +{{ hiddenCount }}
        </SC_GridMore>
      </SC_GridCell>
    </SC_GridTile>
  </SC_ImageGrid>
</template>

<script lang="ts">
/** Пропорции уже виденных картинок, общие для всех постов: в модалке поста и
 *  после прокрутки ленты сетка сразу встаёт как надо, без перескока. */
const knownRatios = new Map<string, number>()
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ZoomInOutlined } from '@/components/icons'
import { useModalStore } from '@/stores/modal-store'
import TorImage, { getTorImageUrl } from '@/components/tor-image'
import {
  GRID_MAX_IMAGES,
  layoutImageGrid,
  type GridTile,
} from '@/helpers/content/image-grid-layout'
import {
  SC_PostImage,
  SC_ImageWrapper,
  SC_ImageOverlay,
  SC_ZoomIconCircle,
  SC_ImageGrid,
  SC_GridTile,
  SC_GridCell,
  SC_GridMore,
} from './styled'

const props = defineProps<{ images: string[] }>()

const { t } = useI18n()
const modalStore = useModalStore()

const imageAspectRatios = reactive<
  Record<number, { width: number; height: number; useContain: boolean }>
>({})

const imageCount = computed<number>(() => props.images?.length ?? 0)
const firstImage = computed<string>(() => props.images?.[0] ?? '')

function handleImageError(event: Event): void {
  const target = event.target as HTMLImageElement | null
  if (target) target.style.display = 'none'
}

function handleImageLoad(event: Event, imageIndex: number): void {
  const target = event.target as HTMLImageElement | null
  if (!target) return

  const naturalWidth = target.naturalWidth
  const naturalHeight = target.naturalHeight
  if (naturalWidth === 0 || naturalHeight === 0) return

  const aspectRatio = naturalWidth / naturalHeight
  const useContain = aspectRatio > 1 / 1.5

  imageAspectRatios[imageIndex] = { width: naturalWidth, height: naturalHeight, useContain }

  // Очень высокое изображение (портрет) в одиночной карточке — ограничиваем высоту.
  if (imageCount.value === 1 && naturalHeight > naturalWidth * 2) {
    target.style.aspectRatio = '1 / 2'
    target.style.maxHeight = '500px'
  }
}

function getImageWrapperStyle(imageIndex: number): Record<string, string> {
  const info = imageAspectRatios[imageIndex]
  if (info?.useContain) return { backgroundColor: 'var(--color-bg-tertiary)' }
  return {}
}

function getImageStyle(imageIndex: number): Record<string, string> {
  const info = imageAspectRatios[imageIndex]
  return { objectFit: info?.useContain ? 'contain' : 'cover' }
}

// ── Сетка ───────────────────────────────────────────────────────────────

/** Пока картинки грузятся, ждём остальные: каждая перестройка — скачок ленты. */
const SETTLE_MS = 1500

const shown = computed<string[]>(() => (props.images ?? []).slice(0, GRID_MAX_IMAGES))
const hiddenCount = computed<number>(() => Math.max(0, imageCount.value - GRID_MAX_IMAGES))

const ratios = ref<Array<number | undefined>>([])
const applied = ref<Array<number | undefined>>([])
let settled = false
let settleTimer: ReturnType<typeof setTimeout> | undefined

watch(
  shown,
  (urls) => {
    clearTimeout(settleTimer)
    settleTimer = undefined
    settled = false
    ratios.value = urls.map((u) => knownRatios.get(u))
    applied.value = [...ratios.value]
  },
  { immediate: true }
)

onBeforeUnmount(() => clearTimeout(settleTimer))

const layout = computed(() => layoutImageGrid(applied.value))
const cells = computed(() =>
  layout.value.tiles.map((tile, i) => ({ tile, src: shown.value[i] ?? '' }))
)

function rememberRatio(idx: number, ratio: number, url?: string): void {
  if (url) knownRatios.set(url, ratio)
  ratios.value[idx] = ratio
  if (settled || ratios.value.every((r) => r !== undefined)) {
    applied.value = [...ratios.value]
    return
  }
  settleTimer ??= setTimeout(() => {
    settled = true
    applied.value = [...ratios.value]
  }, SETTLE_MS)
}

function handleGridLoad(event: Event, idx: number): void {
  const img = event.target as HTMLImageElement | null
  if (!img?.naturalWidth || !img.naturalHeight) return
  rememberRatio(idx, img.naturalWidth / img.naturalHeight, shown.value[idx])
}

function handleGridError(event: Event, idx: number): void {
  const img = event.target as HTMLImageElement | null
  if (img) img.style.display = 'none'
  // Битая картинка — квадратная плитка, чтобы не ждать её до таймера.
  rememberRatio(idx, 1)
}

const gridStyle = computed<Record<string, string>>(() => ({
  aspectRatio: String(1 / layout.value.height),
}))

const pct = (v: number): string => `${(v * 100).toFixed(4)}%`

function tileStyle(tile: GridTile): Record<string, string> {
  const h = layout.value.height
  return { left: pct(tile.x), top: pct(tile.y / h), width: pct(tile.w), height: pct(tile.h / h) }
}

/** Зазор 2px между соседями: по 1px с каждой внутренней стороны плитки. */
function cellStyle(tile: GridTile): Record<string, string> {
  const eps = 1e-3
  const inner = (v: boolean): string => (v ? '1px' : '0')
  return {
    top: inner(tile.y > eps),
    left: inner(tile.x > eps),
    right: inner(tile.x + tile.w < 1 - eps),
    bottom: inner(tile.y + tile.h < layout.value.height - eps),
  }
}

function openImageGallery(index: number): void {
  if (props.images && props.images.length > 0) {
    // Под Tor лайтбокс получает blob-URL уже загруженных через Tor картинок;
    // незагруженные остаются заблокированными CSP — сначала клик по заглушке.
    const images = props.images.map((u) => getTorImageUrl(u) ?? u)
    modalStore.openImageGallery(images, index)
  }
}
</script>
