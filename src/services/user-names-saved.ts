/**
 * Имена и аватары пользователей между запусками.
 *
 * Раньше каждый запуск начинался с пустого кэша имён: список чатов, лента и
 * уведомления сначала показывали короткие адреса, а без сети так с ними и
 * оставались. Теперь всё, что нода сообщила об имени, аватаре и бейджах,
 * лежит на устройстве (known-users-api) и при запуске поднимается в
 * user-names. Поднятое показывается сразу и спрашивается у ноды заново при
 * первом показе.
 *
 * Пишем не на каждое имя: изменения копятся и уходят пачкой через
 * SAVE_DELAY_MS, а когда приложение сворачивают или закрывают — сразу.
 */

import { knownUsersAPI } from '@/db/apis/known-users-api'
import { onUserSeen, restoreUsers, type SavedUser } from './user-names'

/** Пауза перед записью: подписи одного экрана уходят одной пачкой. */
export const SAVE_DELAY_MS = 5_000

const pending = new Map<string, SavedUser>()
let timer: ReturnType<typeof setTimeout> | null = null
let started: Promise<void> | null = null
/** Идущая запись: стирание ждёт её, иначе она вернула бы стёртое. */
let saving: Promise<void> = Promise.resolve()

function onHidden(): void {
  if (document.visibilityState === 'hidden') void flushSavedUserNames()
}

function onPageHide(): void {
  void flushSavedUserNames()
}

/** Записать накопленное сейчас. */
export function flushSavedUserNames(): Promise<void> {
  if (timer) clearTimeout(timer)
  timer = null
  if (!pending.size) return saving
  const batch = [...pending]
  pending.clear()
  saving = saving.then(() => knownUsersAPI.save(batch))
  return saving
}

/**
 * Поднять сохранённые имена и сохранять новые. Зовётся один раз при запуске,
 * когда база открыта; повторный вызов возвращает тот же промис.
 */
export function startSavedUserNames(): Promise<void> {
  started ??= (async () => {
    // Подписываемся до чтения: имена, пришедшие, пока база читается, тоже
    // сохранятся, а прочитанное их не перетрёт (restoreUsers).
    onUserSeen((address, user) => {
      pending.set(address, user)
      timer ??= setTimeout(() => void flushSavedUserNames(), SAVE_DELAY_MS)
    })
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onHidden)
      window.addEventListener('pagehide', onPageHide)
    }
    restoreUsers(await knownUsersAPI.load())
  })()
  return started
}

/** Стереть сохранённые имена (выход, удаление аккаунта); вернуть, сколько было. */
export async function forgetSavedUserNames(): Promise<number> {
  if (timer) clearTimeout(timer)
  timer = null
  pending.clear()
  await saving
  return knownUsersAPI.clear()
}

/** Только для тестов. */
export function __resetSavedUserNamesForTests(): void {
  if (timer) clearTimeout(timer)
  timer = null
  pending.clear()
  started = null
  saving = Promise.resolve()
  onUserSeen(null)
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onHidden)
    window.removeEventListener('pagehide', onPageHide)
  }
}
