/**
 * RPC напрямую к нодам — замена прокси, когда до него не достучаться. Ответ
 * заворачивается в конверт прокси (`{result: 'success', data}`), поэтому всё,
 * что выше `getByPRC`, разницы не видит.
 *
 * Что прокси делал сам, здесь повторено:
 * - перебор нод при сбое; ошибка самой ноды (код от неё) другим не задаётся;
 * - ленты через `/rpc-ex/` (proxy16 `rpcscenarios`): ответ кладётся в
 *   `{contents}`, и к нему догружаются профили авторов последних
 *   комментариев (`users`).
 *
 * Сверх прокси: монеты и баланс (`txunspent`, `getaddressinfo`) спрашиваются
 * у трёх нод, и берётся ответ, на котором сошлись две.
 */

import { getRpcPath } from '../rpc-endpoints'
import { isLogicError, isTimeout500 } from '../rpc-errors'
import type { T_RpcRequestParams } from '../types/request'
import { NodePinMismatchError } from './native-link'
import { nodeCall, NodeTransportError } from './node-call'
import { directNodes, markNodeDead, markNodeRejected } from './node-pool'

const DEFAULT_TIMEOUT_MS = 30_000

/** Сверяются у нескольких нод: от них зависит, что человек видит на счёте. */
const QUORUM_METHODS = new Set(['txunspent', 'getaddressinfo'])
/** Поля, которые у нод расходятся честно: нода на блок позади. */
const VOLATILE_FIELDS = new Set(['confirmations'])

/** Ленты, которые прокси собирает сам (proxy16 `rpcscenarios`). */
const SCENARIO_METHODS = new Set([
  'gethierarchicalstrip',
  'getrecommendedcontentbyaddress',
  'getprofilefeed',
  'getsubscribesfeed',
  'gethotposts',
  'getmostcommentedfeed',
])
/** К этим прокси добавляет профили авторов последних комментариев. */
const WITH_USERS = new Set([
  'gethierarchicalstrip',
  'getsubscribesfeed',
  'getprofilefeed',
  'getmostcommentedfeed',
])

/**
 * Сбой у ноды: можно ли спросить другую. Ошибку самой ноды (код от неё) и
 * ошибку в нашем коде — нет, их бросаем. Медленный SQL на ноде («sql request
 * timeout» под кодом 500) и переполненная очередь — да, но нода жива и
 * остаётся в рабочих. Не ответила или сменила сертификат — выбывает.
 */
function retryable(host: string, error: unknown): boolean {
  if (isTimeout500(error)) return true
  if (isLogicError(error)) return false
  if (error instanceof NodePinMismatchError) {
    markNodeRejected(host)
    return true
  }
  if (error instanceof NodeTransportError) {
    if (!error.busy) markNodeDead(host)
    return true
  }
  return false
}

function allFailed(lastError: unknown): Error {
  const message = lastError instanceof Error ? lastError.message : String(lastError ?? 'unknown')
  return new Error(`All direct nodes failed. Last error: ${message}`, { cause: lastError })
}

async function withFailover(method: string, params: unknown, timeoutMs: number): Promise<unknown> {
  let lastError: unknown = null
  for (const host of await directNodes()) {
    try {
      return await nodeCall(host, method, params, { timeoutMs })
    } catch (error) {
      if (!retryable(host, error)) throw error
      lastError = error
    }
  }
  throw allFailed(lastError)
}

/** Одна попытка у лучшей ноды: транзакцию второй раз не отправляем. */
async function once(method: string, params: unknown, timeoutMs: number) {
  const [host] = await directNodes()
  if (!host) throw allFailed(null)
  try {
    return await nodeCall(host, method, params, { timeoutMs })
  } catch (error) {
    retryable(host, error)
    throw error
  }
}

/** Ответ без честно расходящихся полей и с порядком, не зависящим от ноды. */
export function canonical(value: unknown): string {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) {
      return v
        .map(walk)
        .map((item) => [JSON.stringify(item), item] as const)
        .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
        .map(([, item]) => item)
    }
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {}
      for (const key of Object.keys(v).sort()) {
        if (!VOLATILE_FIELDS.has(key)) out[key] = walk((v as Record<string, unknown>)[key])
      }
      return out
    }
    return v
  }
  return JSON.stringify(walk(value))
}

/**
 * Три ноды разом; ответ — как только два совпали (ждём вторую по скорости, а
 * не самую медленную: на тяжёлом адресе ноды отвечают от 1 до 7 с). Не
 * совпали — спрашиваем остальных по одной.
 */
async function quorum(method: string, params: unknown, timeoutMs: number) {
  const hosts = await directNodes()
  if (hosts.length < 2) return withFailover(method, params, timeoutMs)

  const answers: Array<{ key: string; value: unknown }> = []
  let lastError: unknown = null
  const majority = () => answers.find((a) => answers.filter((b) => b.key === a.key).length >= 2)
  const ask = async (host: string): Promise<void> => {
    try {
      const value = await nodeCall(host, method, params, { timeoutMs })
      answers.push({ key: canonical(value), value })
    } catch (error) {
      if (!retryable(host, error)) throw error
      lastError = error
    }
  }

  const first = hosts.slice(0, 3)
  await new Promise<void>((resolve, reject) => {
    let left = first.length
    for (const host of first) {
      ask(host).then(() => {
        left -= 1
        if (majority() || left === 0) resolve()
      }, reject)
    }
  })
  for (const host of hosts.slice(3)) {
    if (majority()) break
    await ask(host)
  }
  const agreed = majority()
  if (agreed) return agreed.value
  if (answers[0]) {
    // Не сошлись — чаще всего это свежая транзакция, которую одни ноды уже
    // видят, а другие ещё нет. Берём ответ самой быстрой.
    console.warn(`[direct] ${method}: nodes disagree`)
    return answers[0].value
  }
  throw allFailed(lastError)
}

async function withUsers(
  method: string,
  data: unknown,
  timeoutMs: number
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> =
    data && typeof data === 'object' && !Array.isArray(data) && 'contents' in data
      ? (data as Record<string, unknown>)
      : { contents: data }
  if (!WITH_USERS.has(method)) return result

  type Post = { txid?: unknown; address?: unknown; lastComment?: { address?: unknown } | null }
  const posts = (Array.isArray(result.contents) ? (result.contents as Post[]) : []).filter(
    (p) => p && p.txid
  )
  const authors = new Set(posts.map((p) => p.address))
  const users = [
    ...new Set(
      posts
        .map((p) => p.lastComment?.address)
        .filter((u): u is string => typeof u === 'string' && !!u && !authors.has(u))
    ),
  ]
  if (!users.length) return result
  try {
    result.users = await withFailover('getuserprofile', [users, '1'], timeoutMs)
  } catch {
    // без профилей комментаторов лента всё равно покажется
  }
  return result
}

/** То же, что `getByPRC` через прокси, но напрямую к нодам. */
export async function directRpc(params: T_RpcRequestParams): Promise<unknown> {
  const { method } = params
  const parameters = params.parameters ?? []
  const options = params.options ?? {}
  const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT_MS

  let data: unknown
  if (typeof options.node === 'string' && options.node) {
    // Ноду назвали сами (обход сети в обозревателе) — только она.
    const host = options.node.replace(/:\d+$/, '')
    data = await nodeCall(host, method, parameters, { timeoutMs })
  } else if (options.noFailover === true) {
    data = await once(method, parameters, timeoutMs)
  } else if (QUORUM_METHODS.has(method)) {
    data = await quorum(method, parameters, timeoutMs)
  } else {
    data = await withFailover(method, parameters, timeoutMs)
  }

  if (
    SCENARIO_METHODS.has(method) &&
    getRpcPath(method, options.ex === true).startsWith('/rpc-ex/')
  ) {
    data = await withUsers(method, data, timeoutMs)
  }
  return { result: 'success', data }
}
