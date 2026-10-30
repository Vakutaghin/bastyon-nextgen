/**
 * Приватность в чатах: «в сети», «печатает», «записывает голосовое».
 *
 * Своя копия на устройстве по аккаунту — она нужна до входа в мессенджер:
 * от неё зависит, уйдёт ли «в сети» с первым же синком. Серверная копия
 * (данные аккаунта Matrix) приходит с синком и побеждает: настройку меняют
 * на одном устройстве, а действует на всех.
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { logger } from '@/services/logger'
import { matrixService } from '../services/matrix-service'
import {
  CHAT_PRIVACY_ACCOUNT_DATA,
  CHAT_PRIVACY_STORAGE_PREFIX,
  DEFAULT_CHAT_PRIVACY,
  sameChatPrivacy,
  sanitizeChatPrivacy,
  type ChatPrivacy,
} from '../lib/chat-privacy'

const log = logger.scope('[messenger:privacy]')

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export const useMessengerPrivacyStore = defineStore('messenger-privacy', () => {
  const prefs = ref<ChatPrivacy>({ ...DEFAULT_CHAT_PRIVACY })
  const owner = ref<string | null>(null)
  /** Изменили здесь, а на сервер ещё не ушло (не было клиента или сбой). */
  let dirty = false

  function readLocal(address: string): ChatPrivacy {
    try {
      const raw = storage()?.getItem(`${CHAT_PRIVACY_STORAGE_PREFIX}${address}`)
      return sanitizeChatPrivacy(raw ? JSON.parse(raw) : null)
    } catch {
      return { ...DEFAULT_CHAT_PRIVACY }
    }
  }

  function persist(): void {
    if (!owner.value) return
    try {
      storage()?.setItem(
        `${CHAT_PRIVACY_STORAGE_PREFIX}${owner.value}`,
        JSON.stringify(prefs.value)
      )
    } catch {
      /* без копии на устройстве настройка придёт с сервера */
    }
  }

  function apply(next: ChatPrivacy): void {
    prefs.value = next
    persist()
    void matrixService.setPresenceVisible(next.online)
  }

  async function push(): Promise<void> {
    if (!matrixService.getClient()) {
      dirty = true
      return
    }
    dirty = false
    try {
      await matrixService.setAccountData(CHAT_PRIVACY_ACCOUNT_DATA, { ...prefs.value })
    } catch (e) {
      log.warn('privacy not saved to server', e)
      dirty = true
    }
  }

  /** Вошли в аккаунт: его настройка с прошлого запуска — до входа в мессенджер. */
  function attach(address: string): void {
    if (owner.value === address) return
    owner.value = address
    dirty = false
    apply(readLocal(address))
  }

  /** Переключили в настройках. */
  async function set(key: keyof ChatPrivacy, value: boolean): Promise<void> {
    if (prefs.value[key] === value) return
    apply({ ...prefs.value, [key]: value })
    await push()
  }

  /** Копия с сервера: первый синк или изменение с другого устройства. */
  function applyRemote(content: unknown): void {
    if (!owner.value || content == null) return
    const remote = sanitizeChatPrivacy(content)
    if (!sameChatPrivacy(remote, prefs.value)) apply(remote)
  }

  /**
   * Первый синк: несохранённое здесь — отдаём серверу; на сервере есть — берём
   * её; нет нигде, кроме как здесь (не по умолчанию), — отдаём свою.
   */
  function syncWithServer(): void {
    const remote = matrixService.getAccountData(CHAT_PRIVACY_ACCOUNT_DATA)
    if (dirty) void push()
    else if (remote != null) applyRemote(remote)
    else if (!sameChatPrivacy(prefs.value, DEFAULT_CHAT_PRIVACY)) void push()
  }

  function reset(): void {
    owner.value = null
    dirty = false
    prefs.value = { ...DEFAULT_CHAT_PRIVACY }
    void matrixService.setPresenceVisible(false)
  }

  return { prefs, owner, attach, set, applyRemote, syncWithServer, reset }
})
