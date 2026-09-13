// Зависимости модулей главного стора мессенджера (messenger-store/*).
//
// Фабрики получают ИНСТАНСЫ подсторов (не storeToRefs) и сами не зовут
// useMessenger*Store() — иначе цикл инициализации pinia-сторов.

import type { useMessengerUiStore } from '../messenger-ui-store'
import type { useMessengerProfileCache } from '../messenger-profile-cache'
import type { useMessengerChatStore } from '../messenger-chat-store'

export interface MessengerStoreContext {
  uiStore: ReturnType<typeof useMessengerUiStore>
  chatStore: ReturnType<typeof useMessengerChatStore>
  profileCache: ReturnType<typeof useMessengerProfileCache>
}
