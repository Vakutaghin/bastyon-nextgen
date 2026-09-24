/**
 * Курсор постраничной выдачи `getaddresstransactions` (S66).
 *
 * Нода принимает высоту как курсор и отдаёт транзакции ВНИЗ от неё. Курсор
 * `minHeight - 1` (как было) перепрыгивает через оставшиеся транзакции того же
 * блока: если страница обрывается посередине блока, всё, что в нём ниже по
 * списку, теряется навсегда. Берём `minHeight` включительно, а повторы
 * отсекаем дедупом по txid — он для этого и нужен.
 *
 * Единственная опасность включительного курсора — топтание на месте, когда
 * весь ответ состоит из уже показанных транзакций (в блоке их больше, чем
 * размер страницы). Тогда шагаем на блок ниже: `hasMore` остаётся, а курсор
 * строго убывает, поэтому цикл конечен.
 */

export interface AddressTxCursorInput {
  /** Высоты транзакций пришедшей страницы. */
  heights: readonly number[]
  /** Сколько записей страницы оказались новыми (после дедупа по txid). */
  freshCount: number
  /** Курсор, с которым запрашивали страницу. */
  currentCursor: number
  /** Размер страницы, запрошенный у ноды. */
  pageSize: number
}

export interface AddressTxCursorResult {
  /** Курсор для следующего «Загрузить ещё». */
  nextCursor: number
  /** Есть ли смысл просить дальше. */
  hasMore: boolean
}

export function nextAddressTxCursor(input: AddressTxCursorInput): AddressTxCursorResult {
  const { heights, freshCount, currentCursor, pageSize } = input

  if (heights.length === 0) return { nextCursor: currentCursor, hasMore: false }

  const minHeight = heights.reduce((min, h) => Math.min(min, h), Number.POSITIVE_INFINITY)
  if (!Number.isFinite(minHeight) || minHeight <= 0) {
    return { nextCursor: currentCursor, hasMore: false }
  }

  // Страница целиком дублирует показанное — иначе застрянем на этом блоке.
  const nextCursor = freshCount === 0 ? minHeight - 1 : minHeight

  // Неполная страница — ниже ничего нет.
  const hasMore = heights.length >= pageSize && nextCursor > 0 && nextCursor !== currentCursor

  return { nextCursor, hasMore }
}
