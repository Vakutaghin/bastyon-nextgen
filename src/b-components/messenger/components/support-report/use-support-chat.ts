import { computed, watch } from 'vue'

import {
  SUPPORT_ACCOUNT_NAME,
  resolveSupportAddress,
  supportAddress,
} from '../../lib/support-account'
import { useMessengerStore } from '../../store'

/**
 * Этот личный чат — с поддержкой. Решает адрес, а не имя в профиле: имя
 * только подсказывает, что пора спросить ноду. С остальными собеседниками
 * нода не дёргается.
 */
export function useSupportChat(partnerAddress: () => string | null) {
  const store = useMessengerStore()

  const isSupportChat = computed<boolean>(() => {
    const partner = partnerAddress()
    return !!partner && partner === supportAddress.value
  })

  const looksLikeSupport = computed<boolean>(() => {
    const partner = partnerAddress()
    if (!partner) return false
    if (partner === supportAddress.value) return true
    const profile = store.userProfiles[partner] as { name?: string } | undefined
    return profile?.name === SUPPORT_ACCOUNT_NAME
  })

  watch(
    looksLikeSupport,
    (maybe) => {
      if (maybe) void resolveSupportAddress()
    },
    { immediate: true }
  )

  return { isSupportChat }
}
