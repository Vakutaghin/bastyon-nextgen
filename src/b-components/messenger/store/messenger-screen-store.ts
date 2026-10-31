/**
 * Фильтр входящих (lib/chat-screen): настройка аккаунта на этом устройстве и
 * какие чаты списка он сейчас прячет. Спрятанные не звенят и не входят в
 * общий счётчик непрочитанного — их новое видно на кнопке «Скрытые» над
 * списком, она же показывает их на время.
 */

import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useAuthStore } from '@/blockchain/store/auth-store'
import { MESSENGER_SCREEN_PREFIX } from '@/blockchain/constants/storage'

import type { Dialog } from '../types'
import { getAddressFromMatrixId } from '../helpers'
import {
  DEFAULT_CHAT_SCREEN,
  chatScreenActive,
  chatScreenNeedsProfile,
  sanitizeChatScreen,
  screenReason,
  screenSubjectOf,
  type ChatScreenPrefs,
  type MarkRule,
  type PersonRule,
  type ScreenMark,
  type ScreenReason,
  type ScreenSubject,
} from '../lib/chat-screen'
import { useMessengerProfileCache } from './messenger-profile-cache'
import { useMessengerUiStore } from './messenger-ui-store'

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

const fresh = (): ChatScreenPrefs => sanitizeChatScreen(DEFAULT_CHAT_SCREEN)

export const useMessengerScreenStore = defineStore('messenger-screen', () => {
  const auth = useAuthStore()
  const ui = useMessengerUiStore()
  const profiles = useMessengerProfileCache()

  const prefs = ref<ChatScreenPrefs>(fresh())
  const owner = ref<string | null>(null)
  /** Спрятанные показаны в списке — кнопкой над ним, до смены аккаунта. */
  const showHidden = ref(false)

  function load(address: string | null): void {
    owner.value = address
    showHidden.value = false
    if (!address) {
      prefs.value = fresh()
      return
    }
    try {
      const raw = storage()?.getItem(`${MESSENGER_SCREEN_PREFIX}${address}`)
      prefs.value = sanitizeChatScreen(raw ? JSON.parse(raw) : null)
    } catch {
      prefs.value = fresh()
    }
  }

  watch(() => (auth.isUserAuthenticated ? auth.getUserAddress : null), load, { immediate: true })

  function save(next: ChatScreenPrefs): void {
    prefs.value = next
    if (!owner.value) return
    try {
      storage()?.setItem(`${MESSENGER_SCREEN_PREFIX}${owner.value}`, JSON.stringify(next))
    } catch {
      /* без хранилища — до перезапуска */
    }
  }

  const active = computed<boolean>(() => chatScreenActive(prefs.value))

  /** Чей чат для фильтра (null — фильтр его не трогает). */
  const subjectOf = (dialog: Dialog): ScreenSubject | null =>
    screenSubjectOf(dialog, getAddressFromMatrixId)

  const judge = (subject: ScreenSubject): ScreenReason | null =>
    screenReason(prefs.value, subject, profiles.userProfiles[subject.address])

  /** Почему чат спрятан; `null` — виден. */
  function reasonFor(dialog: Dialog): ScreenReason | null {
    if (!active.value) return null
    const subject = subjectOf(dialog)
    return subject ? judge(subject) : null
  }

  const hiddenDialogs = computed<Dialog[]>(() =>
    active.value ? ui.dialogs.filter((d) => reasonFor(d) !== null) : []
  )
  const hiddenIds = computed<ReadonlySet<string>>(
    () => new Set(hiddenDialogs.value.map((d) => d.id))
  )
  /** Непрочитанные сообщения в спрятанных — вычитаются из общего счётчика. */
  const hiddenUnread = computed<number>(() =>
    hiddenDialogs.value.reduce((sum, d) => sum + (d.unreadCount || 0), 0)
  )
  /** Спрятанные чаты с новым — число на кнопке «Скрытые». */
  const hiddenWithNew = computed<number>(
    () => hiddenDialogs.value.filter((d) => d.unreadCount > 0 || d.hasUnread).length
  )

  // Правилам по репутации и статусам нужен профиль. У личных чатов его грузит
  // разбор комнаты, у приглашений в группу — никто: пригласивший там не участник мозаики.
  watch(
    () => [ui.dialogs, prefs.value] as const,
    ([list, p]) => {
      if (!chatScreenActive(p) || !chatScreenNeedsProfile(p)) return
      const missing = new Set<string>()
      for (const d of list) {
        const subject = subjectOf(d)
        if (!subject?.byRules || p.people[subject.address]) continue
        if (!profiles.userProfiles[subject.address]) missing.add(subject.address)
      }
      if (missing.size) void profiles.fetchProfiles([...missing])
    },
    { immediate: true }
  )

  /**
   * Пришло сообщение — звенеть ли. Чат может быть ещё не в списке: первое
   * сообщение нового собеседника. Тогда судим по отправителю, дождавшись его
   * профиля, — иначе звенел бы именно тот, от кого фильтр и защищает.
   */
  async function silences(roomId: string, senderId: string): Promise<boolean> {
    if (!active.value) return false
    const dialog = ui.dialogs.find((d) => d.id === roomId)
    const sender = dialog ? null : getAddressFromMatrixId(senderId)
    const subject = dialog ? subjectOf(dialog) : sender ? { address: sender, byRules: true } : null
    if (!subject) return false
    const { address } = subject
    if (
      subject.byRules &&
      !prefs.value.people[address] &&
      !profiles.userProfiles[address] &&
      chatScreenNeedsProfile(prefs.value)
    ) {
      await profiles.fetchProfiles([address])
    }
    return judge(subject) !== null
  }

  function setReputation(on: boolean, below = prefs.value.reputation.below): void {
    save({ ...prefs.value, reputation: { on, below } })
  }

  function setMark(mark: ScreenMark, rule: MarkRule): void {
    save({ ...prefs.value, marks: { ...prefs.value.marks, [mark]: rule } })
  }

  /** Человек вручную: спрятать, всегда показывать или вернуть под общие правила (`null`). */
  function setPerson(address: string, rule: PersonRule | null, name = ''): void {
    const people = { ...prefs.value.people }
    if (rule) people[address] = { rule, name: name || people[address]?.name || '' }
    else delete people[address]
    save({ ...prefs.value, people })
  }

  /** Ник для списка в настройках: из профиля, у личного чата — его название. */
  const nameOf = (dialog: Dialog, address: string): string =>
    profiles.userProfiles[address]?.name || (dialog.group ? '' : dialog.partner.name) || ''

  /** «Убрать в скрытые» из меню чата. */
  function hideChat(dialog: Dialog): void {
    const subject = subjectOf(dialog)
    if (subject) setPerson(subject.address, 'hide', nameOf(dialog, subject.address))
  }

  /**
   * «Вернуть из скрытых»: снимаем ручное «скрыть», а если чат прячут общие
   * правила — человек становится «всегда показывать».
   */
  function unhideChat(dialog: Dialog): void {
    const subject = subjectOf(dialog)
    if (!subject) return
    setPerson(subject.address, null)
    if (judge(subject)) setPerson(subject.address, 'show', nameOf(dialog, subject.address))
  }

  function toggleShowHidden(): void {
    showHidden.value = !showHidden.value
  }

  return {
    prefs,
    owner,
    showHidden,
    active,
    hiddenIds,
    hiddenDialogs,
    hiddenUnread,
    hiddenWithNew,
    subjectOf,
    reasonFor,
    silences,
    setReputation,
    setMark,
    setPerson,
    hideChat,
    unhideChat,
    toggleShowHidden,
  }
})
