<template>
  <SC_Activity
    v-if="shown"
    role="status"
    :title="label"
    :aria-label="label"
    data-testid="messenger-activity"
    :data-activity="shown"
  >
    <SC_ActivitySpinner aria-hidden="true" />
    <SC_ActivityText v-if="scope === 'list'">{{ label }}</SC_ActivityText>
  </SC_Activity>
</template>

<script setup lang="ts">
// Значок «догружается» в шапке: у списка — с подписью, как «Обновление…» в
// Telegram, у открытого чата — только значок, подпись в подсказке.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMessengerStore } from '../../store'
import type { MessengerActivity } from '../../lib/messenger-activity'
import { SC_Activity, SC_ActivitySpinner, SC_ActivityText } from './styled'

/** Короткие загрузки (список из кэша и ответ сервера через миг) не мигают значком. */
const SHOW_DELAY_MS = 400

const props = defineProps<{ scope: 'list' | 'chat' }>()

const { t } = useI18n()
const store = useMessengerStore()

const activity = computed<MessengerActivity | null>(() =>
  props.scope === 'chat' ? store.chatActivity : store.listActivity
)

const shown = ref<MessengerActivity | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null

watch(
  activity,
  (next) => {
    if (timer) clearTimeout(timer)
    timer = null
    // Уже на экране — меняем подпись сразу; погасло — сразу прячем.
    if (!next || shown.value) {
      shown.value = next
      return
    }
    timer = setTimeout(() => {
      timer = null
      shown.value = activity.value
    }, SHOW_DELAY_MS)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})

const label = computed<string>(() => (shown.value ? t(`messenger.activity.${shown.value}`) : ''))
</script>
