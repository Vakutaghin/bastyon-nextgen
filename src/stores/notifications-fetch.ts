// Сетевой слой уведомлений: текущая высота сети, распознавание таймаут-ошибок и
// запрос пропущенных событий (getmissedinfo). Чистые функции — вынесено из
// notifications-store, чтобы сеть/ретраи были тестируемы (см. LARGE_FILE_SPLIT_AUDIT.md).
import { rpcCall, rpcCallArrayWithAuth } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import type { GetMissedInfoParameters } from '@/types/rpc-requests/get-missed-info'
import type { GetMissedInfoDataItem } from '@/types/rpc-responses/get-missed-info'
import type { GetNodeInfoData } from '@/types/rpc-responses/get-node-info'

/**
 * Текущая высота сети (getnodeinfo). Если нет сохранённого блока — запрашиваем
 * уведомления с неё (0 новых).
 */
export async function fetchCurrentBlockHeight(): Promise<number> {
  const data = await rpcCall<GetNodeInfoData>({
    method: rpcEndpoints.getNodeInfo,
    parameters: [],
    options: { auth: false },
  })
  const h = data?.lastblock?.height
  if (typeof h === 'number' && h > 0) return h
  return 0
}

/** Транзиентная ли ошибка сети (таймаут/500) — стоит ли ретраить. */
export function isTimeoutError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const o = err as Record<string, unknown>
  const code =
    o?.code ??
    (o?.error && typeof o.error === 'object' && (o.error as Record<string, unknown>)?.code)
  const msg = String(
    o?.message ??
      (o?.error && typeof o.error === 'object' && (o.error as Record<string, unknown>)?.message) ??
      ''
  )
  return code === 408 || code === 500 || /timeout/i.test(msg)
}

/**
 * Запрос пропущенных событий: getmissedinfo(address, fromBlock, limit).
 * Всегда без кэша — нужны актуальные события. Ответ: [BlockItem, ...EventItem[]].
 */
export async function fetchMissedInfo(
  address: string,
  fromBlock: number
): Promise<GetMissedInfoDataItem[]> {
  const params: GetMissedInfoParameters = [address, fromBlock, 30]
  return rpcCallArrayWithAuth<GetMissedInfoDataItem>({
    method: rpcEndpoints.getMissedInfo,
    parameters: params,
    options: { cache: false },
  })
}
