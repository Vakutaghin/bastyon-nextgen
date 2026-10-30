/**
 * Вызов Tor. На компьютере — команды Tauri (src-tauri/src/tor), на Android —
 * плагин Tor (android/…/plugins/tor/TorPlugin.java): те же команды, аргументы,
 * ответы и события, логика Tor одна — крейт src-tauri/crates/bastyon-tor.
 *
 * Отличие одно. На компьютере окно грузит картинки и видео мимо Tor, поэтому
 * под Tor они запрещены (tor-media-policy). На Android всё окно идёт через
 * Tor (прокси WebView, TorNetwork.java), и медиа ничего не грозит.
 */

import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

import { applyTorMediaPolicy } from './tor-media-policy'

interface TorPlugin {
  call(options: { command: string; args?: Record<string, unknown> }): Promise<{ value: unknown }>
  guard(): Promise<void>
  addListener(
    eventName: 'event',
    cb: (e: { event: string; payload: unknown }) => void
  ): Promise<PluginListenerHandle>
}

const TorPluginNative = registerPlugin<TorPlugin>('Tor')

/** Tor встроен в APK: плагина нет, если Tor в сборку не попал. */
export function isAndroidTor(): boolean {
  return (
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === 'android' &&
    Capacitor.isPluginAvailable('Tor')
  )
}

/** Окно приложения целиком ходит через Tor, когда он включён. */
export function webViewThroughTor(): boolean {
  return isAndroidTor()
}

/** Как `invoke` Tauri: отказ — строка ошибки Rust (`tor_not_ready: …`). */
export async function torInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isAndroidTor()) {
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke<T>(cmd, args)
  }
  try {
    const { value } = await TorPluginNative.call({ command: cmd, args: args ?? {} })
    return value as T
  } catch (e) {
    throw (e as Error)?.message ?? String(e)
  }
}

const handlers = new Map<string, Set<(payload: unknown) => void>>()
let nativeListener: Promise<PluginListenerHandle> | null = null

/** Как `listen` Tauri; на Android один слушатель плагина на все события. */
export async function torListen<T>(event: string, cb: (payload: T) => void): Promise<() => void> {
  if (!isAndroidTor()) {
    const { listen } = await import('@tauri-apps/api/event')
    return listen<T>(event, (e) => cb(e.payload))
  }
  const handler = cb as (payload: unknown) => void
  let set = handlers.get(event)
  if (!set) {
    set = new Set()
    handlers.set(event, set)
  }
  set.add(handler)
  nativeListener ??= TorPluginNative.addListener('event', ({ event: name, payload }) => {
    for (const h of handlers.get(name) ?? []) h(payload)
  })
  await nativeListener
  return () => {
    const current = handlers.get(event)
    current?.delete(handler)
    if (current?.size === 0) handlers.delete(event)
  }
}

/**
 * До `tor_start`: ничто из окна не должно успеть уйти мимо Tor (V21). На
 * компьютере — запрет картинок и фреймов, на Android — прокси WebView в
 * никуда, пока Tor не подключится.
 */
export async function guardWebView(): Promise<void> {
  if (isAndroidTor()) {
    await TorPluginNative.guard().catch(() => {})
  } else {
    applyTorMediaPolicy()
  }
}
