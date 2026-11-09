<template>
  <SC_RightSidebar :aria-label="t('a11y.sidebarRight')">
    <RecommendedUsers />
    <LastComments />
  </SC_RightSidebar>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import RecommendedUsers from '@/b-components/sidebar/sidebar-right/recommended-users/recommended-users.vue'
import LastComments from '@/b-components/sidebar/sidebar-right/last-comments/last-comments.vue'
import { SC_RightSidebar } from './styled'

const { t } = useI18n()
</script>
