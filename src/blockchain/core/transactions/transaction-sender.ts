/**
 * Модуль для отправки транзакций в блокчейн Pocketnet.
 *
 * Бродкаст — неидемпотентная операция (аудит V1): раньше он шёл через общий
 * retryWithBackoff, таймаут 30 с первой ноды отправлял тот же подписанный hex
 * на вторую, та отвечала «already in chain» — пользователь видел «Failed to
 * send» и слал ещё раз (двойной платёж/дубль поста). Теперь:
 *   - один сервер, без перебора, длинный таймаут;
 *   - txid считается локально (hash256 сериализованной tx) ДО отправки;
 *   - «already in mempool/chain» = успех с локальным txid;
 *   - таймаут → проверяем getrawtransaction по локальному txid и только если
 *     ноды его не знают, отдаём BroadcastStatusUnknownError (с txid) — без
 *     автоматического повторного бродкаста.
 */

import { debugLog } from '@/helpers/common/debug-log'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { rpcCallWithAuth, getByPRC } from '@/helpers/api/request'

/** Потолок ожидания ответа ноды на бродкаст (мс). */
export const BROADCAST_TIMEOUT_MS = 90_000
/** Сколько раз и с какой паузой переспрашивать ноду после таймаута. */
const VERIFY_ATTEMPTS = 3
const VERIFY_DELAY_MS = 2_000

/**
 * Интерфейс для параметров отправки транзакции
 */
export interface SendTransactionParams {
  /** Hex представление транзакции */
  hex: string
  /** Экспортированные данные для сообщения */
  messageData: Record<string, unknown>
  /** Тип операции (например, 'userInfo') */
  operationType: string
}

/** Нода не ответила, и по txid транзакцию пока не видно: слать повторно нельзя вслепую. */
export class BroadcastStatusUnknownError extends Error {
  constructor(
    public readonly txid: string | null,
    cause: unknown
  ) {
    super(
      `Broadcast status unknown: node timed out and tx ${txid ?? '?'} is not visible yet — check before resending`,
      { cause }
    )
    this.name = 'BroadcastStatusUnknownError'
  }
}

export interface SendTransactionDeps {
  rpcCallWithAuth: typeof rpcCallWithAuth
  getByPRC: typeof getByPRC
  sleep: (ms: number) => Promise<void>
}

const defaultDeps: SendTransactionDeps = {
  rpcCallWithAuth,
  getByPRC,
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
}

/** txid = SHA256(SHA256(raw tx)) в обратном порядке байт. null, если WebCrypto недоступен. */
export async function computeTxidFromHex(hex: string): Promise<string | null> {
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) return null
  const subtle = globalThis.crypto?.subtle
  if (!subtle) return null
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  const first = await subtle.digest('SHA-256', bytes)
  const second = new Uint8Array(await subtle.digest('SHA-256', first))
  return Array.from(second.reverse(), (b) => b.toString(16).padStart(2, '0')).join('')
}

const errorText = (error: unknown): string => {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    try {
      return JSON.stringify(error)
    } catch {
      return String(error)
    }
  }
  return String(error)
}

/** Нода уже знает эту транзакцию — бродкаст по сути успешен. */
export function isAlreadyKnownError(error: unknown): boolean {
  const text = errorText(error).toLowerCase()
  return (
    text.includes('already in mempool') ||
    text.includes('already in chain') ||
    text.includes('already in block chain') ||
    text.includes('txn-already-known') ||
    text.includes('txn-already-in-mempool') ||
    text.includes('already known') ||
    /"code"\s*:\s*-27\b/.test(text)
  )
}

const isTimeoutError = (error: unknown): boolean =>
  errorText(error).toLowerCase().includes('timeout')

/** Извлекает txid из ответа sendrawtransactionwithmessage (строка или объект). */
function txidFromResponse(response: unknown): string | null {
  if (typeof response === 'string' && response.length > 0) return response
  if (response && typeof response === 'object') {
    const resp = response as Record<string, unknown>
    // НЕ фабрикуем txid из произвольного непустого ответа (P2-6/P3-6).
    const candidate = resp.txid ?? resp.hash ?? resp.txId
    if (typeof candidate === 'string' && candidate.length > 0) return candidate
  }
  return null
}

/** Знает ли хоть одна нода транзакцию (getrawtransaction). */
async function isTxKnown(txid: string, deps: SendTransactionDeps): Promise<boolean> {
  for (let attempt = 0; attempt < VERIFY_ATTEMPTS; attempt++) {
    if (attempt > 0) await deps.sleep(VERIFY_DELAY_MS)
    try {
      const res = await deps.getByPRC({
        method: rpcEndpoints.getRawTransaction,
        parameters: [txid],
        options: { auth: false, timeout: 15_000 },
        cachehash: `${Date.now()}-${attempt}`,
      })
      const data =
        res && typeof res === 'object' && 'data' in res ? (res as { data?: unknown }).data : res
      if (typeof data === 'string' && data.length > 0) return true
      if (data && typeof data === 'object' && (data as { txid?: unknown }).txid === txid)
        return true
    } catch {
      // нода не знает / сеть — пробуем ещё
    }
  }
  return false
}

/**
 * Отправляет транзакцию через sendrawtransactionwithmessage
 * @param params - Параметры отправки транзакции
 * @returns Promise с txid транзакции
 */
export async function sendTransactionWithMessage(
  params: SendTransactionParams,
  deps: SendTransactionDeps = defaultDeps
): Promise<string> {
  const { hex, messageData, operationType } = params

  if (!hex || typeof hex !== 'string') {
    throw new Error('Invalid transaction hex')
  }

  if (!messageData || typeof messageData !== 'object') {
    throw new Error('Invalid message data')
  }

  if (!operationType || typeof operationType !== 'string') {
    throw new Error('Invalid operation type')
  }

  const localTxid = await computeTxidFromHex(hex)

  try {
    // rpcCallWithAuth unwraps the { result, data } envelope automatically
    // Параметры: [hex, messageData, operationType]
    const response = await deps.rpcCallWithAuth<unknown>({
      method: rpcEndpoints.sendRawTransactionWithMessage,
      parameters: [hex, messageData, operationType],
      // auth — подпись; noFailover + длинный таймаут — см. шапку модуля (V1).
      options: { auth: true, noFailover: true, timeout: BROADCAST_TIMEOUT_MS },
    })

    debugLog('[sendTransaction] Raw response:', JSON.stringify(response).substring(0, 500))

    const txid = txidFromResponse(response)
    if (txid) return txid

    throw new Error('Unexpected response format from sendrawtransactionwithmessage')
  } catch (error) {
    if (isAlreadyKnownError(error) && localTxid) {
      debugLog('[sendTransaction] node already knows the tx, treating as sent:', localTxid)
      return localTxid
    }

    if (isTimeoutError(error)) {
      if (localTxid && (await isTxKnown(localTxid, deps))) {
        debugLog('[sendTransaction] timeout, but tx is visible on the node:', localTxid)
        return localTxid
      }
      console.error('[sendTransaction] Broadcast timed out, tx not visible:', localTxid, error)
      throw new BroadcastStatusUnknownError(localTxid, error)
    }

    console.error('[sendTransaction] Error details:', error)
    if (error instanceof Error) {
      throw new Error(`Failed to send transaction: ${error.message}`, { cause: error })
    }
    // Если ошибка — объект с кодом (от RPC)
    throw new Error(`Failed to send transaction: ${errorText(error)}`, { cause: error })
  }
}
