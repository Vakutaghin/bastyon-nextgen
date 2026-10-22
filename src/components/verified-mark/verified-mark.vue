<template>
  <SC_VerifiedAnchor>
    <slot />
    <SC_VerifiedMark
      v-if="verified"
      role="img"
      :size="size"
      :title="t('profile.badges.verified')"
      :aria-label="t('profile.badges.verified')"
    >
      <CheckOutlined />
    </SC_VerifiedMark>
  </SC_VerifiedAnchor>
</template>

<script setup lang="ts">
// Аватар (слот) с галочкой проверенного аккаунта, как у старого приложения
// (markUser). Для аватаров на обычном <img>; у компонента Avatar значок свой —
// проп `verified`.
import { useI18n } from 'vue-i18n'
import { CheckOutlined } from '@/components/icons'
import { SC_VerifiedAnchor, SC_VerifiedMark } from './styled'

withDefaults(
  defineProps<{
    verified: boolean
    /** Диаметр значка, px. */
    size?: number
  }>(),
  { size: 16 }
)

const { t } = useI18n()
</script>
