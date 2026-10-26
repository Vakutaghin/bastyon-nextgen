/**
 * Место на диске в приложении для компьютера (src-tauri `storage`): веб-кэш и
 * кэш IPFS с пределами и очисткой, размер скачанных модулей. Пределы хранит и
 * соблюдает сам Rust: кэш больше предела он чистит при запуске и раз в
 * полчаса, так что настройка работает и без открытой вкладки.
 *
 * Модули Tauri в вебе не грузятся (N17): только `import()` внутри действий.
 */

import { defineStore } from 'pinia'

import { isTauri } from '@/b-components/video-uploader/utils/environment'
import { t } from '@/i18n'

export type CacheKind = 'web' | 'ipfs'

export interface StorageLimits {
  web: number
  ipfs: number
}

export interface ModulesUsage {
  ipfs: number
  tor: number
  voice: number
  compression: number
  mesh: number
}

export interface StorageUsage {
  webCache: number
  /** null — модуль IPFS не установлен. */
  ipfsCache: number | null
  limits: StorageLimits
  modules: ModulesUsage
}

const MB = 1024 * 1024
const GB = 1024 * MB

/** Больше 1 ГБ веб-кэш не вырастет и сам: столько берёт WebKit. */
export const WEB_CACHE_LIMITS: readonly number[] = [100 * MB, 250 * MB, 512 * MB, GB]
export const IPFS_CACHE_LIMITS: readonly number[] = [512 * MB, GB, 2 * GB, 5 * GB]

/** Движок удаляет файлы кэша уже после ответа команды — меряем чуть позже. */
const CLEAR_SETTLE_MS = 1500

/** Предел подписью: «512 МБ», «2 ГБ» — единицы как у formatFileSize мессенджера. */
export function formatLimit(bytes: number): string {
  return bytes >= GB
    ? `${Math.round(bytes / GB)} ${t('appMsg.bytes.gb')}`
    : `${Math.round(bytes / MB)} ${t('appMsg.bytes.mb')}`
}

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export const useStorageStore = defineStore('storage', {
  state: () => ({
    usage: null as StorageUsage | null,
    /** Какой кэш сейчас очищается. */
    clearing: null as CacheKind | null,
  }),

  getters: {
    available: (): boolean => isTauri(),
    /** Все модули вместе. */
    modulesTotal(state): number {
      const m = state.usage?.modules
      return m ? m.ipfs + m.tor + m.voice + m.compression + m.mesh : 0
    },
  },

  actions: {
    async refresh(): Promise<void> {
      if (!this.available) return
      const usage = await tauriInvoke<StorageUsage>('storage_usage').catch(() => null)
      if (usage) this.usage = usage
    },

    async setLimit(kind: CacheKind, bytes: number): Promise<void> {
      if (!this.usage) return
      const limits = await tauriInvoke<StorageLimits>('storage_set_limits', {
        limits: { ...this.usage.limits, [kind]: bytes },
      }).catch(() => null)
      if (!limits) return
      this.usage.limits = limits
      // Новый предел мог оказаться меньше кэша — Rust его уже чистит.
      await wait(CLEAR_SETTLE_MS)
      await this.refresh()
    },

    /** false — очистить не вышло. */
    async clear(kind: CacheKind): Promise<boolean> {
      if (this.clearing) return false
      this.clearing = kind
      try {
        await tauriInvoke('storage_clear', { kind })
        await wait(CLEAR_SETTLE_MS)
        await this.refresh()
        return true
      } catch {
        return false
      } finally {
        this.clearing = null
      }
    },
  },
})
