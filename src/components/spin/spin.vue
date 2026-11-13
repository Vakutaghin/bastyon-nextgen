<template>
  <SC_Spin
    class="ui-spin"
    role="status"
    :data-size="size"
    :aria-label="tip ? undefined : t('a11y.loading')"
  >
    <span class="ui-spin__indicator" aria-hidden="true">
      <slot name="indicator">
        <LoadingOutlined />
      </slot>
    </span>
    <span v-if="tip" class="ui-spin__tip">{{ tip }}</span>
  </SC_Spin>
</template>

<script setup lang="ts">
// Значок загрузки вместо antd Spin. Значок по умолчанию — крутящийся круг
// Lucide, как у Nuxt UI; свой — слотом #indicator. Подпись `tip` — под ним.
// role="status": диктор читает подпись, а без неё — «Загрузка».
// t — из @/i18n, а не useI18n: Spin стоит в компонентах, которые тесты
// монтируют без плагина i18n.
import { t } from '@/i18n'
import { LoadingOutlined } from '@/components/icons'
import type { SpinProps } from './types'
import { SC_Spin } from './styled'

withDefaults(defineProps<SpinProps>(), { size: 'default', tip: undefined })
</script>
