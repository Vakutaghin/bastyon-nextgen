// Ввод кода замка — общий для экрана замка и окна подтверждения: проверка,
// текст ошибки и пауза после серии ошибок с обратным отсчётом.

import { computed, onScopeDispose, ref } from 'vue'

import { t } from '@/i18n'
import { readLockAttempts, type LockKind } from '@/helpers/app-lock/app-lock-config'
import type { CodeCheck } from '@/stores/app-lock-store'

/** pin-pad и pattern-grid. */
export interface CodeInput {
  fail(): void
  clear(): void
}

/** 0:30, 4:59 — одинаково на всех языках. */
export function formatPause(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function useCodeEntry(opts: {
  kind: () => LockKind | null
  submit: (code: string) => Promise<CodeCheck>
}) {
  const busy = ref(false)
  const error = ref('')
  const until = ref(readLockAttempts().until)
  const now = ref(Date.now())
  let timer: ReturnType<typeof setInterval> | null = null

  const pauseLeft = computed(() => Math.max(0, Math.ceil((until.value - now.value) / 1000)))
  const paused = computed(() => pauseLeft.value > 0)
  const hint = computed(() =>
    paused.value ? t('appLock.paused', { time: formatPause(pauseLeft.value) }) : error.value
  )

  function tick(): void {
    now.value = Date.now()
    if (until.value > now.value) {
      timer ??= setInterval(tick, 1000)
    } else if (timer) {
      clearInterval(timer)
      timer = null
    }
  }
  tick()

  /** Заново: экран замка открылся ещё раз. Пауза — с диска, она пережила перезапуск. */
  function reset(): void {
    error.value = ''
    until.value = readLockAttempts().until
    tick()
  }

  async function enter(code: string, input: CodeInput | null): Promise<boolean> {
    if (busy.value || paused.value) return false
    busy.value = true
    error.value = ''
    try {
      const res = await opts.submit(code)
      if (res.ok) return true
      input?.fail()
      if (res.unavailable) error.value = t('appLock.unavailable')
      else
        error.value = opts.kind() === 'pattern' ? t('appLock.wrongPattern') : t('appLock.wrongPin')
      until.value = res.until
      tick()
      return false
    } finally {
      busy.value = false
    }
  }

  onScopeDispose(() => {
    if (timer) clearInterval(timer)
  })

  return { busy, paused, hint, reset, enter }
}
