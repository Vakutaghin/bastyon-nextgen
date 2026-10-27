/**
 * «Сообщить об ошибке»: чат с аккаунтом поддержки на весь экран. Общий для
 * значка в шапке, пункта меню аккаунта и бокового меню телефона.
 */

import { useMessengerStore } from '@/b-components/messenger/store'
import {
  SUPPORT_ACCOUNT_NAME,
  resolveSupportAddress,
} from '@/b-components/messenger/lib/support-account'

export async function openSupportChat(): Promise<void> {
  const address = await resolveSupportAddress()
  if (!address) {
    console.warn(`[support] аккаунт "${SUPPORT_ACCOUNT_NAME}" не найден в сети`)
    return
  }
  const messengerStore = useMessengerStore()
  const roomId = await messengerStore.startChatWithAddress(address)
  if (roomId) {
    messengerStore.switchToChatAndLoad(roomId)
    messengerStore.isFullScreen = true
  }
}
