/**
 * Модуль сжатия видео: FFmpeg, который приложение для компьютера скачивает,
 * когда человек сам об этом попросит, — видео грузят не все (src-tauri
 * `ffmpeg`). Если FFmpeg с x264 уже есть в системе, модуль не нужен: сжатие
 * доступно и так.
 *
 * Окно загрузки и настройки показывают одно и то же состояние отсюда.
 * Модули Tauri в вебе не грузятся (N17): только `import()` внутри действий.
 */

import { defineStore } from 'pinia'

import { isTauri } from '@/b-components/video-uploader/utils/environment'
import { t } from '@/i18n'

interface ModuleStatus {
  supported: boolean
  installed: boolean
  installing: boolean
  /** Сколько скачивать, байт. */
  size: number
  version: string
}

interface FfmpegAvailability {
  ffmpeg: boolean
  ffprobe: boolean
  x264: boolean
}

export interface ModuleProgress {
  received: number
  total: number
}

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

async function tauriListen<T>(event: string, cb: (payload: T) => void): Promise<() => void> {
  const { listen } = await import('@tauri-apps/api/event')
  return listen<T>(event, (e) => cb(e.payload))
}

/** Код ошибки из Rust: «download_failed: подробности» → «download_failed». */
export function moduleErrorCode(error: unknown): string {
  const raw = (error instanceof Error ? error.message : String(error ?? '')).trim()
  return raw.split(':')[0]!.trim() || 'install_failed'
}

/** Причина сбоя — человеку. */
export function describeModuleError(error: unknown): string {
  switch (moduleErrorCode(error)) {
    case 'tor_not_ready':
      return t('videoStudio.module.errTor')
    case 'download_failed':
      return t('videoStudio.module.errDownload')
    case 'hash_mismatch':
    case 'size_mismatch':
      return t('videoStudio.module.errHash')
    case 'unsupported_platform':
      return t('videoStudio.module.unsupported')
    default:
      return t('videoStudio.module.errInstall')
  }
}

export const useCompressionModuleStore = defineStore('compression-module', {
  state: () => ({
    /** Сжимать есть чем: модуль или системный FFmpeg с x264. null — ещё не проверяли. */
    available: null as boolean | null,
    /** Модуль для этой системы есть. */
    supported: false,
    /** Скачан именно модуль (а не системный FFmpeg). */
    installed: false,
    size: 0,
    progress: null as ModuleProgress | null,
    error: '',
  }),

  getters: {
    installing: (state): boolean => state.progress !== null,
    percent(state): number {
      if (!state.progress?.total) return 0
      return Math.min(100, Math.round((state.progress.received / state.progress.total) * 100))
    },
  },

  actions: {
    async refresh(): Promise<void> {
      if (!isTauri()) {
        this.available = false
        return
      }
      const status = await tauriInvoke<ModuleStatus>('ffmpeg_module_status').catch(() => null)
      const tools = await tauriInvoke<FfmpegAvailability>('check_ffmpeg_available').catch(
        () => null
      )
      this.supported = !!status?.supported
      this.installed = !!status?.installed
      this.size = status?.size ?? 0
      this.available = !!tools?.ffmpeg && !!tools.ffprobe && !!tools.x264
    },

    /** Скачать модуль; true — сжимать теперь есть чем. */
    async install(): Promise<boolean> {
      if (this.progress) return false
      this.error = ''
      this.progress = { received: 0, total: this.size }
      const unlisten = await tauriListen<ModuleProgress>('ffmpeg:install-progress', (p) => {
        if (this.progress) this.progress = p
      }).catch(() => null)
      try {
        await tauriInvoke('ffmpeg_module_install')
        await this.refresh()
        return !!this.available
      } catch (e) {
        if (moduleErrorCode(e) !== 'cancelled') this.error = describeModuleError(e)
        return false
      } finally {
        unlisten?.()
        this.progress = null
      }
    },

    async cancel(): Promise<void> {
      await tauriInvoke('ffmpeg_module_cancel_install').catch(() => {})
    },

    async remove(): Promise<void> {
      await tauriInvoke('ffmpeg_module_remove')
      await this.refresh()
    },
  },
})
