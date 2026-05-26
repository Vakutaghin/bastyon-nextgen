/**
 * Remote registry — каталог мини-приложений с pocketnet-ноды (RPC `getapps`).
 *
 * Legacy эквивалент — [satolist.js:6828-6870](../../../../___original-repos/pocketnet.gui/js/satolist.js#L6828-L6870):
 *
 * ```js
 * miniapps.getall(ps) {
 *   parameters = { tags:[], search:'', topHeight, pageStart:0, pageSize:20, orderBy:'height', orderDesc:true, ...ps }
 *   return rpc('getapps', parameters)
 * }
 * ```
 *
 * Здесь — типизированный обёрткой с встроенной пагинацией. Никакого кэша внутри
 * (его дают вышестоящие слои: Vue Query или composable).
 */

import { logger } from '@/services/logger'

const log = logger.scope('[mini-apps:remote]')

/** Поле приходящее с ноды. Шейп нестрогий — нода может добавлять/убирать поля. */
export interface RemoteAppEntry {
  id: string
  name: string
  scope: string
  /** URL иконки. Если нода не отдаёт — строим из scope (`https://<scope>/b_icon.png`). */
  icon?: string
  description?: string
  address?: string
  /** Bitcoin-адрес автора. */
  author?: string
  tags?: readonly string[]
  /** Высота блока, в котором приложение зарегистрировано. */
  height?: number
}

export interface LoadRemoteAppsParams {
  pageStart?: number
  pageSize?: number
  /** Свободная подстрока для фильтра по name/description/address. */
  search?: string
  /** Список тегов для фильтра. */
  tags?: readonly string[]
  /** Поле сортировки. Default: 'height'. */
  orderBy?: string
  /** Default: true. */
  orderDesc?: boolean
  /** Текущая высота tip-блока. Если задано — нода ограничивает результат по `height <= topHeight`. */
  topHeight?: number
}

export interface RemoteAppsPage {
  apps: RemoteAppEntry[]
  /** Запрошенные параметры — для дебага. */
  params: Required<Omit<LoadRemoteAppsParams, 'topHeight'>> & { topHeight?: number }
  /** Грубая эвристика: если страница меньше pageSize — больше страниц нет. */
  hasMore: boolean
}

/** Дефолтные значения параметров — повторяют legacy. */
const DEFAULTS = {
  pageStart: 0,
  pageSize: 20,
  search: '',
  tags: [] as readonly string[],
  orderBy: 'height',
  orderDesc: true,
} as const

export type RpcFetcher = (
  method: string,
  parameters: unknown[] | Record<string, unknown>
) => Promise<unknown>

export class RemoteAppsLoader {
  constructor(private readonly rpc: RpcFetcher) {}

  async load(params: LoadRemoteAppsParams = {}): Promise<RemoteAppsPage> {
    const resolved = { ...DEFAULTS, ...params }

    // Legacy шлёт parameters как **объект**, а не массив. Ноды pocketnet это поддерживают.
    const rpcParams: Record<string, unknown> = {
      tags: resolved.tags,
      search: resolved.search,
      pageStart: resolved.pageStart,
      pageSize: resolved.pageSize,
      orderBy: resolved.orderBy,
      orderDesc: resolved.orderDesc,
    }
    if (typeof resolved.topHeight === 'number') rpcParams.topHeight = resolved.topHeight

    let raw: unknown
    try {
      raw = await this.rpc('getapps', rpcParams)
    } catch (err) {
      log.warn('getapps failed', err)
      throw err
    }

    // Нода отдаёт `{ result: 'success', data: [...] }` — разворачиваем здесь, чтобы
    // тестовые fixtures могли передавать или сырой массив, или полный envelope.
    const unwrapped = unwrapEnvelope(raw)
    const apps = normalizeResponse(unwrapped)

    return {
      apps,
      params: {
        pageStart: resolved.pageStart,
        pageSize: resolved.pageSize,
        search: resolved.search,
        tags: resolved.tags,
        orderBy: resolved.orderBy,
        orderDesc: resolved.orderDesc,
        topHeight: resolved.topHeight,
      },
      hasMore: apps.length === resolved.pageSize,
    }
  }
}

/**
 * Превращает ответ ноды в нормализованные `RemoteAppEntry`. Поддерживает оба формата:
 *
 * 1. **Pocketnet RPC wire-формат** (актуальный на 2026):
 *    ```
 *    { s1: <author>, s2: <id>, p: { s1: '<json>', s2: <id> }, height, time, ad: { r: rating } }
 *    ```
 *    где `p.s1` — JSON-строка `{ n: name, s: scope, ts: testScope, d: description, t: tags[] }`.
 *
 * 2. **Плоский формат** (когда нода или middleware уже распаковали):
 *    `{ id, name, scope, description, tags, ... }`.
 *
 * Legacy эквивалент — `adaptApplicationData` ([index.js:2627-2638](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L2627-L2638)),
 * также распаковывает оба варианта через `getFieldValue(app, field)`.
 */
function normalizeResponse(raw: unknown): RemoteAppEntry[] {
  if (!Array.isArray(raw)) return []

  const out: RemoteAppEntry[] = []
  for (const entry of raw) {
    const normalized = normalizeEntry(entry)
    if (normalized) out.push(normalized)
  }
  return out
}

function normalizeEntry(entry: unknown): RemoteAppEntry | null {
  if (!entry || typeof entry !== 'object') return null
  const r = entry as Record<string, unknown>

  // Wire-формат: распаковываем p.s1 как JSON
  let unpacked: Record<string, unknown> | null = null
  const pBlock = r.p as { s1?: unknown } | undefined
  if (pBlock && typeof pBlock.s1 === 'string') {
    try {
      const parsed = JSON.parse(pBlock.s1)
      if (parsed && typeof parsed === 'object') {
        unpacked = parsed as Record<string, unknown>
      }
    } catch {
      // не валидный JSON — пропускаем wire-распаковку, fallback на flat-поля
    }
  }

  // id: `s2` в wire-формате, либо плоский `id`
  const id =
    typeof r.s2 === 'string' && r.s2.trim()
      ? r.s2.trim()
      : typeof r.id === 'string'
        ? r.id.trim()
        : ''

  // name: wire `p.s1.n` либо плоский `name` либо `manifest.name`
  const name =
    (unpacked && typeof unpacked.n === 'string' && unpacked.n.trim()) ||
    (typeof r.name === 'string' && r.name.trim()) ||
    (typeof (r.manifest as { name?: string } | undefined)?.name === 'string'
      ? (r.manifest as { name: string }).name.trim()
      : '') ||
    ''

  // scope: wire `p.s1.s` либо плоский `scope`
  const scope =
    (unpacked && typeof unpacked.s === 'string' && unpacked.s.trim()) ||
    (typeof r.scope === 'string' && r.scope.trim()) ||
    ''

  if (!id || !name || !scope) return null

  // description с фильтром заметного legacy-бага «[object Object]»
  const rawDescription =
    (unpacked && typeof unpacked.d === 'string' ? unpacked.d : '') ||
    (typeof r.description === 'string' ? r.description : '')
  const description =
    !rawDescription || rawDescription === '[object Object]' ? undefined : rawDescription

  const tags: string[] = []
  const rawTags = (unpacked?.t ?? r.tags) as unknown
  if (Array.isArray(rawTags)) {
    for (const t of rawTags) {
      if (typeof t === 'string' && t.trim()) tags.push(t.trim())
    }
  }

  // author: wire `s1` (outer) либо плоский `author`/`address`
  const author =
    (typeof r.s1 === 'string' && r.s1.trim()) ||
    (typeof r.author === 'string' && r.author.trim()) ||
    (typeof r.address === 'string' && r.address.trim()) ||
    undefined

  return {
    id,
    name,
    scope,
    icon: typeof r.icon === 'string' && r.icon ? r.icon : iconFromScope(scope),
    description,
    address: typeof r.address === 'string' ? r.address : undefined,
    author,
    tags,
    height: typeof r.height === 'number' ? r.height : undefined,
  }
}

function iconFromScope(scope: string): string {
  const trimmed = scope.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return `https://${trimmed}/b_icon.png`
}

/** Снимает обёртку `{result, data}` или `{data}`, оставляя сырой массив. */
function unwrapEnvelope(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const r = raw as Record<string, unknown>
  if (r.result === 'error') {
    throw new Error(typeof r.error === 'string' ? r.error : 'rpc_error')
  }
  if ('data' in r) return r.data
  return r
}
