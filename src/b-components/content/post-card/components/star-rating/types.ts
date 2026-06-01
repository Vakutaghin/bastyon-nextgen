/**
 * Типы для компонента звездного рейтинга
 */

/**
 * Параметры для отправки upvote транзакции
 */
export interface UpvoteTransactionParams {
  /** Share ID поста */
  share: string
  /** Оценка от 1 до 5 */
  value: string
}

/**
 * Параметры запроса sendrawtransactionwithmessage
 */
export interface SendRawTransactionRequest {
  parameters: [
    string, // hex транзакции
    UpvoteTransactionParams | string,
    string // operationType: "upvoteShare"
  ]
  method: 'sendrawtransactionwithmessage'
  cachehash?: string
  options?: {
    node?: string
  }
  state?: number
}

/**
 * Ответ от sendrawtransactionwithmessage
 */
export interface SendRawTransactionResponse {
  result: 'success' | 'error'
  data?: string // txid транзакции
  error?: string | Record<string, unknown>
  node?: string
  time?: {
    preparing?: number
    cache?: number
    start?: number
    ready?: number
    node?: {
      rpcsstart?: number
      rpcsend?: number
    }
  }
}

/**
 * Параметры запроса getrawtransaction
 */
export interface GetRawTransactionRequest {
  parameters: [string, number] // [txid, verbose]
  method: 'getrawtransaction'
  cachehash?: string
  options?: {
    node?: string
  }
  state?: number
}

/**
 * Данные транзакции из getrawtransaction
 */
export interface RawTransactionData {
  txid: string
  type: number
  nTime: number
  s1?: string // адрес отправителя
  s2?: string // share ID
  i1?: number // значение оценки
  vin?: Array<{
    txid: string
    vout: number
    address: string
    value: number
  }>
  vout?: Array<{
    n: number
    value: number
    scriptPubKey: {
      addresses: string[]
      hex: string
    }
  }>
}

/**
 * Ответ от getrawtransaction
 */
export interface GetRawTransactionResponse {
  result: 'success' | 'error'
  data?: RawTransactionData
  error?: string
  node?: string
  time?: {
    preparing?: number
    cache?: number
    start?: number
    ready?: number
  }
}

/**
 * Пропсы компонента звездного рейтинга
 */
export interface StarRatingProps {
  /** Текущий рейтинг (0-5) */
  rating: number
  /** Количество проголосовавших */
  votersCount: number
  /** Share ID поста */
  shareId: string
  /** Адрес автора контента (для OP_RETURN payload) */
  contentAuthorAddress: string
  /** Отключен ли компонент */
  disabled?: boolean
  /** Оценка пользователя (если есть) */
  userVote?: number
  /** Сумма всех оценок (для расчета среднего) */
  scoreSum?: number
  /** Количество оценок (синоним votersCount, для удобства) */
  scoreCnt?: number
}

/**
 * События компонента
 */
export interface StarRatingEmits {
  (e: 'rating-change', rating: number): void
  (e: 'error', error: Error): void
}
