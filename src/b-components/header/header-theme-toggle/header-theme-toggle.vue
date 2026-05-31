<template>
  <Tooltip :title="tooltip" placement="bottom">
    <SC_ThemeToggleWrapper
      role="button"
      :aria-label="tooltip"
      :aria-pressed="isDark"
      @click="toggle"
    >
      <BulbFilled v-if="isDark" :style="ICON_SIZE_XL" />
      <BulbOutlined v-else :style="ICON_SIZE_XL" />
    </SC_ThemeToggleWrapper>
  </Tooltip>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Tooltip } from 'ant-design-vue'
import { BulbOutlined, BulbFilled } from '@ant-design/icons-vue'
import { useTheme } from '@/composables/use-theme'
import { ICON_SIZE_XL } from '@/styles/icon-styles'
import { SC_ThemeToggleWrapper } from './styled'

const { t } = useI18n()

const { isDark, setMode } = useTheme()

// Бинарный переключатель для хедера: всегда задаёт явный режим (light|dark),
// отказываясь от `auto`. Полный выбор auto/light/dark остаётся в настройках.
const tooltip = computed<string>(() =>
  isDark.value ? t('header.themeLight') : t('header.themeDark')
)

function toggle(): void {
  setMode(isDark.value ? 'light' : 'dark')
}
</script>
