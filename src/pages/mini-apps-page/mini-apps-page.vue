<template>
  <SC_Page>
    <SC_Title>Мини-приложения</SC_Title>
    <SC_Subtitle>
      {{ subtitle }}
    </SC_Subtitle>
    <MiniAppsGrid />
  </SC_Page>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppsStore } from '@/mini-apps/store/apps-store'
import { bootMiniApps } from '@/mini-apps/ui/use-mini-app-bridge'
import MiniAppsGrid from '@/mini-apps/ui/mini-apps-grid.vue'
import { SC_Page, SC_Title, SC_Subtitle } from './mini-apps-page.styled'

const router = useRouter()
const appsStore = useAppsStore()

const subtitle = computed(() => {
  const n = appsStore.installedCount
  if (n === 0) return 'Нет установленных приложений.'
  return `Установлено: ${n}`
})

onMounted(async () => {
  await bootMiniApps(router)
})
</script>
