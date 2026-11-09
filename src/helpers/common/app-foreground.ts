/**
 * Свёрнуто ли приложение и когда оно вернулось — один сигнал для всех
 * платформ.
 *
 * На Android свёрнутость первым знает `appStateChange` Capacitor: страница
 * WebView становится скрытой (`visibilitychange`) секунды через четыре
 * (эмулятор API 35, WebView 124), а таймеры и сеть всё это время работают.
 * В браузере и на компьютере — по видимости страницы.
 *
 * Зачем это сети: пока приложение в фоне, система может отрезать ему сеть, и
 * запросы падают, хотя прокси живы. Такой сбой — не повод уходить к нодам, а
 * по возвращении стоит сразу переподключиться, не дожидаясь пауз повторов.
 *
 * И батарее: свёрнутое мобильное приложение не гасят, пока играет звук, — часами.
 * Опросы, которые нужны только экрану, тогда ждут возвращения
 * (`isMobileAppInBackground`). На компьютере и в браузере свёрнутое окно
 * по-прежнему получает уведомления — там ничего не откладываем.
 */

import { Capacitor } from '@capacitor/core'

type ForegroundListener = (awayMs: number) => void

const listeners = new Set<ForegroundListener>()
let started = false
let background = false
let hiddenAt = 0
let shownAt = 0

function setActive(active: boolean, now = Date.now()): void {
  if (!active) {
    if (!background) hiddenAt = now
    background = true
    return
  }
  if (!background) return
  background = false
  shownAt = now
  const awayMs = now - hiddenAt
  for (const listener of [...listeners]) {
    try {
      listener(awayMs)
    } catch {
      // подписчик не должен ломать остальных
    }
  }
}

function start(): void {
  if (started) return
  started = true
  if (Capacitor.isNativePlatform()) {
    void import('@capacitor/app')
      .then(({ App }) => App.addListener('appStateChange', ({ isActive }) => setActive(isActive)))
      .catch(() => {})
    return
  }
  if (typeof document === 'undefined') return
  background = document.visibilityState === 'hidden'
  if (background) hiddenAt = Date.now()
  document.addEventListener('visibilitychange', () =>
    setActive(document.visibilityState !== 'hidden')
  )
}

/** Приложение вернулось из фона; `awayMs` — сколько его не было. */
export function onAppForeground(listener: ForegroundListener): () => void {
  start()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Свёрнуто ли приложение сейчас. */
export function isAppInBackground(): boolean {
  start()
  return background
}

/**
 * Экрана не видно: приложение свёрнуто или страница скрыта. На Android первое
 * приходит на секунды раньше второго.
 */
export function isAppHidden(): boolean {
  return isAppInBackground() || (typeof document !== 'undefined' && document.hidden)
}

/**
 * Свёрнуто мобильное приложение: опрос, нужный только экрану, пропускаем и
 * догоняем при возвращении (`onAppForeground`). На компьютере и в браузере —
 * всегда false: там свёрнутое окно показывает уведомления.
 */
export function isMobileAppInBackground(): boolean {
  return Capacitor.isNativePlatform() && isAppInBackground()
}

/** Сколько прошло с возвращения из фона; Infinity — в фон ещё не уходило. */
export function msSinceForeground(now = Date.now()): number {
  start()
  return shownAt ? now - shownAt : Infinity
}

/** Для тестов: сменить состояние, как это сделала бы система. */
export function setAppActiveForTests(active: boolean, now?: number): void {
  start()
  setActive(active, now)
}

/** Сброс для тестов. */
export function resetAppForegroundForTests(): void {
  listeners.clear()
  background = false
  hiddenAt = 0
  shownAt = 0
}
