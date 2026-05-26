<template>
  <SC_Page>
    <MiniAppFrame :app-id="appId" :inner-path="innerPath" />
  </SC_Page>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MiniAppFrame from '@/mini-apps/ui/mini-app-frame.vue'
import { bootMiniApps } from '@/mini-apps/ui/use-mini-app-bridge'
import { SC_Page } from './mini-app-page.styled'

const route = useRoute()
const router = useRouter()

const appId = computed(() => {
  const raw = Array.isArray(route.params.appId)
    ? (route.params.appId[0] ?? '')
    : (route.params.appId as string)
  return decodeURIComponent(raw)
})

const innerPath = computed(() => {
  const raw = route.params.innerPath
  if (Array.isArray(raw)) return raw.join('/')
  return (raw as string | undefined) ?? ''
})

onMounted(async () => {
  await bootMiniApps(router)
})
</script>
