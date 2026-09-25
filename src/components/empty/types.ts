import type { Component } from 'vue'

export interface EmptyProps {
  /** Подпись: почему здесь пусто. */
  description?: string
  /** Заголовок над подписью, если нужен. */
  title?: string
  /** Иконка в круге; по умолчанию — ящик «Входящие». */
  icon?: Component
}
