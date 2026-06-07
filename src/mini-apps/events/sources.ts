/**
 * Push-event sources: host → iframe (этап 6).
 *
 * `setupEventSources({router})` подключает все источники к
 * `miniAppsBridge.pushAll(key, data)`. Возвращает `cleanup()` — снимает все
 * подписки (вызывается в HMR / unmount / тестах).
 *
 * Источники:
 * - `theme.changed` — `useUIStore().theme`
 * - `locale.changed` — `useUIStore().language`
 * - `block`         — `wsService.on('block')` (новый tip-блок)
 * - `transaction`   — `wsService.on('transaction')` (любая tx через WS)
 * - `changestate`   — `router.afterEach` (синхронизация роутинга)
 * - `keyboard`      — Capacitor Keyboard show/hide (только на mobile)
 *
 * Принципиально:
 * - Sources не знают про конкретные iframe — рассылают через `pushAll`.
 *   Bridge сам фильтрует доставку по зарегистрированным `listenerId`.
 * - При отсутствии источника (e.g. Capacitor Keyboard в web) — silent skip,
 *   не падаем. Это позволяет одной и той же функции работать на всех
 *   платформах (Tauri / Capacitor / web).
 */

import type { Router } from 'vue-router'
import { watch } from 'vue'
import { miniAppsBridge } from '@/mini-apps/core/bridge'
import { wsService } from '@/blockchain/ws/ws-service'
import { useUIStore } from '@/stores/ui-store'
import { logger } from '@/services/logger'

const log = logger.scope('[mini-apps:events]')

type Unsubscribe = () => void

export interface SetupEventSourcesOptions {
  router: Router
  /** Если true (по умолчанию), пытаемся подписаться на Capacitor Keyboard. */
  enableKeyboard?: boolean
}

export function setupEventSources(opts: SetupEventSourcesOptions): Unsubscribe {
  const cleanups: Unsubscribe[] = []

  // ─── theme.changed ────────────────────────────────────────────────────────
  const uiStore = useUIStore()
  cleanups.push(
    watch(
      () => uiStore.theme,
      (theme) => {
        miniAppsBridge.pushAll('theme.changed', { rootid: theme })
      }
    )
  )

  // ─── locale.changed ───────────────────────────────────────────────────────
  cleanups.push(
    watch(
      () => uiStore.language,
      (locale) => {
        miniAppsBridge.pushAll('locale.changed', { locale })
      }
    )
  )

  // ─── ws: block / transaction ──────────────────────────────────────────────
  cleanups.push(
    wsService.on('block', (data) => {
      miniAppsBridge.pushAll('block', data ?? {})
    })
  )
  cleanups.push(
    wsService.on('transaction', (data) => {
      miniAppsBridge.pushAll('transaction', data ?? {})
    })
  )

  // ─── changestate (router) ─────────────────────────────────────────────────
  cleanups.push(
    opts.router.afterEach((to) => {
      miniAppsBridge.pushAll('changestate', { path: to.fullPath })
    })
  )

  // ─── keyboard (Capacitor) ─────────────────────────────────────────────────
  if (opts.enableKeyboard !== false) {
    void attachKeyboard().then((dispose) => {
      if (dispose) cleanups.push(dispose)
    })
  }

  log.debug('event sources attached')

  return () => {
    for (const c of cleanups) {
      try {
        c()
      } catch (e) {
        log.warn('cleanup threw', e)
      }
    }
    cleanups.length = 0
  }
}

/**
 * Подписываемся на Capacitor Keyboard show/hide. Импорт динамический — модуль
 * есть только на capacitor-сборках, web/desktop его не зарезолвят.
 * Возвращает `() => void` для отписки, либо `null` если плагин недоступен.
 */
async function attachKeyboard(): Promise<Unsubscribe | null> {
  // Плагин Keyboard реализован только на нативных capacitor-сборках. На web
  // динамический импорт резолвится (модуль забандлен), но addListener кидает
  // «"Keyboard" plugin is not implemented on web». Поэтому отсекаем не-native
  // окружение заранее — иначе каждый boot пишет warn в консоль.
  try {
    const core = await import('@capacitor/core')
    if (!core.Capacitor?.isNativePlatform?.()) return null
  } catch {
    return null
  }

  let mod: typeof import('@capacitor/keyboard')
  try {
    mod = await import('@capacitor/keyboard')
  } catch {
    return null
  }
  try {
    const showH = await mod.Keyboard.addListener('keyboardWillShow', (info) => {
      miniAppsBridge.pushAll('keyboard', {
        state: 'show',
        height: info.keyboardHeight ?? 0,
      })
    })
    const hideH = await mod.Keyboard.addListener('keyboardWillHide', () => {
      miniAppsBridge.pushAll('keyboard', { state: 'hide', height: 0 })
    })
    return () => {
      void showH.remove()
      void hideH.remove()
    }
  } catch (e) {
    log.warn('Capacitor Keyboard attach failed', e)
    return null
  }
}
