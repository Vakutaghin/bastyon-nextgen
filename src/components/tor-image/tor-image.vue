<template>
  <img v-bind="$attrs" :src="shownSrc" :alt="alt" />
</template>

<script setup lang="ts">
// Картинка с учётом Tor-политики (V21): без Tor — обычный <img>; под Tor на
// компьютере окно само картинки не грузит (CSP), и тот же <img> берёт её через
// свою схему `bastyon-tor` — Rust забирает картинку через Tor
// (helpers/tor/tor-media-proxy). Раньше на этом месте была заглушка
// «Загрузить через Tor», и каждую картинку открывали нажатием. Атрибуты
// (class/style/loading, @load/@error) уходят на <img>.
import { computed } from 'vue'

import { useTorMedia } from '@/composables/use-tor-media'
import { torMediaUrl } from '@/helpers/tor/tor-media-proxy'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{ src: string; alt?: string }>(), { alt: '' })

const { mediaBlocked } = useTorMedia()

const shownSrc = computed<string>(() => (mediaBlocked.value ? torMediaUrl(props.src) : props.src))
</script>
