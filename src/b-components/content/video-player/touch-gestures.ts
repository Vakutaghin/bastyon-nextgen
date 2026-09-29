/**
 * Касания по ролику — как в приложении YouTube:
 *
 * - одно касание показывает или прячет панель, а не ставит на паузу;
 * - двойное касание по левой или правой трети — назад или вперёд на 10 секунд;
 * - пока касания сбоку идут одно за другим, каждое добавляет ещё 10 секунд,
 *   уже без второго касания: 10, 20, 30…
 *
 * Здесь только решение «что значит это касание» — без таймеров и DOM, чтобы
 * проверялось тестами. Таймеры и события — в use-touch-controls.
 */

export type TapZone = 'left' | 'center' | 'right'

/** Второе касание в пределах этого окна — двойное, мс. */
export const DOUBLE_TAP_MS = 300

/** Перемотка касаниями продолжается, пока пауза между ними меньше этого, мс. */
export const SEEK_CONTINUE_MS = 700

/** Шаг перемотки касанием, секунды. */
export const TAP_SEEK_STEP = 10

/** Левая и правая трети ролика перематывают, середина — только панель. */
export function tapZone(x: number, width: number): TapZone {
  if (width <= 0) return 'center'
  const ratio = x / width
  if (ratio < 1 / 3) return 'left'
  if (ratio > 2 / 3) return 'right'
  return 'center'
}

export type TapDecision =
  /** Касание сбоку: ждём второго, иначе через DOUBLE_TAP_MS это одиночное. */
  | { kind: 'wait' }
  /** Показать или спрятать панель сейчас. */
  | { kind: 'toggle' }
  /** Перемотать на шаг: -1 назад, 1 вперёд. */
  | { kind: 'seek'; direction: -1 | 1 }

const direction = (zone: TapZone): -1 | 1 => (zone === 'right' ? 1 : -1)

export class TapTracker {
  private pending: { zone: TapZone; at: number } | null = null
  private seekingUntil = 0

  tap(zone: TapZone, now: number): TapDecision {
    // Середина: панель сразу, серия перемоток на этом кончается.
    if (zone === 'center') {
      this.pending = null
      this.seekingUntil = 0
      return { kind: 'toggle' }
    }
    // Серия уже идёт — каждое касание сбоку добавляет шаг.
    if (now < this.seekingUntil) {
      this.pending = null
      this.seekingUntil = now + SEEK_CONTINUE_MS
      return { kind: 'seek', direction: direction(zone) }
    }
    // Второе касание той же стороны — двойное: начинается серия.
    if (this.pending && this.pending.zone === zone && now - this.pending.at <= DOUBLE_TAP_MS) {
      this.pending = null
      this.seekingUntil = now + SEEK_CONTINUE_MS
      return { kind: 'seek', direction: direction(zone) }
    }
    this.pending = { zone, at: now }
    return { kind: 'wait' }
  }

  /**
   * Окно второго касания истекло. `true` — касание осталось одиночным и
   * панель надо показать или спрятать; `false` — его уже поглотило двойное.
   */
  settle(now: number): boolean {
    if (!this.pending || now - this.pending.at < DOUBLE_TAP_MS) return false
    this.pending = null
    return true
  }

  /** Идёт ли серия перемоток касаниями. */
  isSeeking(now: number): boolean {
    return now < this.seekingUntil
  }

  reset(): void {
    this.pending = null
    this.seekingUntil = 0
  }
}
