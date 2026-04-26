/**
 * Механизм экспоненциальной задержки (backoff) для round robin опроса серверов
 * Использует числа Фибоначчи для постепенного увеличения задержки
 */

interface ServerBackoffState {
  /** Текущий индекс в последовательности Фибоначчи */
  fibonacciIndex: number
  /** Время последнего успешного запроса (для сброса задержки) */
  lastSuccessTime: number | null
  /** Время последнего запроса */
  lastRequestTime: number | null
}

/**
 * Последовательность Фибоначчи для задержек (в миллисекундах)
 * Начинаем с 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610...
 */
const FIBONACCI_SEQUENCE = [
  1000,   // 1 секунда
  1000,   // 1 секунда
  2000,   // 2 секунды
  3000,   // 3 секунды
  5000,   // 5 секунд
  8000,   // 8 секунд
  13000,  // 13 секунд
  21000,  // 21 секунда
  34000,  // 34 секунды
  55000,  // 55 секунд
  89000,  // 89 секунд (максимум)
]

/**
 * Таймаут для сброса задержки (5 минут)
 * Если сервер не использовался более этого времени, задержка сбрасывается
 */
const RESET_TIMEOUT = 5 * 60 * 1000 // 5 минут

/**
 * Хранилище состояний backoff для каждого сервера
 * Ключ: "host:port"
 */
const serverBackoffStates = new Map<string, ServerBackoffState>()

/**
 * Получает или создает состояние backoff для сервера
 */
function getServerState(host: string, port: number): ServerBackoffState {
  const key = `${host}:${port}`
  
  if (!serverBackoffStates.has(key)) {
    serverBackoffStates.set(key, {
      fibonacciIndex: 0,
      lastSuccessTime: null,
      lastRequestTime: null,
    })
  }
  
  return serverBackoffStates.get(key)!
}

/**
 * Вычисляет задержку на основе текущего индекса Фибоначчи
 */
function getFibonacciDelay(index: number): number {
  if (index < 0) return FIBONACCI_SEQUENCE[0] ?? 1000
  if (index >= FIBONACCI_SEQUENCE.length) {
    // Если индекс превышает длину последовательности, используем последнее значение
    return FIBONACCI_SEQUENCE[FIBONACCI_SEQUENCE.length - 1] ?? 89000
  }
  return FIBONACCI_SEQUENCE[index] ?? 1000
}

/**
 * Проверяет, нужно ли сбросить задержку для сервера
 * Сбрасывает, если прошло достаточно времени с последнего успешного запроса
 */
function shouldResetBackoff(state: ServerBackoffState): boolean {
  if (state.lastSuccessTime === null) {
    // Если никогда не было успешного запроса, не сбрасываем
    return false
  }
  
  const timeSinceLastSuccess = Date.now() - state.lastSuccessTime
  return timeSinceLastSuccess > RESET_TIMEOUT
}

/**
 * Получает задержку перед запросом к серверу
 * НЕ обновляет время последнего запроса (это делается в markServerSuccess/Failure)
 * @param host - Хост сервера
 * @param port - Порт сервера
 * @returns Задержка в миллисекундах (0 если задержка не нужна)
 */
export function getBackoffDelay(host: string, port: number): number {
  const state = getServerState(host, port)
  
  // Проверяем, нужно ли сбросить задержку
  if (shouldResetBackoff(state)) {
    state.fibonacciIndex = 0
    state.lastSuccessTime = null
    // После сброса задержка не нужна
    return 0
  }
  
  // Если индекс 0, задержка не нужна (первый запрос или после успеха)
  if (state.fibonacciIndex === 0) {
    return 0
  }
  
  // Возвращаем задержку на основе текущего индекса
  return getFibonacciDelay(state.fibonacciIndex)
}

/**
 * Отмечает успешный запрос к серверу
 * Сбрасывает индекс Фибоначчи и обновляет время последнего успеха
 */
export function markServerSuccess(host: string, port: number): void {
  const state = getServerState(host, port)
  
  // Сбрасываем индекс при успешном запросе
  state.fibonacciIndex = 0
  state.lastSuccessTime = Date.now()
  state.lastRequestTime = Date.now()
}

/**
 * Отмечает неудачный запрос к серверу
 * Увеличивает индекс Фибоначчи для следующего запроса
 */
export function markServerFailure(host: string, port: number): void {
  const state = getServerState(host, port)
  
  // Увеличиваем индекс только если это не первый запрос
  // (первый запрос уже был с индексом 0)
  if (state.lastRequestTime !== null) {
    state.fibonacciIndex = Math.min(
      state.fibonacciIndex + 1,
      FIBONACCI_SEQUENCE.length - 1
    )
  }
  
  state.lastRequestTime = Date.now()
}

/**
 * Очищает состояние backoff для всех серверов
 * Полезно для тестирования или сброса состояния
 */
export function clearAllBackoffStates(): void {
  serverBackoffStates.clear()
}

/**
 * Получает текущее состояние backoff для сервера (для отладки)
 */
export function getBackoffState(host: string, port: number): ServerBackoffState | null {
  const key = `${host}:${port}`
  return serverBackoffStates.get(key) || null
}
