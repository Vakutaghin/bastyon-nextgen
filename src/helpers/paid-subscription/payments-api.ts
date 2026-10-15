/**
 * Платежи за подписку из сети: `getfromtotransactions [от, кому, с высоты, метки]`.
 *
 * Нода (pocketnet.core 0.22, ExplorerRepository::GetFromToTransactions) ищет
 * переводы по скрипту OP_RETURN — по умолчанию `a:subscription` — и пустой
 * адрес понимает как «любой». Поэтому одним запросом приходят все мои
 * платежи (подписки на всех авторов) или все платежи мне (мои подписчики).
 * Сумма — второй выход транзакции (первый — OP_RETURN), в сатоши.
 */

import { getByPRC } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { SUBSCRIPTION_MARKER, opReturnScriptHex } from '@/helpers/common/op-return'
import { BLOCKS_PER_MONTH, PAYMENTS_WINDOW_MONTHS } from './plans'
import type { SubscriptionPayment } from './status'

/** Высота цепочки живёт минуту: блок — раз в минуту. */
const HEIGHT_TTL_MS = 60_000
/** Запас глубины сверх года: месяц старого клиента длиннее 30 суток. */
const DEPTH_MARGIN_BLOCKS = BLOCKS_PER_MONTH

let height: { value: number; at: number } | null = null

/** Текущая высота цепочки; null — нода не ответила. */
export async function fetchChainHeight(now = Date.now()): Promise<number | null> {
  if (height && now - height.at < HEIGHT_TTL_MS) return height.value
  try {
    const response = (await getByPRC({
      method: rpcEndpoints.getNodeInfo,
      parameters: [],
      options: { auth: false },
    })) as { data?: { lastblock?: { height?: unknown } }; lastblock?: { height?: unknown } }
    const value = Number((response?.data ?? response)?.lastblock?.height)
    if (Number.isFinite(value) && value > 0) {
      height = { value, at: now }
      return value
    }
  } catch {
    /* ниже вернём, что знали */
  }
  return height?.value ?? null
}

/** С какой высоты искать платежи: год назад с запасом; не знаем высоту — с начала. */
export function paymentsDepth(chainHeight: number | null): number {
  if (!chainHeight) return 0
  return Math.max(0, chainHeight - BLOCKS_PER_MONTH * PAYMENTS_WINDOW_MONTHS - DEPTH_MARGIN_BLOCKS)
}

/** Запись ответа ноды → платёж; мусор отбрасываем. */
export function toPayment(raw: unknown): SubscriptionPayment | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const from = typeof r.addrFrom === 'string' ? r.addrFrom : ''
  const to = typeof r.addrTo === 'string' ? r.addrTo : ''
  const txid = typeof r.hash === 'string' ? r.hash : ''
  const amount = Number(r.amount)
  const time = Number(r.time)
  if (!from || !to || !txid || !(amount > 0) || !(time > 0)) return null
  return { from, to, txid, height: Number(r.height) || 0, amount: Math.round(amount), time }
}

/**
 * Платежи за подписку от `from` к `to` за последний год. Пустой адрес —
 * любой: `{ from: я }` — мои подписки, `{ to: я }` — мои подписчики.
 * Ошибку сети бросает: «платежей нет» и «не узнали» — разные ответы.
 */
export async function fetchSubscriptionPayments(query: {
  from?: string
  to?: string
}): Promise<SubscriptionPayment[]> {
  const depth = paymentsDepth(await fetchChainHeight())
  const response = (await getByPRC({
    method: rpcEndpoints.getFromToTransactions,
    parameters: [query.from ?? '', query.to ?? '', depth, [opReturnScriptHex(SUBSCRIPTION_MARKER)]],
    options: { auth: false },
  })) as { result?: unknown; data?: unknown; error?: unknown } | unknown[]
  const data = Array.isArray(response) ? response : response?.data
  if (!Array.isArray(data)) {
    const error = !Array.isArray(response) ? response?.error : undefined
    throw new Error(typeof error === 'string' ? error : 'getfromtotransactions failed')
  }
  const seen = new Set<string>()
  const payments: SubscriptionPayment[] = []
  for (const raw of data) {
    const payment = toPayment(raw)
    // Нода отдаёт строку на каждый вход отправителя: одна транзакция — один платёж.
    if (!payment || seen.has(payment.txid)) continue
    seen.add(payment.txid)
    payments.push(payment)
  }
  return payments
}

/** Сброс кэша высоты — только для тестов. */
export function __resetChainHeightForTests(): void {
  height = null
}
