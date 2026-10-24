<template>
  <SC_UserMarkBadge
    role="img"
    :class="mark"
    :size="size"
    :title="label"
    :aria-label="label"
    :data-mark="mark"
  >
    <CheckOutlined v-if="mark === 'verified'" />
    <CrownFilled v-else-if="mark === 'moderator'" />
    <FlagFilled v-else />
  </SC_UserMarkBadge>
</template>

<script setup lang="ts">
// Сам значок; родитель — с position: relative (Avatar, обёртка UserMark).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { CheckOutlined, CrownFilled, FlagFilled } from '@/components/icons'
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
