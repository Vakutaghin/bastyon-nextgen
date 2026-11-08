import { useRouter } from 'vue-router'
import { useMessengerStore } from '../../store'

/**
 * Переход из мессенджера в «Настройки → Чаты», при `section` — сразу к его
 * разделу. Мессенджер закрывается: окошко в углу заслоняет настройки, а
 * полноэкранный стоит поверх всей страницы.
 */
export function useOpenChatSettings(): (section?: string) => void {
  const router = useRouter()
  const store = useMessengerStore()
  return (section) => {
    if (store.isFullScreen) store.closeFullScreen()
    else store.closeWidget()
    void router.push({
      path: '/settings',
      query: section ? { tab: 'chats', section } : { tab: 'chats' },
    })
  }
}
