// Персист уведомлений в IDB, ключами по адресу: указатель «прочитано до» (блок)
// и множество скрытых id. Чистые функции над settingsAPI — вынесено из
// notifications-store (см. LARGE_FILE_SPLIT_AUDIT.md).
import { settingsAPI } from '@/db/apis/settings-api'
import { NOTIFICATIONS_LAST_BLOCK_KEY, NOTIFICATIONS_HIDDEN_IDS_KEY } from './notifications-constants'
import type { LastBlockByAddress, HiddenIdsByAddress } from './notifications-types'

/** Высота блока из IDB для адреса (с какого блока запрашивать уведомления). */
export async function loadLastBlockFromSettings(address: string): Promise<number | null> {
  try {
    const raw = (await settingsAPI.get(NOTIFICATIONS_LAST_BLOCK_KEY)) as
      | LastBlockByAddress
      | undefined
    if (raw && typeof raw === 'object' && typeof raw[address] === 'number') {
      return raw[address]
    }
    return null
  } catch {
    return null
  }
}

/** Сохранить высоту блока в IDB для адреса (указатель «прочитано до»). */
export async function saveLastBlockToSettings(address: string, block: number): Promise<void> {
  try {
    const raw = (await settingsAPI.get(NOTIFICATIONS_LAST_BLOCK_KEY)) as
      | LastBlockByAddress
      | undefined
    const next: LastBlockByAddress = {
      ...(raw && typeof raw === 'object' ? raw : {}),
      [address]: block,
    }
    await settingsAPI.set(NOTIFICATIONS_LAST_BLOCK_KEY, next)
  } catch (e) {
    console.error('[notifications] saveLastBlockToSettings failed', e)
  }
}

/** Загрузить скрытые id для адреса из settings. */
export async function loadHiddenIdsFromSettings(address: string): Promise<Set<string>> {
  try {
    const raw = (await settingsAPI.get(NOTIFICATIONS_HIDDEN_IDS_KEY)) as
      | HiddenIdsByAddress
      | undefined
    const arr = raw && typeof raw === 'object' && Array.isArray(raw[address]) ? raw[address] : []
    return new Set(arr)
  } catch {
    return new Set()
  }
}

/** Сохранить скрытые id для адреса в settings. */
export async function saveHiddenIdsToSettings(address: string, ids: Set<string>): Promise<void> {
  try {
    const raw = (await settingsAPI.get(NOTIFICATIONS_HIDDEN_IDS_KEY)) as
      | HiddenIdsByAddress
      | undefined
    const next: HiddenIdsByAddress = {
      ...(raw && typeof raw === 'object' ? raw : {}),
      [address]: [...ids],
    }
    await settingsAPI.set(NOTIFICATIONS_HIDDEN_IDS_KEY, next)
  } catch (e) {
    console.error('[notifications] saveHiddenIdsToSettings failed', e)
  }
}
