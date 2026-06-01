/**
 * Vue Query обёртки над RPC-методами блок-эксплорера.
 *
 * Все запросы идут без авторизации (auth: false) — данные публичные.
 * staleTime подобран под характер данных:
 *   - tip / последние блоки — короткий (~10 с);
 *   - getcompactblock по hash старых блоков — долгий (24 ч), блоки иммутабельны;
 *   - getaddressinfo / getaddresstransactions — средний (~30 с), баланс может меняться.
 *
 * Все запросы уважают preferred-node из use-explorer-preferred-node:
 * если пользователь закрепил конкретную ноду, getByPRC использует её, иначе —
 * стандартный round-robin по servers.json. Конфиг читается через геттер при каждом
 * вызове queryFn, поэтому смена ноды после mount работает без пересоздания query.
 */

import { computed, unref, type MaybeRef } from 'vue'
import { useQuery, type QueryClient } from '@tanstack/vue-query'
import type { RouteLocationRaw } from 'vue-router'
import { getByPRC } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getExplorerRpcConfig } from './use-explorer-preferred-node'
import type { GetNodeInfoResponse } from '@/types/rpc-responses/get-node-info'
import type { GetCoinInfoResponse } from '@/types/rpc-responses/get-coin-info'
import type { GetLastBlocksResponse } from '@/types/rpc-responses/get-last-blocks'
import type { GetCompactBlockResponse } from '@/types/rpc-responses/get-compact-block'
import type {
  GetTransactionsResponse,
  GetBlockTransactionsResponse,
} from '@/types/rpc-responses/get-transactions'
import type { GetAddressInfoResponse } from '@/types/rpc-responses/get-address-info'
import type { GetAddressTransactionsResponse } from '@/types/rpc-responses/get-address-transactions'
import type { SearchByHashResponse } from '@/types/rpc-responses/search-by-hash'
import type { GetStatisticResponse } from '@/types/rpc-responses/get-statistic'
import type { GetPeerInfoResponse } from '@/types/rpc-responses/get-peer-info'

const STALE_TIP = 10_000
const STALE_FRESH = 30_000
const STALE_HISTORICAL = 24 * 60 * 60 * 1000

// Голые fetch-функции — переиспользуются и в useQuery (queryFn ниже), и в
// prefetchExplorerTarget при наведении на ссылку. Конфиг ноды читается через
// геттер при каждом вызове, поэтому смена preferred-node работает без пересоздания.
function fetchBlockDetails(hashOrHeight: string) {
  return getByPRC(
    {
      method: rpcEndpoints.getCompactBlock,
      parameters: [hashOrHeight, -1],
      options: { auth: false },
    },
    getExplorerRpcConfig(),
  ) as Promise<GetCompactBlockResponse>
}

function fetchTransactionDetails(txid: string) {
  return getByPRC(
    {
      method: rpcEndpoints.getTransactions,
      parameters: [[txid]],
      options: { auth: false },
    },
    getExplorerRpcConfig(),
  ) as Promise<GetTransactionsResponse>
}

function fetchAddressInfo(address: string) {
  return getByPRC(
    {
      method: rpcEndpoints.getAddressInfo,
      parameters: [address],
      options: { auth: false },
    },
    getExplorerRpcConfig(),
  ) as Promise<GetAddressInfoResponse>
}

/** Tip-инфо: высота, хеш последнего блока, версия ноды, chain. */
export function useNodeInfo() {
  return useQuery<GetNodeInfoResponse>({
    queryKey: ['explorer', 'node-info'] as const,
    queryFn: () =>
      getByPRC(
        {
          method: rpcEndpoints.getNodeInfo,
          parameters: [],
          options: { auth: false },
        },
        getExplorerRpcConfig(),
      ) as Promise<GetNodeInfoResponse>,
    staleTime: STALE_TIP,
    refetchInterval: 15_000,
    refetchOnWindowFocus: false,
  })
}

/** Эмиссия / supply. Меняется медленно — кэш на 5 минут. */
export function useCoinInfo() {
  return useQuery<GetCoinInfoResponse>({
    queryKey: ['explorer', 'coin-info'] as const,
    queryFn: () =>
      getByPRC(
        {
          method: rpcEndpoints.getCoinInfo,
          parameters: [],
          options: { auth: false },
        },
        getExplorerRpcConfig(),
      ) as Promise<GetCoinInfoResponse>,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
}

/** Последние N блоков от tip-а. */
export function useLastBlocks(count: number = 20) {
  return useQuery<GetLastBlocksResponse>({
    queryKey: ['explorer', 'last-blocks', count] as const,
    queryFn: () =>
      getByPRC(
        {
          method: rpcEndpoints.getLastBlocks,
          parameters: [count, -1, false],
          options: { auth: false },
        },
        getExplorerRpcConfig(),
      ) as Promise<GetLastBlocksResponse>,
    staleTime: STALE_TIP,
    refetchInterval: 15_000,
    refetchOnWindowFocus: false,
  })
}

/** Один блок по hash либо height. */
export function useBlockDetails(hashOrHeight: MaybeRef<string>) {
  const key = computed(() => unref(hashOrHeight))
  return useQuery<GetCompactBlockResponse>({
    queryKey: ['explorer', 'block', key] as const,
    queryFn: () => fetchBlockDetails(unref(hashOrHeight)),
    enabled: computed(() => unref(hashOrHeight).length > 0),
    staleTime: STALE_HISTORICAL,
    refetchOnWindowFocus: false,
  })
}

/** Транзакции одного блока по hash. Пагинация offset/count. */
export function useBlockTransactions(
  blockHash: MaybeRef<string>,
  offset: MaybeRef<number> = 0,
  count: MaybeRef<number> = 50,
) {
  return useQuery<GetBlockTransactionsResponse>({
    queryKey: ['explorer', 'block-transactions', blockHash, offset, count] as const,
    queryFn: () =>
      getByPRC(
        {
          method: rpcEndpoints.getBlockTransactions,
          parameters: [unref(blockHash), unref(offset), unref(count)],
          options: { auth: false },
        },
        getExplorerRpcConfig(),
      ) as Promise<GetBlockTransactionsResponse>,
    enabled: computed(() => unref(blockHash).length > 0),
    staleTime: STALE_HISTORICAL,
    refetchOnWindowFocus: false,
  })
}

/** Одна или несколько транзакций по txid. Возвращает массив. */
export function useTransactionDetails(txid: MaybeRef<string>) {
  return useQuery<GetTransactionsResponse>({
    queryKey: ['explorer', 'tx', txid] as const,
    queryFn: () => fetchTransactionDetails(unref(txid)),
    enabled: computed(() => unref(txid).length > 0),
    staleTime: STALE_FRESH,
    refetchOnWindowFocus: false,
  })
}

/** Баланс/lastChange по адресу. */
export function useAddressInfo(address: MaybeRef<string>) {
  return useQuery<GetAddressInfoResponse>({
    queryKey: ['explorer', 'address-info', address] as const,
    queryFn: () => fetchAddressInfo(unref(address)),
    enabled: computed(() => unref(address).length > 0),
    staleTime: STALE_FRESH,
    refetchOnWindowFocus: false,
  })
}

/** Транзакции адреса. fromHeight=-1 — с tip-а вниз. */
export function useAddressTransactions(
  address: MaybeRef<string>,
  fromHeight: MaybeRef<number> = -1,
  count: MaybeRef<number> = 25,
) {
  return useQuery<GetAddressTransactionsResponse>({
    queryKey: ['explorer', 'address-transactions', address, fromHeight, count] as const,
    queryFn: () =>
      getByPRC(
        {
          method: rpcEndpoints.getAddressTransactions,
          parameters: [unref(address), unref(fromHeight), unref(count)],
          options: { auth: false },
        },
        getExplorerRpcConfig(),
      ) as Promise<GetAddressTransactionsResponse>,
    enabled: computed(() => unref(address).length > 0),
    staleTime: STALE_FRESH,
    refetchOnWindowFocus: false,
  })
}

/**
 * Сетевая статистика по часам. `depth` — широкий лимит, `hours` — сколько последних
 * часов берём. Под капотом параметры nodе: [depth=9999999, hours=N].
 * staleTime длиннее, чем у tip — статистика по прошлым часам не меняется.
 */
export function useStatsByHours(hours: MaybeRef<number> = 48) {
  return useQuery<GetStatisticResponse>({
    queryKey: ['explorer', 'stats-hours', hours] as const,
    queryFn: () =>
      getByPRC(
        {
          method: rpcEndpoints.getStatisticByHours,
          parameters: [9_999_999, unref(hours)],
          options: { auth: false },
        },
        getExplorerRpcConfig(),
      ) as Promise<GetStatisticResponse>,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
}

/** Сетевая статистика по дням. По умолчанию 30 дней. */
export function useStatsByDays(days: MaybeRef<number> = 30) {
  return useQuery<GetStatisticResponse>({
    queryKey: ['explorer', 'stats-days', days] as const,
    queryFn: () =>
      getByPRC(
        {
          method: rpcEndpoints.getStatisticByDays,
          parameters: [9_999_999, unref(days)],
          options: { auth: false },
        },
        getExplorerRpcConfig(),
      ) as Promise<GetStatisticResponse>,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
}

/**
 * Список пиров текущей ноды. Refetch каждые 30 с — peer-set меняется,
 * pingtime обновляется, banscore тоже.
 */
export function usePeerInfo() {
  return useQuery<GetPeerInfoResponse>({
    queryKey: ['explorer', 'peer-info'] as const,
    queryFn: () =>
      getByPRC(
        {
          method: rpcEndpoints.getPeerInfo,
          parameters: [],
          options: { auth: false },
        },
        getExplorerRpcConfig(),
      ) as Promise<GetPeerInfoResponse>,
    staleTime: STALE_FRESH,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  })
}

/** Серверный детектор типа строки. Используем как fallback. */
export function useSearchByHash(query: MaybeRef<string>, enabled: MaybeRef<boolean> = true) {
  return useQuery<SearchByHashResponse>({
    queryKey: ['explorer', 'search-by-hash', query] as const,
    queryFn: () =>
      getByPRC(
        {
          method: rpcEndpoints.searchByHash,
          parameters: [unref(query)],
          options: { auth: false },
        },
        getExplorerRpcConfig(),
      ) as Promise<SearchByHashResponse>,
    enabled: computed(() => unref(enabled) && unref(query).length > 0),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}

/**
 * Прогрев кэша целевой страницы при наведении на ссылку (hash-link/address-link).
 * Достаёт сущность из целевого маршрута и дёргает тот же queryKey/queryFn, что и
 * сама страница, — клик потом открывается мгновенно из кэша. prefetchQuery уважает
 * staleTime, поэтому повторные наведения не порождают лишних запросов.
 */
export function prefetchExplorerTarget(
  queryClient: QueryClient,
  to: RouteLocationRaw | undefined,
): void {
  if (!to || typeof to === 'string' || !('name' in to)) return
  const params = (to.params ?? {}) as Record<string, unknown>

  if (to.name === 'explorer-block') {
    const h = String(params.hashOrHeight ?? '')
    if (h) {
      queryClient.prefetchQuery({
        queryKey: ['explorer', 'block', h] as const,
        queryFn: () => fetchBlockDetails(h),
        staleTime: STALE_HISTORICAL,
      })
    }
  } else if (to.name === 'explorer-tx') {
    const id = String(params.txid ?? '')
    if (id) {
      queryClient.prefetchQuery({
        queryKey: ['explorer', 'tx', id] as const,
        queryFn: () => fetchTransactionDetails(id),
        staleTime: STALE_FRESH,
      })
    }
  } else if (to.name === 'explorer-address') {
    const addr = String(params.address ?? '')
    if (addr) {
      queryClient.prefetchQuery({
        queryKey: ['explorer', 'address-info', addr] as const,
        queryFn: () => fetchAddressInfo(addr),
        staleTime: STALE_FRESH,
      })
    }
  }
}
