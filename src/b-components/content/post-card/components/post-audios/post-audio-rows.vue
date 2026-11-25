<template>
  <SC_Rows>
    <li v-for="(row, index) in shown" :key="row.url">
      <SC_Row
        type="button"
        :class="{ current: index === current }"
        :aria-label="rowLabel(index)"
        :aria-current="index === current ? 'true' : undefined"
        data-testid="post-audio-row"
        @click="emit('select', index)"
      >
        <SC_RowIcon aria-hidden="true">
          <PauseIcon v-if="index === current && playing" />
          <PlayIcon v-else-if="index === current" />
          <span v-else class="number">{{ index + 1 }}</span>
        </SC_RowIcon>
        <span class="title">{{ titleOf(index) }}</span>
        <span class="duration">{{ formatDuration(row.duration) }}</span>
      </SC_Row>
    </li>
  </SC_Rows>
  <SC_More v-if="shown.length < audios.length" type="button" @click="opened = true">
    {{ t('media.showAllParts', { n: audios.length }) }}
  </SC_More>
</template>

<script setup lang="ts">
// Записи аудио-поста строками: номер, название, длительность. Длинный список в
// ленте свёрнут; играющая запись видна всегда.

import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { PauseIcon, PlayIcon } from '@/components/icons'
import type { PostAudio } from '@/helpers/content/post-audios'
import { formatDuration } from '@/services/media/media-post'
import { SC_More, SC_Row, SC_RowIcon, SC_Rows } from './post-audios.styled'

/** Сколько строк видно в свёрнутом списке. */
const COLLAPSED = 5

const props = defineProps<{
  audios: PostAudio[]
  /** Какая запись выбрана; -1 — никакая. */
  current: number
  playing: boolean
  /** Показать весь список сразу (страница поста). */
  expanded?: boolean
}>()
const emit = defineEmits<{ select: [index: number] }>()

const { t } = useI18n()
const opened = ref(false)

// Одна лишняя строка занимает столько же, сколько «Показать все».
const collapsed = computed(
  () => !props.expanded && !opened.value && props.audios.length > COLLAPSED + 1
)
const shown = computed(() =>
  collapsed.value ? props.audios.slice(0, Math.max(COLLAPSED, props.current + 1)) : props.audios
)

function titleOf(index: number): string {
  return props.audios[index]?.title || t('media.partN', { n: index + 1 })
}

function rowLabel(index: number): string {
  const action = index === props.current && props.playing ? t('media.pause') : t('media.play')
  return `${action}: ${titleOf(index)}`
}
</script>
