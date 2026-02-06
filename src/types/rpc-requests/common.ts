/**
 * Общие типы для RPC запросов Pocketnet API
 *
 * Все RPC методы принимают запросы с общей структурой:
 * - method: название метода
 * - parameters: массив параметров (специфичен для каждого метода)
 * - options: опции запроса (кеширование, авторизация и т.д.)
 */

/**
 * Опции RPC запроса
 */
export interface RpcRequestOptions {
  /** Требуется ли авторизация (подпись запроса) */
  auth?: boolean
  /** Использовать расширенный эндпоинт (rpc-ex вместо rpc) */
  ex?: boolean
  /** Использовать кеширование */
  cache?: boolean
  /** Быстрое видео */
  fastvideo?: boolean
  /** Узел для запроса */
  node?: string
  /** Сессия для подписи */
  session?: string
  /** Дополнительные опции */
  [key: string]: unknown
}

/**
 * Базовый интерфейс для всех RPC запросов
 *
 * @template TParameters - тип параметров запроса (специфичен для каждого метода)
 */
export interface BaseRpcRequest<TParameters extends unknown[] = unknown[]> {
  /**
   * Название RPC метода
   */
  method: string
  /**
   * Параметры запроса
   * Структура зависит от конкретного метода
   */
  parameters: TParameters
  /**
   * Опции запроса
   */
  options?: RpcRequestOptions
  /**
   * Хеш для кеширования (опционально)
   */
  cachehash?: string
  /**
   * Состояние запроса (опционально)
   */
  state?: number
  /**
   * Подпись запроса (добавляется автоматически если auth: true)
   */
  signature?: unknown
}
