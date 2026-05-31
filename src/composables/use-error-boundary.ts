/**
 * Глобальный обработчик неотловленных ошибок Vue/Promise.
 *
 * Подход: `app.config.errorHandler` ловит ошибки внутри Vue (рендер, watchers,
 * lifecycle); `window.onerror` и `unhandledrejection` — всё остальное.
 * Все попадания идут в один синк: логируем в консоль и показываем тост.
 *
 * `installGlobalErrorHandler(app)` вызывается в `main.js` один раз до
 * монтирования. Pattern из Vue 3 docs:
 * https://vuejs.org/api/application.html#app-config-errorhandler
 */

import type { App } from 'vue'
import { appToast } from '@/b-components/app-toast'
import { t } from '@/i18n'

type LoggableError = unknown

/** Текущее окно отчётов — чтобы не спамить пользователя одной и той же ошибкой подряд. */
const recentErrorMessages = new Set<string>()
const ERROR_DEDUPE_WINDOW_MS = 1500

function messageOf(err: LoggableError): string {
  if (err instanceof Error) return err.message || err.name || 'Unknown error'
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

function reportError(err: LoggableError, context: string): void {
  const msg = messageOf(err)

  // Подавляем повторные одинаковые ошибки в коротком окне — типично для
  // циклов в watcher'е (один логический баг, сотни срабатываний).
  if (recentErrorMessages.has(msg)) {
    console.error(`[error-boundary:${context}]`, err)
    return
  }
  recentErrorMessages.add(msg)
  setTimeout(() => recentErrorMessages.delete(msg), ERROR_DEDUPE_WINDOW_MS)

  console.error(`[error-boundary:${context}]`, err)
  // В dev — заметный тост; в проде — короткое уведомление без подробностей,
  // чтобы не пугать пользователя стек-трейсами.
  if (import.meta.env.DEV) {
    appToast.error({
      message: t('appMsg.error.devTitle', { context }),
      description: msg,
      duration: 6,
    })
  } else {
    appToast.error({
      message: t('appMsg.error.genericTitle'),
      description: t('appMsg.error.genericReload'),
      duration: 4,
    })
  }
}

export function installGlobalErrorHandler(app: App): void {
  app.config.errorHandler = (err, _instance, info) => {
    reportError(err, `vue:${info}`)
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      reportError(event.error ?? event.message, 'window')
    })
    window.addEventListener('unhandledrejection', (event) => {
      reportError(event.reason, 'promise')
    })
  }
}
