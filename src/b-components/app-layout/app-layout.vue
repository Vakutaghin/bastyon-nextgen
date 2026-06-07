<template>
  <SC_Application id="application" class="menu-hide">
    <SC_Camera id="camera" />
    <StarExplosion />

    <SC_Appcnt>
      <AppHeader />
      <router-view />
      <SiteFooter />
    </SC_Appcnt>

    <MessengerWrapper />

    <PostModal />

    <PostComposerModal />

    <WhatsNewModal />
  </SC_Application>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/b-components/header/app-header/app-header.vue'
import MessengerWrapper from '@/b-components/messenger/components/messenger-wrapper/messenger-wrapper.vue'
import PostModal from '@/b-components/content/post-modal/post-modal.vue'
import PostComposerModal from '@/b-components/content/post-composer/post-composer-modal.vue'
import WhatsNewModal from '@/b-components/changelog/whats-new-modal.vue'
import { StarExplosion } from '@/b-components/effects/star-explosion'
import SiteFooter from '@/b-components/site-footer/site-footer.vue'
import { useUIStore } from '@/stores/ui-store'
import { SC_Application, SC_Camera, SC_Appcnt } from './styled'

const uiStore = useUIStore()
const router = useRouter()

// @-меншены рендерятся как `<a class="mention-link" href="/ник">` внутри v-html
// (см. text-formatter). Делегируем их клики в router, чтобы шла SPA-навигация,
// а не полная перезагрузка. Modifier-клик (открыть в новой вкладке) не трогаем.
function onDocumentClick(e: MouseEvent): void {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
    return
  }
  const target = e.target as HTMLElement | null
  const link = target?.closest('a.mention-link') as HTMLAnchorElement | null
  if (!link) return
  const path = link.getAttribute('href')
  if (!path || !path.startsWith('/')) return
  e.preventDefault()
  void router.push(path)
}

onMounted(() => {
  void uiStore.loadLanguage()
  document.addEventListener('click', onDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
})
</script>
