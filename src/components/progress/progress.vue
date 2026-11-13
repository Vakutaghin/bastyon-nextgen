<template>
  <SC_Progress
    class="ui-progress"
    role="progressbar"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="rounded"
    :data-size="size"
    :data-status="status"
  >
    <div class="ui-progress__track">
      <div :ref="bindFill" class="ui-progress__fill" />
    </div>
    <span v-if="showInfo" class="ui-progress__info" aria-hidden="true">{{ rounded }}%</span>
  </SC_Progress>
</template>

<script setup lang="ts">
// Линейная полоса прогресса вместо antd Progress. Цвет заполнения —
// `--ui-progress-color` (по умолчанию акцент), подложки — `--ui-progress-track`.
import { useProgress } from './progress'
import type { ProgressProps } from './types'
import { SC_Progress } from './styled'

const p = withDefaults(defineProps<ProgressProps>(), {
  percent: 0,
  showInfo: true,
  status: 'normal',
  size: 'default',
})

const { rounded, bindFill } = useProgress(p)
</script>
