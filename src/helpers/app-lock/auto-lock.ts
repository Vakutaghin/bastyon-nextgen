// Автоблокировка: приложение закрывается само, если им не пользовались.
//
// «Пользуются» — нажимают, водят мышью, листают, печатают, или на открытом
// экране идёт ролик (смотреть фильм не значит бросить приложение). Свёрнутое
// приложение событий не получает, так что время без дела копится само и
// проверяется при возврате.
//
// Свёрнуто ли — на телефоне по appStateChange Capacitor: WebView в фоне
// Android нарочно держится «видимым» (MainActivity.onPause, ради звука), и
// visibilitychange там не приходит. На компьютере и в браузере — по
// visibilitychange: окно свернули, спрятали в трей, ушли на другую вкладку.

export interface AutoLockOptions {
  /** Сколько можно не трогать приложение; 0 — закрыть при сворачивании; null — не закрывать. */
  timeoutMs: () => number | null
  isLocked: () => boolean
  lock: () => void
  /** Телефон: свёрнуто ли приложение — по событиям Capacitor App. */
  subscribeAppState?: (listener: (active: boolean) => void) => () => void
  now?: () => number
}

/** Брошенное открытым при «Сразу» — ждёт столько же, сколько при «5 минутах». */
export const FOREGROUND_IDLE_FOR_NOW_MS = 5 * 60_000
/** Как часто сверяться с часами, пока приложение открыто. */
export const TICK_MS = 10_000

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'scroll', 'touchstart']

function mediaPlaying(): boolean {
  const media = document.querySelectorAll<HTMLMediaElement>('video, audio')
  for (const el of media) if (!el.paused && !el.ended) return true
  return false
}

export interface AutoLock {
  /** Отсчёт заново — после разблокировки. */
  touch(): void
  stop(): void
}

export function startAutoLock(opts: AutoLockOptions): AutoLock {
  const now = opts.now ?? Date.now
  let lastActive = now()
  let foreground = true

  const touch = (): void => {
    lastActive = now()
  }

  const check = (): void => {
    if (opts.isLocked()) return
    const timeout = opts.timeoutMs()
    if (timeout === null) return
    // Ролик на открытом экране — приложением пользуются. В фоне звук играет
    // сам по себе: вернулись через час — это уже вход.
    if (foreground && mediaPlaying()) {
      touch()
      return
    }
    const limit = timeout === 0 && foreground ? FOREGROUND_IDLE_FOR_NOW_MS : timeout
    if (now() - lastActive >= limit) opts.lock()
  }

  const onBackground = (): void => {
    if (!foreground) return
    foreground = false
    if (opts.timeoutMs() === 0 && !opts.isLocked()) opts.lock()
  }

  const onForeground = (): void => {
    if (foreground) return
    // Сперва проверка, потом «на экране»: звук, игравший в фоне, вход не отменяет.
    check()
    foreground = true
  }

  for (const type of ACTIVITY_EVENTS) {
    window.addEventListener(type, touch, { capture: true, passive: true })
  }

  let unsubscribeApp: (() => void) | null = null
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') onBackground()
    else onForeground()
  }
  if (opts.subscribeAppState) {
    unsubscribeApp = opts.subscribeAppState((active) => (active ? onForeground() : onBackground()))
  } else {
    document.addEventListener('visibilitychange', onVisibility)
  }
  // Таймеры в свёрнутом окне браузер придерживает — сверяемся и при возврате фокуса.
  window.addEventListener('focus', check)
  const timer = setInterval(check, TICK_MS)

  return {
    touch,
    stop() {
      for (const type of ACTIVITY_EVENTS) {
        window.removeEventListener(type, touch, { capture: true })
      }
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', check)
      unsubscribeApp?.()
      clearInterval(timer)
    },
  }
}

/** Свёрнуто ли приложение — по appStateChange Capacitor (телефон). */
export function capacitorAppState(listener: (active: boolean) => void): () => void {
  let stopped = false
  let remove: (() => Promise<void>) | null = null
  void import('@capacitor/app')
    .then(({ App }) => App.addListener('appStateChange', ({ isActive }) => listener(isActive)))
    .then((handle) => {
      if (stopped) void handle.remove()
      else remove = () => handle.remove()
    })
    .catch(() => {})
  return () => {
    stopped = true
    void remove?.()
  }
}
