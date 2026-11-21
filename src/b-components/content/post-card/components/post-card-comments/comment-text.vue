<template>
  <!-- eslint-disable vue/no-v-text-v-html-on-component -->
  <SC_CommentText
    ref="textRef"
    :class="{ 'is-clamped': isClamped }"
    data-testid="comment-text"
    v-html="html"
  ></SC_CommentText>
  <!-- eslint-enable vue/no-v-text-v-html-on-component -->
  <SC_CommentTextToggle
    v-if="isLong"
    ref="toggleRef"
    type="button"
    data-testid="comment-text-toggle"
    :aria-expanded="expanded"
    @click.stop.prevent="toggle"
  >
    {{ expanded ? t('comments.collapse') : t('comments.showFull') }}
  </SC_CommentTextToggle>
</template>

<script setup lang="ts">
// Текст комментария под постом. Длиннее COLLAPSE_AFTER_LINES строк — свёрнут
// до COLLAPSED_LINES, чтобы длинные комментарии не растягивали ветку; кому
// надо — развернёт. Строки считаются видимые (с переносами по ширине), а не
// по \n: длинный абзац без переносов тоже занимает много места.
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { SC_CommentText, SC_CommentTextToggle } from './styled'
import { useTextOverflow, COLLAPSE_AFTER_LINES } from './composables/use-text-overflow'

const props = defineProps<{
  html: string
  /** Развернуть сразу и не сворачивать сам (переход к комментарию по ссылке). */
  forceExpanded?: boolean
}>()

const { t } = useI18n()

const textRef = ref<{ $el?: unknown } | HTMLElement | null>(null)
const toggleRef = ref<{ $el?: unknown } | HTMLElement | null>(null)
const expanded = ref(false)

const { isLong } = useTextOverflow(textRef, COLLAPSE_AFTER_LINES, () => props.html)

const isClamped = computed(() => isLong.value && !expanded.value)

watch(
  () => props.forceExpanded,
  (force) => {
    if (force) expanded.value = true
  },
  { immediate: true }
)

function elementOf(value: { $el?: unknown } | HTMLElement | null): HTMLElement | null {
  if (!value) return null
  if (value instanceof HTMLElement) return value
  return value.$el instanceof HTMLElement ? value.$el : null
}

async function toggle(): Promise<void> {
  expanded.value = !expanded.value
  if (expanded.value) return
  // Свернули прочитанный длинный комментарий — кнопка уехала вверх за край
  // экрана; без этого под пальцем оказывались чужие комментарии.
  await nextTick()
  const button = elementOf(toggleRef.value)
  if (!button) return
  const rect = button.getBoundingClientRect()
  if (rect.top < 0 || rect.bottom > window.innerHeight) {
    button.scrollIntoView({ block: 'center' })
  }
}
</script>
