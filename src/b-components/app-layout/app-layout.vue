<template>
  <SC_Application id="application" class="menu-hide">
    <SC_Camera id="camera" />
    <StarExplosion />

    <SC_Appcnt :class="{ 'has-bottom-nav': isMobileOrTablet }">
      <AppHeader />
      <router-view />
      <SiteFooter />
    </SC_Appcnt>

    <BottomNav v-if="isMobileOrTablet" />

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
import BottomNav from '@/b-components/bottom-nav/bottom-nav.vue'
import { useUIStore } from '@/stores/ui-store'
import { classifyContentLink } from '@/helpers/common/content-link'
import { openExternal } from '@/helpers/common/open-external'
import { isTauriEnv } from '@/helpers/api/request-tor'
import { useViewport } from '@/composables/use-viewport'
import { SC_Application, SC_Camera, SC_Appcnt } from './styled'

const uiStore = useUIStore()
const router = useRouter()
const { isMobileOrTablet } = useViewport()

// Ссылки внутри v-html (посты, комментарии, сообщения) разбирает
// `classifyContentLink`: меншен и `bastyon://` уходят в router (N15), внешняя
// ссылка в десктопной сборке — в системный браузер, потому что там
// `target="_blank"` не работает (V40). Modifier-клик не трогаем.
function onDocumentClick(e: MouseEvent): void {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
    return
  }
  const target = e.target as HTMLElement | null
  const link = target?.closest('a') as HTMLAnchorElement | null
  if (!link) return

  const action = classifyContentLink(link.getAttribute('href') ?? '', {
    className: link.getAttribute('class') ?? '',
    isTauri: isTauriEnv(),
    origin: window.location.origin,
  })

  if (action.kind === 'router') {
    e.preventDefault()
    void router.push(action.path)
    return
  }
  if (action.kind === 'external') {
    e.preventDefault()
    void openExternal(action.href)
  }
}

onMounted(() => {
  void uiStore.loadLanguage()
  document.addEventListener('click', onDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
})
</script>
