// Подождать обещание не дольше `ms`: открытие чата не должно висеть на
// запросе, который сеть потеряла (сокет умер при смене сети), или на
// расшифровке, ждущей профиль с ключами от молчащей ноды. Само обещание не
// отменяется — его результат просто перестают ждать.

export type Within<T> = { done: true; value: T } | { done: false }

export function within<T>(promise: Promise<T>, ms: number): Promise<Within<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<Within<T>>((resolve) => {
    timer = setTimeout(() => resolve({ done: false }), ms)
  })
  const settled = promise.then((value): Within<T> => ({ done: true, value }))
  return Promise.race([settled, late]).finally(() => clearTimeout(timer))
}
