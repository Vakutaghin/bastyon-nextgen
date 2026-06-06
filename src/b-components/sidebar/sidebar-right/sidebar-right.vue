<template>
  <SC_RightSidebar>
    <RecommendedUsers />
    <LastComments />
  </SC_RightSidebar>
</template>

<script setup lang="ts">
import RecommendedUsers from '@/b-components/sidebar/sidebar-right/recommended-users/recommended-users.vue'
import LastComments from '@/b-components/sidebar/sidebar-right/last-comments/last-comments.vue'
import { SC_RightSidebar } from './styled'
</script>
