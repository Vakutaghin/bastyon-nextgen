/**
 * Wallet handlers (этап 5.3):
 *
 * - `balance` — баланс текущего пользователя
 * - `fromToTransactions` — транзакции между двумя адресами (опц. фильтр по confirmations)
 *
 * Legacy эквиваленты:
 * - [index.js:336-349](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L336-L349)
 * - [index.js:379-402](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L379-L402)
 *
 * Особенности:
 * - `balance` — если пользователь не залогинен, возвращаем `{}` (legacy fallback).
 * - `fromToTransactions` — RPC-метод `getfromtotransactions` живёт на стороне
 *   pocketnet-ноды. Мы делаем pass-through через `host.callRpc`. Client-side
 *   фильтр по `confirmations` повторяет legacy-логику.
 */

import type { z } from 'zod'
import { ActionSchemas } from './_schema'
import type { ActionDefinition, ActionMap } from './types'

const balance: ActionDefinition<unknown, Record<string, unknown>> = {
  schema: ActionSchemas.balance,
  permissions: ['account'],
  authorization: true,
  rateLimitClass: 'normal',
  handler: async ({ host, signal }) => host.getUserBalance(signal),
}

type FromToInput = z.infer<typeof ActionSchemas.fromToTransactions>

interface Tx {
  height?: number
  [k: string]: unknown
}

const fromToTransactions: ActionDefinition<FromToInput, Tx[]> = {
  schema: ActionSchemas.fromToTransactions,
  authorization: true,
  rateLimitClass: 'normal',
  handler: async ({ data, host, signal }) => {
    const raw = await host.callRpc(
      'getfromtotransactions',
      [data.addressFrom, data.addressTo, data.update, data.depth, data.opreturn],
      undefined,
      signal
    )

    const transactions = Array.isArray(raw) ? (raw as Tx[]) : []

    if (typeof data.confirmations !== 'number' || data.confirmations <= 0) {
      return transactions
    }

    // Фильтр по числу подтверждений — повторяет legacy
    const currentBlock = await host.getCurrentBlockHeight(signal)
    return transactions.filter(
      (tx) => typeof tx.height === 'number' && currentBlock - tx.height >= data.confirmations!
    )
  },
}

export const WALLET_ACTIONS = {
  balance,
  fromToTransactions,
} as const satisfies ActionMap
