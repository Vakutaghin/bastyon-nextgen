<template>
  <Tooltip :title="tooltip" placement="bottom">
    <SC_WidthToggleWrapper
      role="button"
      tabindex="0"
      :aria-label="tooltip"
      :aria-pressed="width === 'full'"
      data-testid="header-page-width"
      @click="toggle"
      @keydown.enter="toggle"
    >
      <!-- Значок — что сделает нажатие: растянуть или собрать колонкой. -->
      <PageWidthLimitedIcon v-if="width === 'full'" />
      <PageWidthFullIcon v-else />
    </SC_WidthToggleWrapper>
  </Tooltip>
</template>

<script setup lang="ts">
// Ширина страницы в шапке: колонкой по центру или во весь экран. Скрыть
// кнопку можно в настройках («Общие» или «Шапка и меню»).

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Tooltip } from 'ant-design-vue'
import { PageWidthFullIcon, PageWidthLimitedIcon } from '@/components/icons'
import { usePageWidth } from '@/composables/use-page-width'
import { SC_WidthToggleWrapper } from './styled'

const { t } = useI18n()
const { width, toggle } = usePageWidth()

const tooltip = computed<string>(() =>
  width.value === 'full' ? t('header.pageWidthLimited') : t('header.pageWidthFull')
)
</script>
