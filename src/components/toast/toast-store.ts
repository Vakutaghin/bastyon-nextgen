import { shallowReactive } from 'vue'
import type { ToastInput, ToastItem } from './types'

/**
 * Список тостов и их таймеры. Показывает и закрывает их кто угодно (appToast),
 * рисует один ToastHost в корне приложения.
 *
 * Как у antd: тост с тем же ключом заменяется на месте; пока на тосте курсор,
 * он не закрывается, а когда курсор ушёл — отсчёт начинается заново. То же для
 * фокуса с клавиатуры: на крестике тост не исчезает из-под Tab.
 */

/** Секунды до закрытия, как у antd notification. */
export const DEFAULT_DURATION = 4.5

export const toasts = shallowReactive<ToastItem[]>([])

interface ToastTimer {
  id: ReturnType<typeof setTimeout> | null
  /** Кто держит тост открытым: 'hover', 'focus'. */
  holds: Set<string>
}

const timers = new Map<string, ToastTimer>()
let seq = 0

function stopTimer(timer: ToastTimer): void {
  if (timer.id !== null) clearTimeout(timer.id)
  timer.id = null
}

function startTimer(item: ToastItem): void {
  const timer = timers.get(item.key)
  if (!timer) return
  stopTimer(timer)
  if (item.duration > 0 && timer.holds.size === 0) {
    timer.id = setTimeout(() => closeToast(item.key), item.duration * 1000)
  }
}

/** Показать тост или обновить тот, что с тем же ключом. Возвращает ключ. */
export function showToast(input: ToastInput): string {
  const key = input.key ?? `ui-toast-${++seq}`
  const item: ToastItem = { ...input, key }
  const index = toasts.findIndex((t) => t.key === key)
  if (index >= 0) toasts.splice(index, 1, item)
  else toasts.push(item)
  if (!timers.has(key)) timers.set(key, { id: null, holds: new Set() })
  // Новый текст — новый отсчёт; если тост держат, он подождёт.
  startTimer(item)
  return key
}

export function closeToast(key: string): void {
  const index = toasts.findIndex((t) => t.key === key)
  if (index >= 0) toasts.splice(index, 1)
  const timer = timers.get(key)
  if (timer) stopTimer(timer)
  timers.delete(key)
}

/** Не закрывать тост, пока его держат (курсор, фокус). */
export function holdToast(key: string, reason: string): void {
  const timer = timers.get(key)
  if (!timer) return
  timer.holds.add(reason)
  stopTimer(timer)
}

/** Отпустить тост: когда отпустили все, отсчёт начинается заново. */
export function releaseToast(key: string, reason: string): void {
  const timer = timers.get(key)
  if (!timer?.holds.delete(reason)) return
  const item = toasts.find((t) => t.key === key)
  if (item) startTimer(item)
}

/** Сброс — только для тестов. */
export function resetToastsForTests(): void {
  for (const timer of timers.values()) stopTimer(timer)
  timers.clear()
  toasts.splice(0)
  seq = 0
}
