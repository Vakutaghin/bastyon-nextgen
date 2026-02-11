<template>
  <SC_RightSidebar>
    <LastComments />
  </SC_RightSidebar>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import LastComments from '@/b-components/sidebar/sidebar-right/last-comments/last-comments.vue'
import { SC_RightSidebar } from './styled'

export default defineComponent({
  name: 'SidebarRight',
  components: {
    LastComments,
    SC_RightSidebar
  }
})
</script>
