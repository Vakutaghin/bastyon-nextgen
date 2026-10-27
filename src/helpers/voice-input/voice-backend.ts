/**
 * Где работает голосовой ввод. На компьютере — команды `asr_*` и события
 * `asr:*` Tauri (src-tauri/src/asr). На Android — плагин VoiceInput
 * (android/app/src/main/java/com/bastyon/app/plugins/voice/VoiceInputPlugin.java)
 * с тем же движком на Rust, теми же событиями и полями: стор голосового ввода
 * не различает, где он.
 */

import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

interface VoiceInputPlugin {
  status(): Promise<unknown>
  install(o: { model: string }): Promise<void>
  cancelInstall(): Promise<void>
  remove(o: { model: string }): Promise<void>
  start(o: { model: string; language: string; prompt: string }): Promise<{ session: number }>
  stop(o: { session: number }): Promise<void>
  cancel(o: { session: number }): Promise<void>
  openMicSettings(): Promise<void>
  addListener(event: string, cb: (payload: unknown) => void): Promise<PluginListenerHandle>
}

const VoiceInput = registerPlugin<VoiceInputPlugin>('VoiceInput')

export function isTauriVoice(): boolean {
  if (typeof window === 'undefined') return false
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window
}

export function isAndroidVoice(): boolean {
  return Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('VoiceInput')
}

export function voiceAvailable(): boolean {
  return isTauriVoice() || isAndroidVoice()
}

type Args = Record<string, unknown>

async function androidInvoke(cmd: string, args: Args): Promise<unknown> {
  const model = String(args.model ?? '')
  const session = Number(args.session ?? 0)
  switch (cmd) {
    case 'asr_status':
      return VoiceInput.status()
    case 'asr_install':
      return VoiceInput.install({ model })
    case 'asr_cancel_install':
      return VoiceInput.cancelInstall()
    case 'asr_remove':
      return VoiceInput.remove({ model })
    case 'asr_start': {
      const started = await VoiceInput.start({
        model,
        language: String(args.language ?? ''),
        prompt: String(args.prompt ?? ''),
      })
      return started.session
    }
    case 'asr_stop':
      return VoiceInput.stop({ session })
    case 'asr_cancel':
      return VoiceInput.cancel({ session })
    case 'asr_open_mic_settings':
      return VoiceInput.openMicSettings()
    default:
      throw new Error(`unsupported: ${cmd}`)
  }
}

/** Команда движка; ошибка — «код: подробности», как у компьютера. */
export async function voiceInvoke<T>(cmd: string, args?: Args): Promise<T> {
  if (isTauriVoice()) {
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke<T>(cmd, args)
  }
  return (await androidInvoke(cmd, args ?? {})) as T
}

/** Подписка на событие движка; возвращает отписку. */
export async function voiceListen<T>(event: string, cb: (payload: T) => void): Promise<() => void> {
  if (isTauriVoice()) {
    const { listen } = await import('@tauri-apps/api/event')
    return listen<T>(event, (e) => cb(e.payload))
  }
  const handle = await VoiceInput.addListener(event, (payload) => cb(payload as T))
  return () => void handle.remove()
}
