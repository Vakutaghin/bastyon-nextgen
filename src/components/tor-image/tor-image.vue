<template>
  <img v-if="!mediaBlocked" v-bind="$attrs" :src="src" :alt="alt" />
  <img v-else-if="blobUrl" v-bind="$attrs" :src="blobUrl" :alt="alt" />
  <SC_TorImageGate v-else type="button" :disabled="loading" :title="src" @click.stop="load">
    <SC_TorImageIcon aria-hidden="true">
      <LoadingOutlined v-if="loading" spin />
      <WarningOutlined v-else-if="failed" />
      <PictureOutlined v-else />
    </SC_TorImageIcon>
    <span>{{ label }}</span>
  </SC_TorImageGate>
</template>

<script setup lang="ts">
// Картинка с учётом Tor-политики (V21, вариант B): без Tor — обычный <img>;
// под Tor webview не грузит картинки сам (CSP), поэтому показываем заглушку
// и по клику тянем через torFetch → blob. Атрибуты (class/style/loading)
// уходят на <img>, на заглушку — нет.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { LoadingOutlined, PictureOutlined, WarningOutlined } from '@/components/icons'

import { useTorMedia } from '@/composables/use-tor-media'
import { getTorImageUrl, loadTorImage } from './tor-image-cache'
import { SC_TorImageGate, SC_TorImageIcon } from './styled'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{ src: string; alt?: string }>(), { alt: '' })
const emit = defineEmits<{ loaded: [blobUrl: string] }>()

const { t } = useI18n()
const { mediaBlocked } = useTorMedia()

const blobUrl = ref<string | undefined>(getTorImageUrl(props.src))
const loading = ref(false)
const failed = ref(false)

watch(
  () => props.src,
  (src) => {
    blobUrl.value = getTorImageUrl(src)
    failed.value = false
  }
)

const label = computed<string>(() => {
  if (loading.value) return t('torMedia.loading')
  if (failed.value) return `${t('torMedia.loadFailed')} · ${t('torMedia.retry')}`
  return t('torMedia.loadImage')
})

async function load(): Promise<void> {
  if (loading.value) return
  loading.value = true
  failed.value = false
  const src = props.src
  try {
    const url = await loadTorImage(src)
    if (props.src !== src) return
    blobUrl.value = url
    emit('loaded', url)
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}
</script>
