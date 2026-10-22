/**
 * «Назад» и «Вперёд» по страницам приложения, как кнопки браузера. vue-router
 * хранит соседние адреса записи в history.state (`back`, `forward`). У первой
 * открытой страницы `back` пуст, и «Назад» выключена: в браузере кнопка не
 * уводит с сайта, а в приложении для компьютера не ведёт на пустую страницу.
 */

import { ref, watch, type Ref } from 'vue'
import { useRoute, useRouter, type Router } from 'vue-router'

export type HistoryStep = 'back' | 'forward'

/** Адрес, куда ведёт шаг по истории, или null — идти некуда. */
export function historyNeighbour(step: HistoryStep): string | null {
  if (typeof window === 'undefined') return null
  const state = window.history.state as Record<string, unknown> | null
  const path = state?.[step]
  return typeof path === 'string' ? path : null
}

/** Шаг по истории, если есть куда; false — шаг некуда сделать. */
export function stepHistory(router: Router, step: HistoryStep): boolean {
  if (historyNeighbour(step) === null) return false
  if (step === 'back') router.back()
  else router.forward()
  return true
}

export interface HistoryNav {
  canBack: Ref<boolean>
  canForward: Ref<boolean>
  go: (step: HistoryStep) => void
}

export function useHistoryNav(): HistoryNav {
  const route = useRoute()
  const router = useRouter()

  const canBack = ref(false)
  const canForward = ref(false)
  // history.state меняется вместе с адресом — пересчёт по смене маршрута.
  watch(
    () => route.fullPath,
    () => {
      canBack.value = historyNeighbour('back') !== null
      canForward.value = historyNeighbour('forward') !== null
    },
    { immediate: true }
  )

  return { canBack, canForward, go: (step) => void stepHistory(router, step) }
}
