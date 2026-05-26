/**
 * Pinia-store «избранных» миниапп — то что пользователь закрепил для быстрого
 * доступа из сайдбара. Не имеет ничего общего с «установлен/не установлен»
 * (см. `apps-store.ts`): любую миниаппу из каталога можно добавить в избранное
 * без формальной установки.
 *
 * Метаданные (name/scope/icon) сохраняются вместе с id — чтобы после reload
 * не нужно было ждать загрузки каталога с ноды чтобы отрисовать иконку в сайдбаре.
 *
 * Persistence — через `kvStore` (Capacitor Preferences на mobile,
 * localStorage в web).
 */

import { defineStore } from 'pinia'
import { logger } from '@/services/logger'
import type { AppId } from '../types/app'
import { kvStore, type KeyValueStore } from '../storage/key-value-store'

const log = logger.scope('[mini-apps:favorites]')

const STORAGE_KEY = 'favorites'

export interface FavoriteMiniApp {
  readonly id: AppId
  readonly name: string
  readonly scope: string
  readonly icon: string
  readonly addedAt: number
}

interface FavoritesState {
  items: FavoriteMiniApp[]
  ready: boolean
}

let deps: { kv: KeyValueStore } = { kv: kvStore }

export const useFavoriteMiniAppsStore = defineStore('mini-apps:favorites', {
  state: (): FavoritesState => ({
    items: [],
    ready: false,
  }),

  getters: {
    isFavorite(state): (id: AppId) => boolean {
      return (id) => state.items.some((f) => f.id === id)
    },
    count(state): number {
      return state.items.length
    },
  },

  actions: {
    configure(newDeps: { kv?: KeyValueStore }) {
      if (newDeps.kv) deps = { kv: newDeps.kv }
    },

    async init(): Promise<void> {
      if (this.ready) return
      const raw = await deps.kv.get(STORAGE_KEY)
      if (raw) {
        try {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) {
            this.items = parsed.filter(
              (it): it is FavoriteMiniApp =>
                !!it &&
                typeof it === 'object' &&
                typeof it.id === 'string' &&
                typeof it.name === 'string' &&
                typeof it.scope === 'string' &&
                typeof it.icon === 'string'
            )
          }
        } catch (e) {
          log.warn('corrupted favorites, resetting', e)
          await deps.kv.set(STORAGE_KEY, '[]')
        }
      }
      this.ready = true
    },

    async add(entry: Omit<FavoriteMiniApp, 'addedAt'>): Promise<void> {
      if (this.isFavorite(entry.id)) return
      this.items.push({ ...entry, addedAt: Date.now() })
      await this.persist()
      log.debug('added', entry.id)
    },

    async remove(id: AppId): Promise<void> {
      const before = this.items.length
      this.items = this.items.filter((f) => f.id !== id)
      if (this.items.length !== before) {
        await this.persist()
        log.debug('removed', id)
      }
    },

    async toggle(entry: Omit<FavoriteMiniApp, 'addedAt'>): Promise<void> {
      if (this.isFavorite(entry.id)) {
        await this.remove(entry.id)
      } else {
        await this.add(entry)
      }
    },

    async persist(): Promise<void> {
      await deps.kv.set(STORAGE_KEY, JSON.stringify(this.items))
    },
  },
})
