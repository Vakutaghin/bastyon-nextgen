<template>
  <SC_OfflineBanner v-if="visible" role="status" data-testid="offline-banner">
    <WifiOffIcon />
    <span>{{ t('offlineVideo.noNetwork') }}</span>
    <router-link :to="to">{{ t('offlineVideo.downloadsLink') }}</router-link>
  </SC_OfflineBanner>
</template>

<script setup lang="ts">
// «Нет сети · Скачанное» на ленте и в разделах «Видео» и «Аудио»: без сети
// смотреть можно скачанное.

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { WifiOffIcon } from '@/components/icons'
import { useOnline } from '@/composables/use-online'
import { useAuthStore } from '@/blockchain/store/auth-store'
import { useOfflineVideosStore } from '@/stores/offline-videos-store'
import { SC_OfflineBanner } from './offline-video.styled'

const props = withDefaults(defineProps<{ kind?: 'video' | 'audio' }>(), { kind: 'video' })

const { t } = useI18n()
const online = useOnline()
const auth = useAuthStore()
const store = useOfflineVideosStore()

const visible = computed(() => !online.value && auth.isUserAuthenticated && store.available)
const to = computed(() => (props.kind === 'audio' ? '/audio/downloads' : '/video/downloads'))
</script>
