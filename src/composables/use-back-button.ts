/**
 * Системная кнопка «Назад» на Android — как Esc на компьютере: сначала
 * закрывает то, что открыто сверху (картинку, окно поста, диалог, сам чат), и
 * только потом листает историю страниц.
 *
 * Без своего обработчика Capacitor App на «Назад» сразу листает историю
 * WebView, и открытый поверх страницы чат оставался, а страница под ним
 * менялась. Теперь обработчики — стопкой: последний добавленный спрашивается
 * первым, вернул true — шаг съеден. Никто не взял — как раньше: назад по
 * истории, а на первой странице ничего.
 */

import { onScopeDispose, watch, type WatchSource } from 'vue'
import { Capacitor } from '@capacitor/core'
import { logger } from '@/services/logger'

const log = logger.scope('[back-button]')

/** true — закрыл своё, дальше «Назад» не идёт. */
export type BackHandler = () => boolean

const handlers: BackHandler[] = []

/** Добавить обработчик поверх остальных; вернёт функцию, которая его убирает. */
export function pushBackHandler(handler: BackHandler): () => void {
  handlers.push(handler)
  return () => {
    const index = handlers.lastIndexOf(handler)
    if (index >= 0) handlers.splice(index, 1)
  }
}

/** Отдать «Назад» обработчикам сверху вниз. false — никто не взял. */
export function handleBack(): boolean {
  for (let i = handlers.length - 1; i >= 0; i--) {
    if (handlers[i]!()) return true
  }
  return false
}

/**
 * Пока `open`, «Назад» закрывает это (`close`), а не то, что под ним. Для
 * того, что открывается поверх: просмотр картинки, меню, пикер.
 */
export function useCloseOnBack(open: WatchSource<boolean>, close: () => void): void {
  let release: (() => void) | null = null
  const stop = (): void => {
    release?.()
    release = null
  }
  watch(
    open,
    (isOpen) => {
      stop()
      if (isOpen) {
        release = pushBackHandler(() => {
          close()
          return true
        })
      }
    },
    { immediate: true }
  )
  onScopeDispose(stop)
}

/** Перехватить системную «Назад» — только на Android, кнопка есть только там. */
export async function setupBackButton(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return
  try {
    const { App } = await import('@capacitor/app')
    await App.addListener('backButton', ({ canGoBack }) => {
      if (handleBack()) return
      if (canGoBack) window.history.back()
    })
  } catch (e) {
    log.warn('back button listener failed', e)
  }
}

/** Сброс стопки — только для тестов. */
export function resetBackHandlersForTests(): void {
  handlers.length = 0
}
