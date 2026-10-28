<template>
  <router-link v-slot="{ href, navigate }" :to="to" custom>
    <SC_Card
      :href="href"
      :class="{ square: collection.kind === 'audio' }"
      data-testid="collection-card"
      @click="navigate"
    >
      <SC_Cover>
        <img v-if="coverSrc" :src="coverSrc" alt="" loading="lazy" @error="onCoverError" />
        <SC_CoverIcon v-else>
          <AudioPlaylistIcon v-if="collection.kind === 'audio'" />
          <VideoPlaylistIcon v-else-if="collection.kind === 'video'" />
          <CollectionIcon v-else />
        </SC_CoverIcon>
        <SC_Count>
          <AudioPlaylistIcon v-if="collection.kind === 'audio'" />
          <VideoPlaylistIcon v-else-if="collection.kind === 'video'" />
          <CollectionIcon v-else />
          {{ collection.contentIds.length }}
        </SC_Count>
        <SC_State v-if="stateLabel" :class="{ failed: collection.failed }">{{
          stateLabel
        }}</SC_State>
      </SC_Cover>
      <SC_Title :title="collection.caption">{{
        collection.caption || t('media.untitled')
      }}</SC_Title>
      <SC_Meta>{{ meta }}</SC_Meta>
    </SC_Card>
  </router-link>
</template>

<script setup lang="ts">
// Плейлист или коллекция в списке: обложка (своя или превью первого
// элемента), название, сколько внутри. Своё, ещё не попавшее в блок, —
// с пометкой.

import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { AudioPlaylistIcon, CollectionIcon, VideoPlaylistIcon } from '@/components/icons'
import type { CollectionView } from '@/stores/collections-store'
import {
  SC_Card,
  SC_Count,
  SC_Cover,
  SC_CoverIcon,
  SC_Meta,
  SC_State,
  SC_Title,
} from './collection-card.styled'

const props = defineProps<{
  collection: CollectionView
  /** Подпись под названием; по умолчанию — вид и число элементов. */
  subtitle?: string
}>()

const { t } = useI18n()
const failed = ref(false)
const fallbackFailed = ref(false)

const to = computed(() => `/collection/${props.collection.txid}`)

/** Своя обложка не загрузилась — превью первого элемента, потом значок. */
const coverSrc = computed(() => {
  const c = props.collection
  if (!failed.value) return c.cover
  return !fallbackFailed.value && c.fallbackCover && c.fallbackCover !== c.cover
    ? c.fallbackCover
    : null
})
function onCoverError(): void {
  if (failed.value) fallbackFailed.value = true
  failed.value = true
}

const stateLabel = computed(() => {
  const c = props.collection
  if (c.failed) return t('collections.notInBlock')
  if (c.pending === 'delete') return t('collections.deleting')
  if (c.pending || c.queued) return t('collections.publishing')
  return ''
})

const meta = computed(
  () =>
    props.subtitle ??
    t(
      `collections.kindCount.${props.collection.kind}`,
      { n: props.collection.contentIds.length },
      props.collection.contentIds.length
    )
)
</script>
