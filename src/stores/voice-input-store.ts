import { defineStore } from 'pinia'

import { t } from '@/i18n'
import { appToast } from '@/b-components/app-toast'

/**
 * Голосовой ввод в десктопе: распознавание прямо на компьютере
 * (src-tauri/src/asr). Стор держит модели, скачивание, одну активную диктовку
 * и раздаёт распознанный текст полю, которое её начало.
 */

export type VoiceModelId = 'base' | 'small' | 'turbo'

export interface VoiceModelInfo {
  id: VoiceModelId
  /** Байт к скачиванию (вместе с детектором речи, если его ещё нет). */
  size: number
  installed: boolean
}

export interface VoiceStatus {
  supported: boolean
  gpu: boolean
  models: VoiceModelInfo[]
  installing: VoiceModelId | null
}

export type VoicePhase = 'idle' | 'starting' | 'listening' | 'finishing'
export type VoiceModalPhase = 'consent' | 'progress' | 'error' | 'unsupported'

/** Поле, в которое диктуют (регистрирует use-voice-dictation). */
export interface DictationTarget {
  id: string
  /** Язык речи — коды интерфейса (ru, en, kr…). */
  language: () => string
  /** Текст перед курсором: подсказка модели о стиле и именах. */
  context: () => string
  insert: (text: string) => void
}

interface InstallProgress {
  model: VoiceModelId
  received: number
  total: number
}

const LS_MODEL = 'voiceInput:model'
export const DEFAULT_VOICE_MODEL: VoiceModelId = 'small'
const MODEL_IDS: VoiceModelId[] = ['base', 'small', 'turbo']

/** Поля с диктовкой; не реактивно — стор хранит только id владельца. */
const targets = new Map<string, DictationTarget>()

function isTauriEnv(): boolean {
  if (typeof window === 'undefined') return false
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window
}

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

function loadModel(): VoiceModelId {
  try {
    const raw = localStorage.getItem(LS_MODEL)
    if (raw && (MODEL_IDS as string[]).includes(raw)) return raw as VoiceModelId
  } catch {
    // нет localStorage — модель по умолчанию
  }
  return DEFAULT_VOICE_MODEL
}

/** Код ошибки из Rust: «mic_error: подробности» → «mic_error». */
export function voiceErrorCode(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  return raw.split(':')[0]!.trim() || 'engine_error'
}

const ERROR_KEYS: Record<string, string> = {
  mic_denied: 'voiceInput.errors.micDenied',
  no_microphone: 'voiceInput.errors.noMicrophone',
  mic_busy: 'voiceInput.errors.micBusy',
  unsupported_cpu: 'voiceInput.errors.unsupportedCpu',
  tor_not_ready: 'voiceInput.errors.torNotReady',
  download_failed: 'voiceInput.errors.downloadFailed',
  hash_mismatch: 'voiceInput.errors.hashMismatch',
  size_mismatch: 'voiceInput.errors.hashMismatch',
  busy: 'voiceInput.errors.busy',
}

export function voiceErrorText(code: string): string {
  return t(ERROR_KEYS[code] ?? 'voiceInput.errors.generic')
}

export const useVoiceInputStore = defineStore('voice-input', {
  state: () => ({
    available: isTauriEnv(),
    status: null as VoiceStatus | null,
    /** Выбранная модель (для скачивания и диктовки). */
    model: loadModel(),
    phase: 'idle' as VoicePhase,
    session: null as number | null,
    /** Поле, которое сейчас диктует. */
    ownerId: null as string | null,
    level: 0,
    speaking: false,
    /** Модель загружается в память (первый раз после установки — дольше). */
    loading: false,
    /** Фраз ждут распознавания. */
    pending: 0,
    install: null as InstallProgress | null,
    modalOpen: false,
    modalPhase: 'consent' as VoiceModalPhase,
    modalError: '',
    /** Поле, которое начнёт диктовку, как только скачается модель. */
    pendingOwner: null as string | null,
    /** Последняя сессия, которую видел стор: поздние события старых — мимо. */
    lastSession: 0,
    _subscribed: false,
  }),

  getters: {
    usable(state): boolean {
      return state.available && state.status?.supported !== false
    },
    installedModels(state): VoiceModelId[] {
      return (state.status?.models ?? []).filter((m) => m.installed).map((m) => m.id)
    },
    /** Модель для диктовки: выбранная, а если она не скачана — любая скачанная. */
    activeModel(): VoiceModelId | null {
      const installed = this.installedModels
      if (installed.includes(this.model)) return this.model
      return installed[installed.length - 1] ?? null
    },
    installPercent(state): number {
      if (!state.install?.total) return 0
      return Math.min(100, Math.round((state.install.received / state.install.total) * 100))
    },
  },

  actions: {
    register(target: DictationTarget): void {
      targets.set(target.id, target)
    },

    unregister(id: string): void {
      targets.delete(id)
      if (this.pendingOwner === id) this.pendingOwner = null
    },

    setModel(model: VoiceModelId): void {
      this.model = model
      try {
        localStorage.setItem(LS_MODEL, model)
      } catch {
        // не сохранили выбор — спросим модель по умолчанию в следующий раз
      }
    },

    async refresh(): Promise<VoiceStatus | null> {
      if (!this.available) return null
      try {
        this.status = await tauriInvoke<VoiceStatus>('asr_status')
      } catch (e) {
        console.warn('[voice-input] asr_status failed:', e)
      }
      return this.status
    },

    /**
     * Событие этой диктовки? Rust может прислать первые события раньше, чем
     * asr_start вернёт id (ответ и события идут разными каналами): пока
     * запуск не подтверждён, принимаем новую сессию по первому событию.
     */
    owns(session: number): boolean {
      if (session === this.session) return true
      if (this.phase === 'starting' && this.session === null && session > this.lastSession) {
        this.session = session
        this.lastSession = session
        return true
      }
      return false
    },

    async subscribe(): Promise<void> {
      if (this._subscribed || !this.available) return
      this._subscribed = true
      // Модуль событий — один раз, подписки по очереди.
      const { listen } = await import('@tauri-apps/api/event')
      const on = <T>(event: string, cb: (payload: T) => void) =>
        listen<T>(event, (e) => cb(e.payload))
      await on<InstallProgress>('asr:install-progress', (p) => {
        this.install = p
      })
      await on<{ session: number; level: number; speaking: boolean }>('asr:level', (p) => {
        if (!this.owns(p.session) || this.phase === 'finishing') return
        this.level = p.level
        this.speaking = p.speaking
      })
      await on<{ session: number; loading: boolean; pending: number }>('asr:state', (p) => {
        if (!this.owns(p.session)) return
        this.loading = p.loading
        this.pending = p.pending
      })
      await on<{ session: number; seq: number; text: string }>('asr:text', (p) => {
        if (!this.owns(p.session) || !this.ownerId) return
        targets.get(this.ownerId)?.insert(p.text)
      })
      await on<{ session: number; reason: string; error: string | null }>('asr:end', (p) => {
        if (!this.owns(p.session)) return
        this.finishSession()
        if (p.reason === 'error' && p.error) this.reportError(voiceErrorCode(p.error))
      })
    },

    finishSession(): void {
      this.phase = 'idle'
      this.session = null
      this.ownerId = null
      this.level = 0
      this.speaking = false
      this.loading = false
      this.pending = 0
    },

    reportError(code: string): void {
      if (code === 'model_missing') {
        void this.refresh()
        this.openModal('consent')
        return
      }
      appToast.error({ message: voiceErrorText(code), duration: 8 })
    },

    openModal(phase: VoiceModalPhase, error = ''): void {
      this.modalPhase = phase
      this.modalError = error
      this.modalOpen = true
    },

    /** Кнопка поля: начать, закончить или (если уже дораспознаёт) прервать. */
    async toggle(ownerId: string): Promise<void> {
      if (this.ownerId === ownerId && this.phase !== 'idle') {
        if (this.phase === 'finishing') await this.cancel()
        else await this.stop()
        return
      }
      await this.start(ownerId)
    },

    async start(ownerId: string): Promise<void> {
      const target = targets.get(ownerId)
      if (!this.available || !target) return
      await this.subscribe()
      const status = await this.refresh()
      if (!status) return
      if (!status.supported) {
        this.openModal('unsupported')
        return
      }
      const model = this.activeModel
      if (!model) {
        this.pendingOwner = ownerId
        if (!this.install) this.openModal('consent')
        else this.openModal('progress')
        return
      }
      if (this.session !== null) await this.cancel()
      this.phase = 'starting'
      this.ownerId = ownerId
      this.level = 0
      this.speaking = false
      this.pending = 0
      try {
        const session = await tauriInvoke<number>('asr_start', {
          model,
          language: target.language(),
          prompt: target.context(),
        })
        this.lastSession = Math.max(this.lastSession, session)
        // Пока ждали ответа, поле могли закрыть, отменить запуск — или
        // сессия уже закончилась с ошибкой (пришло asr:end).
        if (this.ownerId !== ownerId || (this.phase !== 'starting' && this.session !== session)) {
          if (this.session === session || this.session === null)
            void tauriInvoke('asr_cancel', { session })
          return
        }
        if (this.phase === 'starting') {
          this.session = session
          this.phase = 'listening'
        }
      } catch (e) {
        this.finishSession()
        this.reportError(voiceErrorCode(e))
      }
    },

    /** Закончить: сказанное дораспознается и допишется в поле. */
    async stop(): Promise<void> {
      if (this.session === null) {
        this.finishSession()
        return
      }
      this.phase = 'finishing'
      this.level = 0
      this.speaking = false
      await tauriInvoke('asr_stop', { session: this.session }).catch(() => this.finishSession())
    },

    /** Прервать без хвоста: поле закрыли, или ждать распознавания не хотят. */
    async cancel(): Promise<void> {
      const session = this.session
      this.finishSession()
      if (session !== null) await tauriInvoke('asr_cancel', { session }).catch(() => {})
    },

    async installModel(model: VoiceModelId = this.model): Promise<void> {
      if (this.install) return
      this.setModel(model)
      const info = this.status?.models.find((m) => m.id === model)
      this.install = { model, received: 0, total: info?.size ?? 0 }
      this.openModal('progress')
      try {
        await tauriInvoke('asr_install', { model })
        await this.refresh()
        const wasOpen = this.modalOpen && this.modalPhase === 'progress'
        this.modalOpen = false
        const owner = this.pendingOwner
        this.pendingOwner = null
        if (wasOpen && owner && targets.has(owner)) {
          await this.start(owner)
        } else {
          appToast.success({ message: t('voiceInput.ready') })
        }
      } catch (e) {
        const code = voiceErrorCode(e)
        if (code === 'cancelled') {
          this.modalOpen = false
          this.pendingOwner = null
        } else {
          this.openModal('error', code)
        }
      } finally {
        this.install = null
        void this.refresh()
      }
    },

    async cancelInstall(): Promise<void> {
      await tauriInvoke('asr_cancel_install').catch(() => {})
    },

    async removeModel(model: VoiceModelId): Promise<void> {
      if (this.session !== null) await this.cancel()
      await tauriInvoke('asr_remove', { model })
      await this.refresh()
    },

    closeModal(): void {
      this.modalOpen = false
      // Скачивание продолжается в фоне; диктовку по окончании не начинаем.
      this.pendingOwner = null
    },
  },
})
