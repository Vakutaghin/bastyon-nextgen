<template>
  <SC_ContextLink
    type="button"
    :class="{ 'icon-only': !label }"
    :aria-label="label ? undefined : t('help.contextLink')"
    :title="label ? undefined : t('help.contextLink')"
    @click="help.openTopic(topic)"
  >
    <QuestionCircleOutlined />
    <span v-if="label">{{ label }}</span>
  </SC_ContextLink>
</template>

<script setup lang="ts">
// Контекстная справка: «?» рядом со сложным местом открывает статью в боковой
// панели, не уводя с экрана. `topic` — имя файла статьи в help/<язык>/ без
// .md; тест содержимого проверяет, что такая статья есть.
import { useI18n } from 'vue-i18n'
import { QuestionCircleOutlined } from '@/components/icons'
import { useHelpStore } from '@/stores/help-store'
import { SC_ContextLink } from './styled'

defineProps<{
  topic: string
  /** Подпись рядом со знаком вопроса; без неё — только значок. */
  label?: string
}>()

const { t } = useI18n()
const help = useHelpStore()
</script>
