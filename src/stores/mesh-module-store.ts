/**
 * Модуль mesh-сетей в приложении для компьютера: радио (USB, Bluetooth, Wi-Fi)
 * и узел Reticulum — отдельная программа, которую приложение скачивает, когда
 * человек сам попросит, как Tor и IPFS (src-tauri `mesh`). Без модуля команды
 * `radio_*` и `rns_*` отвечают `mesh_module_missing`.
 *
 * На Android mesh встроен в приложение — модуля там нет, `required` — false.
 * Страница «Mesh-сети» и настройки показывают одно и то же состояние отсюда.
 * Модули Tauri в вебе не грузятся (N17): только `import()` внутри действий.
 */

import { defineStore } from 'pinia'

import { isTauri } from '@/b-components/video-uploader/utils/environment'
import { t } from '@/i18n'
import { moduleErrorCode, type ModuleProgress } from './compression-module-store'

interface ModuleStatus {
  supported: boolean
  installed: boolean
  current: boolean
  installing: boolean
  running: boolean
  /** Сколько скачивать, байт. */
  size: number
}

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

async function tauriListen<T>(event: string, cb: (payload: T) => void): Promise<() => void> {
  const { listen } = await import('@tauri-apps/api/event')
  return listen<T>(event, (e) => cb(e.payload))
}

/** Причина сбоя — человеку. */
export function describeMeshModuleError(error: unknown): string {
  switch (moduleErrorCode(error)) {
    case 'tor_not_ready':
      return t('mesh.module.errTor')
    case 'download_failed':
      return t('mesh.module.errDownload')
    case 'hash_mismatch':
    case 'size_mismatch':
      return t('mesh.module.errHash')
    case 'unsupported_platform':
      return t('mesh.module.unsupported')
    default:
      return t('mesh.module.errInstall')
  }
}

export const useMeshModuleStore = defineStore('mesh-module', {
  state: () => ({
    /** Состояние уже спрашивали у приложения. */
    loaded: false,
    /** Модуль для этой сборки и системы есть. */
    supported: false,
    installed: false,
    /** Модуль этой версии приложения (или новый уже скачан и встанет сам). */
    current: false,
    size: 0,
    progress: null as ModuleProgress | null,
    error: '',
  }),

  getters: {
    /** Mesh работает через модуль: приложение для компьютера. */
    required: (): boolean => isTauri(),
    installing: (state): boolean => state.progress !== null,
    /** Модуль на месте — радио и Reticulum работают. */
    ready(state): boolean {
      return !this.required || state.installed
    },
    percent(state): number {
      if (!state.progress?.total) return 0
      return Math.min(100, Math.round((state.progress.received / state.progress.total) * 100))
    },
  },

  actions: {
    async refresh(): Promise<void> {
      if (!this.required) {
        this.loaded = true
        return
      }
      const status = await tauriInvoke<ModuleStatus>('mesh_module_status').catch(() => null)
      this.supported = !!status?.supported
      this.installed = !!status?.installed
      this.current = !!status?.current
      this.size = status?.size ?? 0
      this.loaded = true
    },

    /** Скачать модуль (или его новую версию); true — mesh можно включать. */
    async install(): Promise<boolean> {
      if (this.progress) return false
      this.error = ''
      this.progress = { received: 0, total: this.size }
      const unlisten = await tauriListen<ModuleProgress>('mesh:install-progress', (p) => {
        if (this.progress) this.progress = p
      }).catch(() => null)
      try {
        await tauriInvoke('mesh_module_install')
        await this.refresh()
        return this.installed
      } catch (e) {
        if (moduleErrorCode(e) !== 'cancelled') this.error = describeMeshModuleError(e)
        return false
      } finally {
        unlisten?.()
        this.progress = null
      }
    },

    async cancel(): Promise<void> {
      await tauriInvoke('mesh_module_cancel_install').catch(() => {})
    },

    async remove(): Promise<void> {
      await tauriInvoke('mesh_module_remove')
      await this.refresh()
    },
  },
})
