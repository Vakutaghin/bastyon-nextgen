/**
 * Поднимает имя/аватар/репутацию/счётчики собеседника в карточку chat-room
 * (используется в `inviteMode`). Тянет профиль из messenger-store, при отсутствии
 * — дозагружает через `fetchProfiles([address])`.
 *
 * Источник адреса — либо `activeDialog.partner.id`
 * (matrix-id формата `@<hex>:<server>`, hex декодируем в адрес), либо
 * `lastTargetAddress` для invite-режима.
 *
 * См. CODE_AUDIT.md §1.
 */
import { computed, ref, watch, watchEffect, type ComputedRef, type Ref } from 'vue'
import type { Store } from 'pinia'
import { resolveImageUrl } from '@/helpers/common/url-transformer'

export interface PartnerInfo {
  partnerName: Ref<string>
  partnerAvatar: Ref<string | null>
  partnerInitial: ComputedRef<string>
  avatarLoadFailed: Ref<boolean>
  reputation: Ref<string>
  subscribersCount: Ref<number>
  subscribesCount: Ref<number>
  onAvatarError: () => void
}

/**
 * Реверс из hex обратно в текстовый адрес — обратный путь к
 * `addressToHex` из matrix-service. Bастyon-кодирование: байт > 0x80
 * сдвигается на +0x350 (за пределы ASCII, чтобы сохранить unicode).
 */
function hexToAddress(hex: string): string {
  if (!hex || hex.length % 2 !== 0) return ''
  let result = ''
  for (let i = 0; i < hex.length; i += 2) {
    const chHex = hex.substring(i, i + 2)
    if (!/^[0-9a-fA-F]{2}$/.test(chHex)) return ''
    let charCode = parseInt(chHex, 16)
    if (charCode >= 0x80) charCode += 0x350
    result += String.fromCharCode(charCode)
  }
  return result
}

function getAvatarUrlFromProfile(imageHash?: string): string | undefined {
  return imageHash ? resolveImageUrl(imageHash) : undefined
}

// Типы store / profile мы сознательно держим как unknown — реальная схема
// определена в messenger/store/messenger-chat-store.ts, а её строгое
// type-связывание сейчас разрушило бы границу пакетов. Поэтому используем
// узкий контракт, который обозначает только то, что нам реально надо.
interface PartnerStoreLike {
  activeDialog: {
    partner?: { name?: string; avatar?: string; id?: string }
    id?: string
  } | null
  lastTargetAddress?: string | null
  userProfiles: Record<string, unknown>
  fetchProfiles: (addresses: string[]) => Promise<unknown>
}

export function usePartnerInfo(store: PartnerStoreLike & Store): PartnerInfo {
  const partnerName = ref<string>('')
  const partnerAvatar = ref<string | null>(null)
  const avatarLoadFailed = ref(false)
  const reputation = ref<string>('0.0')
  const subscribersCount = ref(0)
  const subscribesCount = ref(0)

  function onAvatarError(): void {
    avatarLoadFailed.value = true
  }

  const partnerInitial = computed<string>(() => {
    const name = partnerName.value
    return name ? name[0]!.toUpperCase() : 'U'
  })

  async function update(): Promise<void> {
    let address: string | null = null
    const d = store.activeDialog
    const isInviteMode = !d

    if (d) {
      partnerName.value = d.partner?.name || 'Чат'
      partnerAvatar.value = d.partner?.avatar || null
      avatarLoadFailed.value = false
      const id = d.partner?.id
      if (typeof id === 'string' && id.startsWith('@') && id.includes(':')) {
        const parts = id.split(':')
        const userId = parts[0]!.substring(1)
        const looksHex = /^[0-9a-fA-F]+$/.test(userId) && userId.length % 2 === 0
        address = looksHex ? hexToAddress(userId) : userId
      }
    }
    if (!address) address = store.lastTargetAddress ?? null
    if (!address) return

    const cached = store.userProfiles[address]
    if (!cached) await store.fetchProfiles([address])
    const profile = store.userProfiles[address] as
      | {
          name?: string
          reputation?: number | string
          subscribers_count?: number
          subscribes_count?: number
          i?: string
          avatar?: string
          image?: string
        }
      | undefined
    if (!profile) return

    const r: unknown = profile.reputation ?? 0
    const num = typeof r === 'number' ? r : Number(r || 0)
    reputation.value = num.toFixed(1)
    subscribersCount.value = profile.subscribers_count || 0
    subscribesCount.value = profile.subscribes_count || 0

    // В режиме приглашения всегда обновляем имя и аватар из профиля по
    // текущему lastTargetAddress — иначе при смене собеседника без выхода
    // через «Назад» остаются старые значения.
    if (isInviteMode) {
      partnerName.value = profile.name || address || 'Новый чат'
      const img = profile.i || profile.avatar || profile.image
      partnerAvatar.value = img ? getAvatarUrlFromProfile(img) || null : null
      avatarLoadFailed.value = false
    } else {
      if (!partnerAvatar.value) {
        const img = profile.i || profile.avatar || profile.image
        const url = getAvatarUrlFromProfile(img)
        if (url) {
          partnerAvatar.value = url
          avatarLoadFailed.value = false
        }
      }
      if (!partnerName.value && profile.name) {
        partnerName.value = profile.name
      }
    }
  }

  watch(
    () => store.activeDialog?.id ?? null,
    () => {
      update()
    },
    { immediate: true }
  )

  watch(
    () => store.userProfiles,
    () => {
      update()
    },
    { deep: true }
  )

  watchEffect(() => {
    // Реагируем на смену активного диалога, профилей и lastTargetAddress
    // (смена собеседника в режиме приглашения).
    void store.activeDialog
    void store.userProfiles
    void store.lastTargetAddress
    update()
  })

  return {
    partnerName,
    partnerAvatar,
    partnerInitial,
    avatarLoadFailed,
    reputation,
    subscribersCount,
    subscribesCount,
    onAvatarError,
  }
}
