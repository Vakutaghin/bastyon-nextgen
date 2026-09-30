<template>
  <!-- Голосовой ввод в поле: кнопка есть только в десктопе на подходящем
       процессоре. Модель и окно скачивания — общие (voice-model-modal). -->
  <Tooltip v-if="usable" :title="tooltip" placement="top" :mouse-enter-delay="0.3">
    <SC_DictationButton
      ref="buttonRef"
      type="button"
      :class="{ active, speaking }"
      :aria-label="tooltip"
      :aria-pressed="active"
      :disabled="disabled"
      @mousedown.prevent
      @click="toggle"
    >
      <LoadingOutlined v-if="busy" spin />
      <SC_Bars v-else-if="active" :class="{ loading }">
        <SC_Bar />
        <SC_Bar />
        <SC_Bar />
        <SC_Bar />
      </SC_Bars>
      <DictationIcon v-else />
    </SC_DictationButton>
  </Tooltip>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Tooltip } from 'ant-design-vue'

import { DictationIcon, LoadingOutlined } from '@/components/icons'
import { useVoiceDictation } from '@/composables/use-voice-dictation'
import { SC_Bar, SC_Bars, SC_DictationButton } from './styled'

type TextField = HTMLTextAreaElement | HTMLInputElement

const props = defineProps<{
  /** Поле, куда вставлять текст. */
  getElement: () => TextField | null
  /** Язык речи — коды интерфейса (ru, en, kr…). */
  language: string
  /** Поле заблокировано (пост публикуется): кнопка не нажимается, диктовка прерывается. */
  disabled?: boolean
}>()

const { t } = useI18n()

const {
  usable,
  active,
  phase,
  installing,
  installPercent,
  level,
  speaking,
  loading,
  toggle,
  cancel,
} = useVoiceDictation({
  getElement: () => props.getElement(),
  language: () => props.language,
})

// Без хвоста: дораспознанное пришло бы уже после публикации, в очищенную форму.
watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) cancel()
  }
)

const busy = computed(
  () => installing.value || phase.value === 'starting' || phase.value === 'finishing'
)

const tooltip = computed<string>(() => {
  if (installing.value) return t('voiceInput.downloading', { percent: installPercent.value })
  switch (phase.value) {
    case 'starting':
      return t('voiceInput.starting')
    case 'listening':
      return loading.value ? t('voiceInput.preparing') : t('voiceInput.stop')
    case 'finishing':
      return t('voiceInput.finishing')
    default:
      return t('voiceInput.start')
  }
})

// Громкость — в CSS-переменную кнопки: полоски тянутся по ней (styled.ts).
const buttonRef = ref<HTMLElement | { $el?: HTMLElement } | null>(null)
watch(level, (value) => {
  const r = buttonRef.value
  const el = r instanceof HTMLElement ? r : (r?.$el ?? null)
  el?.style.setProperty('--level', value.toFixed(2))
})
</script>
