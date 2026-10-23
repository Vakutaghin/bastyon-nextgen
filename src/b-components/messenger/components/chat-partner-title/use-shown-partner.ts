import { computed, type ComputedRef } from 'vue'
import { t } from '@/i18n'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import { isUserVerified, type VerifiableProfile } from '@/helpers/profile/is-user-verified'
import { userMark, type UserMark } from '@/helpers/profile/user-mark'
import { isMeshDialogId } from '@/mesh/ids'
import { useMessengerStore } from '../../store'
import { getAddressFromMatrixId } from '../../helpers'
import type { DialogGroup } from '../../types'

/** Собеседник в шапке открытого чата. */
export interface ShownPartner {
  name: string
  avatar?: string
  verified: boolean
  /** Значок у аватара: проверенный, модератор, «акула». */
  mark?: UserMark | null
  /** Адрес Bastyon; null — профиля нет: группа, mesh. */
  address: string | null
  /** Открытый чат; null — приглашение написать. */
  chatId: string | null
  /** Matrix-группа: в шапке число участников, по нажатию — окно группы. */
  group?: DialogGroup
}

type ProfileLike = VerifiableProfile & {
  name?: string
  i?: string
  avatar?: string
  image?: string
}

/**
 * Кто сейчас открыт в мессенджере: собеседник активного чата или тот, кому
 * предлагаем написать (приглашение). null — открыт список чатов.
 */
export function useShownPartner(): ComputedRef<ShownPartner | null> {
  const store = useMessengerStore()

  return computed<ShownPartner | null>(() => {
    const chatId = store.activeChatId
    if (chatId) {
      const dialog = store.dialogs.find((d) => d.id === chatId)
      let address: string | null = null
      if (!isMeshDialogId(chatId)) {
        // У группы вместо собеседника — сама комната (`!…`), адреса у неё нет.
        address = dialog
          ? getAddressFromMatrixId(dialog.partner.id)
          : store.getDirectPartnerAddress(chatId)
      }
      return {
        name: dialog?.partner.name || t('messenger.chat'),
        avatar: dialog?.partner.avatar,
        verified: !!dialog?.partner.verified,
        mark: dialog?.partner.mark ?? (dialog?.partner.verified ? 'verified' : null),
        address,
        chatId,
        ...(dialog?.group ? { group: dialog.group } : {}),
      }
    }

    const address = store.inviteViewActive ? store.lastTargetAddress : null
    if (!address) return null
    const profile = store.userProfiles[address] as ProfileLike | undefined
    const image = profile?.i || profile?.avatar || profile?.image
    return {
      name: profile?.name || address,
      avatar: image ? resolveImageUrl(image) || undefined : undefined,
      verified: isUserVerified(profile, address),
      mark: userMark(profile, address),
      address,
      chatId: null,
    }
  })
}
