/**
 * Как приложение сейчас ходит в сеть — для строки в настройках. Отдельный
 * модуль без зависимостей: его пишут и выбор маршрута, и выбор нод.
 */

import { reactive } from 'vue'

/** Настройка: «Авто», «Прокси», «Ноды напрямую». */
export type ConnectionMode = 'auto' | 'proxy' | 'direct'

/** Чем идут запросы прямо сейчас. */
export type ConnectionRoute = 'proxy' | 'direct'

export const connectionState = reactive({
  mode: 'auto' as ConnectionMode,
  /** null — ещё не выбран (первый запрос не уходил). */
  route: null as ConnectionRoute | null,
  /** Ноды, готовые отвечать напрямую. */
  nodes: 0,
  /** Нода, к которой идут запросы, `IP`. */
  node: null as string | null,
  /** Идёт выбор нод. */
  selecting: false,
  /** Последний выбор не нашёл ни одной ноды. */
  selectFailed: false,
})
