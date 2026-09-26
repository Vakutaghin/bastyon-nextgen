/**
 * F1 — справка, как в программах для компьютера: статья про текущий экран
 * (`meta.helpTopic` маршрута) открывается в боковой панели, а если такой
 * статьи нет — раздел справки. В самой справке F1 ничего не делает.
 */

import { onBeforeUnmount, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHelpStore } from '@/stores/help-store'

export function useHelpHotkey(enabled: () => boolean): void {
  const route = useRoute()
  const router = useRouter()
  const help = useHelpStore()

  function onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'F1' || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey)
      return
    if (event.defaultPrevented || !enabled()) return
    // Иначе браузер откроет свою справку.
    event.preventDefault()
    if (route.name === 'help') return
    const topic = route.meta.helpTopic
    if (topic) help.openTopic(topic)
    else void router.push('/help')
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
}
