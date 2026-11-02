/**
 * «Крупные кошельки» эксплорера: стейкеры последних блоков и активные адреса
 * с балансами (логика и кэши — components/large-wallets/large-wallets.ts).
 *
 * Запросов много и они медленные (около 1,8 с каждый), поэтому:
 *   - один общий пул на 6 запросов; балансы идут вне очереди, чтобы строки
 *     появлялись, пока проверяются блоки;
 *   - «блок → стейкер» хранится в localStorage: при повторном заходе
 *     спрашиваем только новые блоки;
 *   - сохранённые балансы показываем сразу и переспрашиваем устаревшие.
 * Состояние общее на модуль: вернувшись на вкладку, видим готовый список.
 */

import { computed, ref, shallowRef, triggerRef, watch } from 'vue'
import { getByPRC } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getExplorerRpcConfig } from './use-explorer-preferred-node'
import { useActiveAddresses } from './use-active-addresses'
import { useCoinInfo } from './use-block-explorer-queries'
import { extractCoinstakeInfo } from '@/pages/block-explorer-page/components/shared/extract-coinstake'
import {
  ACTIVE_CANDIDATES,
  STAKER_BLOCKS,
  buildWalletRows,
  countStakes,
  isBalanceStale,
  mergeCandidates,
  readBalanceCache,
  readStakerCache,
  safeStorage,
  writeBalanceCache,
  writeStakerCache,
  type CachedBalance,
} from '@/pages/block-explorer-page/components/large-wallets/large-wallets'
import type { GetLastBlocksResponse } from '@/types/rpc-responses/get-last-blocks'
import type { GetBlockTransactionsResponse } from '@/types/rpc-responses/get-transactions'
import type { GetAddressInfoResponse } from '@/types/rpc-responses/get-address-info'

const CONCURRENCY = 6
/** Чаще не пересобираем: новых блоков за это время — единицы. */
const RERUN_AFTER_MS = 5 * 60_000
/** Как часто сохранять кэш стейкеров во время проверки. */
const PERSIST_EVERY = 10

const hashes = shallowRef<string[]>([])
const stakerByHash = shallowRef(new Map<string, string>())
const balances = shallowRef(new Map<string, number>())
const blocksDone = ref(0)
const balancesLeft = ref(0)
/** Работают запросы пула. */
const busy = ref(false)
/** Ждём список последних блоков: пул может стоять, а проверка ещё не началась. */
const scanning = ref(false)
const failed = ref(false)
const started = ref(false)
let finishedAt = 0

let stakerCache = new Map<string, string>()
let balanceCache = new Map<string, CachedBalance>()
const blockQueue: string[] = []
const balanceQueue: string[] = []
const queuedBalances = new Set<string>()
let activeWorkers = 0
let sinceSave = 0

function persist(): void {
  const storage = safeStorage()
  writeStakerCache(storage, stakerCache)
  writeBalanceCache(storage, balanceCache)
  sinceSave = 0
}

function setBalance(address: string, balance: number): void {
  balances.value.set(address, balance)
  triggerRef(balances)
}

/** Баланс в очередь, если его нет или он устарел; сохранённый — сразу в таблицу. */
function enqueueBalance(address: string): void {
  if (!address || queuedBalances.has(address)) return
  const cached = balanceCache.get(address)
  if (cached && !balances.value.has(address)) setBalance(address, cached.balance)
  if (!isBalanceStale(cached, Date.now())) return
  queuedBalances.add(address)
  balanceQueue.push(address)
  balancesLeft.value = queuedBalances.size
  pump()
}

async function loadBalance(address: string): Promise<void> {
  try {
    const resp = (await getByPRC(
      { method: rpcEndpoints.getAddressInfo, parameters: [address], options: { auth: false } },
      getExplorerRpcConfig()
    )) as GetAddressInfoResponse
    const balance = Number(resp?.data?.balance)
    if (Number.isFinite(balance)) {
      balanceCache.delete(address)
      balanceCache.set(address, { balance, at: Date.now() })
      setBalance(address, balance)
    }
  } catch {
    // Не пришёл — остаётся сохранённый, если был; переспросим при следующем заходе.
  } finally {
    queuedBalances.delete(address)
    balancesLeft.value = queuedBalances.size
  }
}

async function loadStaker(hash: string): Promise<void> {
  try {
    const resp = (await getByPRC(
      {
        method: rpcEndpoints.getBlockTransactions,
        parameters: [hash, 0, 1],
        options: { auth: false },
      },
      getExplorerRpcConfig()
    )) as GetBlockTransactionsResponse
    const staker = extractCoinstakeInfo(resp?.data ?? [])?.staker
    if (staker) {
      stakerCache.set(hash, staker)
      stakerByHash.value.set(hash, staker)
      triggerRef(stakerByHash)
      enqueueBalance(staker)
      if (++sinceSave >= PERSIST_EVERY) persist()
    }
  } catch {
    // Один блок не пришёл — список чуть короче, остальное не страдает.
  } finally {
    blocksDone.value++
  }
}

async function worker(): Promise<void> {
  try {
    for (;;) {
      const address = balanceQueue.shift()
      if (address) {
        await loadBalance(address)
        continue
      }
      const hash = blockQueue.shift()
      if (hash) {
        await loadStaker(hash)
        continue
      }
      return
    }
  } finally {
    activeWorkers--
    if (activeWorkers === 0) {
      busy.value = false
      if (!scanning.value) finishedAt = Date.now()
      persist()
    }
  }
}

function pump(): void {
  while (activeWorkers < CONCURRENCY && (balanceQueue.length || blockQueue.length)) {
    activeWorkers++
    busy.value = true
    void worker()
  }
}

async function scan(): Promise<void> {
  if (scanning.value || busy.value) return
  if (finishedAt && Date.now() - finishedAt < RERUN_AFTER_MS) return
  scanning.value = true
  failed.value = false
  started.value = true
  const storage = safeStorage()
  stakerCache = readStakerCache(storage)
  if (!balanceCache.size) balanceCache = readBalanceCache(storage)
  try {
    const resp = (await getByPRC(
      {
        method: rpcEndpoints.getLastBlocks,
        parameters: [STAKER_BLOCKS, -1, false],
        options: { auth: false },
      },
      getExplorerRpcConfig()
    )) as GetLastBlocksResponse
    const list = (resp?.data ?? []).map((b) => b.hash).filter(Boolean)
    hashes.value = list
    const known = new Map<string, string>()
    for (const hash of list) {
      const staker = stakerCache.get(hash)
      if (staker) known.set(hash, staker)
      else blockQueue.push(hash)
    }
    stakerByHash.value = known
    blocksDone.value = known.size
    for (const staker of new Set(known.values())) enqueueBalance(staker)
  } catch {
    failed.value = !hashes.value.length
  }
  scanning.value = false
  pump()
  if (activeWorkers === 0) finishedAt = Date.now()
}

export function useLargeWallets() {
  const active = useActiveAddresses({ blockDepth: 50, txLimit: 100 })
  const { data: coinInfo } = useCoinInfo()

  void scan()

  // Самые активные адреса — тоже кандидаты: их балансы в ту же очередь.
  watch(
    () => active.data.value?.addresses,
    (list) => {
      for (const row of (list ?? []).slice(0, ACTIVE_CANDIDATES)) enqueueBalance(row.address)
    },
    { immediate: true }
  )

  const candidates = computed(() =>
    mergeCandidates(countStakes(hashes.value, stakerByHash.value), active.data.value?.addresses)
  )
  const rows = computed(() =>
    buildWalletRows(candidates.value, balances.value, coinInfo.value?.data?.emission)
  )

  return {
    rows,
    emission: computed(() => coinInfo.value?.data?.emission ?? null),
    blocksTotal: computed(() => hashes.value.length),
    blocksDone: computed(() => Math.min(blocksDone.value, hashes.value.length)),
    balancesLeft: computed(() => balancesLeft.value),
    candidatesCount: computed(() => candidates.value.length),
    loading: computed(
      () => scanning.value || busy.value || !started.value || active.isLoading.value
    ),
    failed: computed(() => failed.value),
  }
}
