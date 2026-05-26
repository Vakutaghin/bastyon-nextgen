/**
 * Локальные «оверрайды» — пользовательские мини-приложения, добавленные через UI.
 *
 * Legacy эквивалент — `addAppToConfig`/`loadAppFromLocalhost`
 * ([index.js:2034-2141](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L2034-L2141))
 * через `localStorage['app_<id>']`. У нас — через защищённое key-value хранилище
 * (см. `storage/key-value-store.ts`).
 */

import { logger } from '@/services/logger'
import { kvStore, type KeyValueStore } from '../storage/key-value-store'

const log = logger.scope('[mini-apps:local]')

const INDEX_KEY = 'local-apps-index' // JSON-массив id'шек
const ENTRY_PREFIX = 'local-app:' // ENTRY_PREFIX + id → JSON LocalOverride

export interface LocalOverride {
  /** ID мини-приложения. Должен совпадать с manifest.id. */
  readonly id: string
  /** Scope, указанный пользователем. */
  readonly scope: string
  /** Необязательное имя для UI до загрузки манифеста. */
  readonly displayName?: string
  /** Время добавления (мс epoch). */
  readonly addedAt: number
  /** Признак «dev mode» — разрешает менее строгие проверки origin. */
  readonly devMode?: boolean
}

export class LocalOverridesStore {
  constructor(private readonly kv: KeyValueStore = kvStore) {}

  /** Список всех локальных оверрайдов. */
  async list(): Promise<LocalOverride[]> {
    const raw = await this.kv.get(INDEX_KEY)
    if (!raw) return []
    let ids: unknown
    try {
      ids = JSON.parse(raw)
    } catch {
      log.warn('corrupted index, resetting')
      await this.kv.set(INDEX_KEY, '[]')
      return []
    }
    if (!Array.isArray(ids)) return []

    const result: LocalOverride[] = []
    for (const id of ids) {
      if (typeof id !== 'string') continue
      const entry = await this.get(id)
      if (entry) result.push(entry)
    }
    return result
  }

  async get(id: string): Promise<LocalOverride | null> {
    const raw = await this.kv.get(ENTRY_PREFIX + id)
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as LocalOverride
      if (parsed && typeof parsed.id === 'string' && typeof parsed.scope === 'string') {
        return parsed
      }
    } catch {
      // ignore
    }
    return null
  }

  /** Добавляет или заменяет локальный оверрайд. */
  async upsert(entry: LocalOverride): Promise<void> {
    if (!entry.id || !entry.scope) throw new Error('local override requires id and scope')
    await this.kv.set(ENTRY_PREFIX + entry.id, JSON.stringify(entry))

    const ids = await this.readIndex()
    if (!ids.includes(entry.id)) {
      ids.push(entry.id)
      await this.writeIndex(ids)
    }
    log.debug('upsert', entry.id, entry.scope)
  }

  async remove(id: string): Promise<void> {
    await this.kv.remove(ENTRY_PREFIX + id)
    const ids = (await this.readIndex()).filter((x) => x !== id)
    await this.writeIndex(ids)
    log.debug('remove', id)
  }

  private async readIndex(): Promise<string[]> {
    const raw = await this.kv.get(INDEX_KEY)
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
    } catch {
      return []
    }
  }

  private async writeIndex(ids: string[]): Promise<void> {
    await this.kv.set(INDEX_KEY, JSON.stringify(ids))
  }
}

export const localOverrides = new LocalOverridesStore()
