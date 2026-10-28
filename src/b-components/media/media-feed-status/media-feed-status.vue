<template>
  <SC_Status>
    <!-- Метка заново после каждой страницы: иначе видимая метка второй раз не сработает. -->
    <div v-if="hasMore && !error && !loading" ref="sentinel" class="sentinel" aria-hidden="true" />
    <span v-if="loading" role="status">{{ t('media.loading') }}</span>
    <template v-else-if="error">
      <span role="alert">{{ t('media.loadFailed') }}</span>
      <Button size="small" @click="emit('retry')">{{ t('media.retry') }}</Button>
    </template>
    <span v-else-if="empty">{{ emptyText || t('media.empty') }}</span>
  </SC_Status>
</template>

<script setup lang="ts">
// Конец списка раздела: метка подгрузки, «Загружаем…», ошибка с «Повторить»,
// «Пока пусто».

import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from 'ant-design-vue'
import { useLoadMoreSentinel, type SentinelRef } from '@/composables/use-load-more-sentinel'
import { SC_Status } from './media-feed-status.styled'

defineProps<{
  loading: boolean
  error: boolean
  hasMore: boolean
  empty: boolean
  emptyText?: string
}>()

const emit = defineEmits<{ more: []; retry: [] }>()
const { t } = useI18n()
const sentinel: SentinelRef = ref(null)
useLoadMoreSentinel(sentinel, () => emit('more'))
</script>
