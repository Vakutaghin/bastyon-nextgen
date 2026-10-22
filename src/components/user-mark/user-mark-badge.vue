<template>
  <SC_UserMarkBadge role="img" :size="size" :title="label" :aria-label="label">
    <CheckOutlined v-if="mark === 'verified'" />
    <CrownOutlined v-else-if="mark === 'moderator'" />
    <FlagOutlined v-else />
  </SC_UserMarkBadge>
</template>

<script setup lang="ts">
// Сам значок; родитель — с position: relative (Avatar, обёртка UserMark).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { CheckOutlined, CrownOutlined, FlagOutlined } from '@/components/icons'
import type { UserMark } from '@/helpers/profile/user-mark'
import { SC_UserMarkBadge } from './styled'

const props = withDefaults(
  defineProps<{
    mark: UserMark
    /** Диаметр значка, px. */
    size?: number
  }>(),
  { size: 16 }
)

const { t } = useI18n()
const label = computed<string>(() => t('profile.badges.' + props.mark))
</script>
