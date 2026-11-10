// Сторож синка Matrix: «Обновляю…» не висит минутами.
//
// На Android первый ответ сервера после кэша иногда не приходит: запрос висит
// до таймаута чтения нативного HTTP (120 с), а подготовительные запросы SDK
// (push rules, фильтр) так же держат первый /sync. SDK сам повторяет запрос
// только после ошибки. Сторож раз в 10 с смотрит журнал (sync-journal):
//   - запрос синка ждёт дольше, чем сервер может держать опрос, ещё на 60 с, —
//     обрываем его; SDK уходит в RECONNECTING (или ERROR, если это был push
//     rules или фильтр), и matrix-service повторяет сразу (`recovering`), без
//     паузы SDK на проверку связи. Synapse пару минут
//     держит готовый ответ на тот же запрос, так что повтор его не теряет;
//   - «Обновляю…» (PREPARED, CATCHUP) дольше 60 с, а запросов в пути нет и
//     ответ не на разборе, — будим SDK (`retryImmediately`).
// Ответ, который SDK долго разбирает, не трогаем: перезапуск разобрал бы его
// заново. Это видно в журнале.
//
// Только при открытом приложении и с сетью: в фоне Android замораживает
// WebView, а без сети ждать ответа бессмысленно — там своя надпись.

import type { SyncJournal } from './sync-journal'

/** «Обновляю…» дольше — будим синк. */
export const STUCK_MS = 60_000
/** Запрос синка дольше своего опроса ещё на столько — обрываем. */
export const HUNG_GRACE_MS = 60_000
/** Не чаще одного перезапуска за столько. */
export const RECOVERY_GAP_MS = 60_000
/** Окно после обрыва, в котором RECONNECTING повторяется сразу. */
export const RECOVERY_RETRY_WINDOW_MS = 15_000
export const CHECK_MS = 10_000

export interface SyncWatchdogDeps {
  journal: SyncJournal
  client: () => { retryImmediately?: () => boolean } | null
  hidden: () => boolean
  offline: () => boolean
  now?: () => number
}

export type WatchdogAction = 'none' | 'aborted' | 'nudged'

export function createSyncWatchdog(deps: SyncWatchdogDeps) {
  const now = deps.now ?? (() => Date.now())
  const { journal } = deps
  let timer: ReturnType<typeof setInterval> | null = null
  let lastRecovery = -Infinity
  let retryUntil = -Infinity

  function check(t = now()): WatchdogAction {
    const client = deps.client()
    if (!client || deps.hidden() || deps.offline()) return 'none'
    if (t - lastRecovery < RECOVERY_GAP_MS) return 'none'

    const hung = journal.hungRequest(t, HUNG_GRACE_MS)
    if (hung) {
      journal.noteRecovery('request-hung', t - hung.started, hung.kind)
      lastRecovery = t
      retryUntil = t + RECOVERY_RETRY_WINDOW_MS
      hung.abort()
      return 'aborted'
    }

    const state = journal.state()
    const updating = state === 'PREPARED' || state === 'CATCHUP'
    if (
      updating &&
      journal.stateForMs(t) > STUCK_MS &&
      !journal.hasInFlight() &&
      journal.processingMs(t) === null
    ) {
      journal.noteRecovery('stuck', journal.stateForMs(t))
      lastRecovery = t
      client.retryImmediately?.()
      return 'nudged'
    }
    return 'none'
  }

  return {
    check,
    start(): void {
      if (!timer) timer = setInterval(() => check(), CHECK_MS)
    },
    stop(): void {
      if (timer) clearInterval(timer)
      timer = null
    },
    /** Сторож только что оборвал запрос: RECONNECTING или ERROR — повторить сразу. */
    recovering: (t = now()): boolean => t < retryUntil,
  }
}

export type SyncWatchdog = ReturnType<typeof createSyncWatchdog>
