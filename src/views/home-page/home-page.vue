<template>
  <SC_HomeWork class='adj'>
    <SidebarLeft />
    <SC_HomeMainContent>
      <ContentFeed
        :feedData='null'
        :loading='false'
        :error='null'
      />
    </SC_HomeMainContent>
  </SC_HomeWork>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import SidebarLeft from '@/b-components/sidebar/sidebar-left/sidebar-left.vue'
import ContentFeed from '@/b-components/content/content-feed/content-feed.vue'
import { SC_HomeWork, SC_HomeMainContent } from './home-page.styled'

export default defineComponent({
  name: 'HomeView',
  components: {
    SidebarLeft,
    ContentFeed,
    SC_HomeWork,
    SC_HomeMainContent
  }
})
</script>
