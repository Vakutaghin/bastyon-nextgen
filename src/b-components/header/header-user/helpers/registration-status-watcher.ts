// Поллинг статуса регистрации пользователя. Инкапсулирует setInterval, повторный запуск
// и единую точку остановки. UI-state (модалки, pendingNickname) остаются на стороне компонента
// — отдаются через коллбэки.

import type { RegistrationStatus } from '@/blockchain/api/registration-status'

interface WatcherCallbacks {
  /** Очередной чек прошёл, регистрация ещё в работе. */
  onStatusUpdate: (status: RegistrationStatus) => void
  /** Регистрация завершилась (isRegistrationInProgress вернул false). После этого watcher останавливается сам. */
  onComplete: (status: RegistrationStatus) => void
  /** Ошибка запроса/импорта. Watcher продолжает работать — пробует на следующем тике. */
  onError?: (err: unknown) => void
  /** Регистрация не подтвердилась за maxDurationMs — watcher остановлен (S13). */
  onTimeout?: () => void
}

interface WatcherOptions extends WatcherCallbacks {
  /** Период между чеками (мс). По умолчанию 5000. */
  intervalMs?: number
  /** Потолок поллинга (мс). По умолчанию 30 минут — как TTL pending-записи. */
  maxDurationMs?: number
}

/** Совпадает с TTL `pending_registration`: дольше ждать нечего. */
export const DEFAULT_MAX_POLL_MS = 30 * 60 * 1000

export interface RegistrationStatusWatcher {
  /** Запускает поллинг: сразу делает один чек, дальше — каждые intervalMs. */
  start: () => Promise<void>
  /** Останавливает поллинг. Безопасно вызывать повторно. */
  stop: () => void
  /** true, если watcher активно поллит. */
  isActive: () => boolean
}

/**
 * Создаёт watcher статуса регистрации. Не делает ничего до явного start().
 * Повторный start() сначала корректно останавливает старый интервал.
 */
export function createRegistrationStatusWatcher(opts: WatcherOptions): RegistrationStatusWatcher {
  const {
    onStatusUpdate,
    onComplete,
    onError,
    onTimeout,
    intervalMs = 5000,
    maxDurationMs = DEFAULT_MAX_POLL_MS,
  } = opts
  let timer: ReturnType<typeof setInterval> | null = null
  let deadline: ReturnType<typeof setTimeout> | null = null

  const stop = () => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    if (deadline) {
      clearTimeout(deadline)
      deadline = null
    }
  }

  const checkOnce = async () => {
    try {
      const { getRegistrationStatus, isRegistrationInProgress } =
        await import('@/blockchain/api/registration-status')
      const status = await getRegistrationStatus()
      if (isRegistrationInProgress(status)) {
        onStatusUpdate(status)
      } else {
        stop()
        onComplete(status)
      }
    } catch (err) {
      onError?.(err)
    }
  }

  const start = async () => {
    stop()
    timer = setInterval(() => {
      void checkOnce()
    }, intervalMs)
    // Раньше поллинг двух RPC каждые 5 с шёл бесконечно (S13).
    deadline = setTimeout(() => {
      stop()
      onTimeout?.()
    }, maxDurationMs)
    await checkOnce()
  }

  return { start, stop, isActive: () => timer !== null }
}
