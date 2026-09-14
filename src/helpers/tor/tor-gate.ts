/**
 * Режим маршрутизации сетевых запросов при включённом Tor (V20, fail-closed).
 *
 * Раньше `shouldTorify = enabled && status === 'ready'`: пока Tor ставился или
 * бутстрапился (10–60 с на каждом старте) и после `failed`, все запросы —
 * RPC с подписью, WS с адресом, Matrix — уходили напрямую. Теперь при
 * включённом Tor есть только три исхода: через Tor, ожидание готовности или
 * ошибка `TorNotReadyError`. Прямого соединения нет.
 */

import { watch } from 'vue'

import type { TorStatus } from '@/stores/tor-store'

export type TorRoutingMode = 'direct' | 'tor' | 'wait' | 'failed'

export class TorNotReadyError extends Error {
  override readonly name = 'TorNotReadyError'
  constructor(
    readonly reason: TorStatus | 'timeout',
    message?: string
  ) {
    super(message ?? `Tor is enabled but not ready (${reason})`)
  }
}

export function isTorNotReadyError(e: unknown): e is TorNotReadyError {
  return (
    e instanceof TorNotReadyError || (e as { name?: string } | null)?.name === 'TorNotReadyError'
  )
}

export interface TorGateState {
  available: boolean
  enabled: boolean
  status: TorStatus
}

/** Чистое правило — геттер стора и тесты. */
export function routingModeOf(s: TorGateState): TorRoutingMode {
  if (!s.available || !s.enabled) return 'direct'
  if (s.status === 'ready') return 'tor'
  if (s.status === 'failed') return 'failed'
  // 'off' с enabled=true — hydrate ещё не дошёл до tor_start; installing /
  // starting / bootstrapping — ждём.
  return 'wait'
}

/** Сколько ждём готовности Tor, прежде чем отдать ошибку (установка + бутстрап). */
export const TOR_WAIT_TIMEOUT_MS = 120_000

async function getStore() {
  const { useTorStore } = await import('@/stores/tor-store')
  return useTorStore()
}

export async function torRoutingMode(): Promise<TorRoutingMode> {
  try {
    return (await getStore()).routingMode
  } catch {
    // Нет pinia (тесты, воркеры) — значит и Tor-стора нет.
    return 'direct'
  }
}

/**
 * Ждёт выхода из `wait`. Резолвится итоговым режимом (`tor`, `direct` — если
 * Tor выключили, `failed`); при abort — `AbortError`, при таймауте —
 * `TorNotReadyError('timeout')`.
 */
export async function waitForTorRouting(
  opts: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<TorRoutingMode> {
  const store = await getStore()
  if (store.routingMode !== 'wait') return store.routingMode

  return new Promise<TorRoutingMode>((resolve, reject) => {
    const timeoutMs = opts.timeoutMs ?? TOR_WAIT_TIMEOUT_MS
    let stopWatch: () => void = () => {}
    let timer: ReturnType<typeof setTimeout> | null = null

    const cleanup = () => {
      stopWatch()
      if (timer) clearTimeout(timer)
      opts.signal?.removeEventListener('abort', onAbort)
    }
    const onAbort = () => {
      cleanup()
      reject(new DOMException('Aborted', 'AbortError'))
    }

    if (opts.signal?.aborted) {
      onAbort()
      return
    }
    opts.signal?.addEventListener('abort', onAbort)
    timer = setTimeout(() => {
      cleanup()
      reject(new TorNotReadyError('timeout'))
    }, timeoutMs)
    stopWatch = watch(
      () => store.routingMode,
      (mode) => {
        if (mode === 'wait') return
        cleanup()
        resolve(mode)
      },
      { flush: 'sync' }
    )
  })
}
