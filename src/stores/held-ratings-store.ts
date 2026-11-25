/**
 * Оценка поста, которую ещё можно поменять. Нода вторую оценку того же поста
 * не принимает (DoubleScore), отменить первую тоже нельзя, поэтому оценка
 * уходит в сеть не сразу, а через несколько секунд: промах по звезде можно
 * исправить другой звездой или отменить.
 *
 * Живёт в сторе, а не в звёздах под постом: ленту пролистали, карточка ушла с
 * экрана — оценка всё равно уйдёт. Свёрнутое мобильное приложение система
 * замораживает, поэтому при сворачивании ждущие оценки уходят сразу. Окно
 * закрыли посреди ожидания — оценка записана на устройстве и уйдёт при
 * следующем запуске; сменили аккаунт — когда вернутся в тот, чья она.
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

import {
  classifyVoteError,
  handleVoteError,
} from '@/b-components/content/post-card/components/star-rating/helpers/star-rating-errors'
import { sendUpvoteTransaction } from '@/b-components/content/post-card/components/star-rating/helpers/star-rating-transaction'
import { HELD_RATINGS_PREFIX } from '@/blockchain/constants/storage'
import { useAuthStore } from '@/blockchain/store/auth-store'
import {
  isMobileAppInBackground,
  onAppBackground,
  onAppForeground,
} from '@/helpers/common/app-foreground'
import { usePendingRatingsStore } from '@/stores/pending-ratings-store'

/** Сколько оценка ждёт: за это время её можно поменять или отменить. */
export const RATING_HOLD_MS = 5_000
/** Сколько ждать подтверждения сети. */
const PENDING_TTL_MS = 10 * 60 * 1000
/** Отправку начали и не закончили (окно закрыли): через столько можно повторить. */
const CLAIM_MS = 2 * 60 * 1000
/** Оценка, не отправленная дольше, уже ничего не значит. */
const KEEP_MS = 3 * 24 * 60 * 60 * 1000

export interface HeldRating {
  shareId: string
  value: number
  /** Автор поста — в OP_RETURN оценки. */
  author: string
  /** Заголовок поста для списка «Ожидают подтверждения». */
  title: string
  /** Чья оценка. */
  address: string
  /** Когда уйдёт (мс). */
  until: number
  /** Отправку начали (мс). */
  sendingAt?: number
}

const storageKey = (address: string): string => HELD_RATINGS_PREFIX + address

/** null — хранилище недоступно: тогда оценка живёт только в памяти. */
function readStored(address: string): HeldRating[] | null {
  try {
    const raw = localStorage.getItem(storageKey(address))
    const list: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(list)) return []
    return (list as Partial<HeldRating>[]).filter(
      (x): x is HeldRating =>
        !!x &&
        typeof x.shareId === 'string' &&
        typeof x.author === 'string' &&
        Number.isInteger(x.value) &&
        x.value! >= 1 &&
        x.value! <= 5 &&
        Number.isFinite(x.until) &&
        x.address === address
    )
  } catch {
    return null
  }
}

function writeStored(address: string, list: HeldRating[]): void {
  try {
    if (list.length) localStorage.setItem(storageKey(address), JSON.stringify(list))
    else localStorage.removeItem(storageKey(address))
  } catch {
    // нет места или хранилище закрыто — останется в памяти
  }
}

function store(item: HeldRating): void {
  const rest = (readStored(item.address) ?? []).filter((x) => x.shareId !== item.shareId)
  writeStored(item.address, [...rest, item])
}

function forget(item: HeldRating): void {
  const list = readStored(item.address)
  if (list)
    writeStored(
      item.address,
      list.filter((x) => x.shareId !== item.shareId)
    )
}

/**
 * Взять оценку на отправку. Другая вкладка её уже отправляет или отменила —
 * false: запись на устройстве главнее того, что в памяти.
 */
function claim(item: HeldRating, now: number): boolean {
  const list = readStored(item.address)
  if (!list) return true
  const stored = list.find((x) => x.shareId === item.shareId)
  if (!stored) return false
  if (stored.sendingAt && now - stored.sendingAt < CLAIM_MS) return false
  store({ ...stored, value: item.value, sendingAt: now })
  return true
}

export const useHeldRatingsStore = defineStore('held-ratings', () => {
  const items = ref(new Map<string, HeldRating>())
  /** Отправленные за этот запуск: пост мог ещё не обновиться. */
  const sent = ref(new Map<string, number>())
  const now = ref(Date.now())

  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  let ticker: ReturnType<typeof setInterval> | null = null
  let stopWatching: (() => void) | null = null
  let initedFor: string | null = null

  const heldValue = (shareId: string): number | null => items.value.get(shareId)?.value ?? null
  const sentValue = (shareId: string): number | null => sent.value.get(shareId) ?? null

  /** Сколько секунд осталось — для подписи «Отменить 4». */
  function secondsLeft(shareId: string): number {
    const item = items.value.get(shareId)
    return item ? Math.max(1, Math.ceil((item.until - now.value) / 1000)) : 0
  }

  function tick(): void {
    now.value = Date.now()
    if (items.value.size > 0 && !ticker) ticker = setInterval(tick, 250)
    if (items.value.size === 0 && ticker) {
      clearInterval(ticker)
      ticker = null
    }
  }

  function drop(shareId: string): HeldRating | undefined {
    const item = items.value.get(shareId)
    clearTimeout(timers.get(shareId))
    timers.delete(shareId)
    items.value.delete(shareId)
    tick()
    return item
  }

  function wait(item: HeldRating): void {
    clearTimeout(timers.get(item.shareId))
    items.value.set(item.shareId, item)
    timers.set(
      item.shareId,
      setTimeout(() => void send(item.shareId), Math.max(0, item.until - Date.now()))
    )
    tick()
    watchApp()
  }

  /** Сворачивание — отправить сейчас, возвращение — догнать неотправленное. */
  function watchApp(): void {
    if (stopWatching) return
    const stops = [
      onAppBackground(() => {
        if (isMobileAppInBackground()) flush()
      }),
      onAppForeground(() => {
        initedFor = null
        init()
      }),
    ]
    stopWatching = () => stops.forEach((stop) => stop())
  }

  /** Поставить оценку или поменять ждущую: отсчёт начинается заново. */
  function hold(rating: Pick<HeldRating, 'shareId' | 'value' | 'author' | 'title'>): void {
    const address = useAuthStore().getUserAddress
    if (!address) return
    const item: HeldRating = { ...rating, address, until: Date.now() + RATING_HOLD_MS }
    store(item)
    wait(item)
  }

  /** Передумали: в сеть ничего не уйдёт. */
  function cancel(shareId: string): void {
    const item = drop(shareId)
    if (item) forget(item)
  }

  /**
   * Отправить. `quiet` — человек уже не у этих звёзд (свернул приложение,
   * оценка с прошлого запуска): причину отказа не показываем, а без сети
   * оценка подождёт следующего раза.
   */
  async function send(shareId: string, quiet = false): Promise<void> {
    const item = drop(shareId)
    // Аккаунт сменили: оценка прежнего подождёт на устройстве.
    if (!item || useAuthStore().getUserAddress !== item.address) return
    if (!claim(item, Date.now())) return

    const pending = usePendingRatingsStore()
    sent.value.set(shareId, item.value)
    void pending.add(shareId, item.value, PENDING_TTL_MS, item.title)
    try {
      const txid = await sendUpvoteTransaction(shareId, item.value, item.author)
      void pending.markSubmitted(shareId, txid)
    } catch (error: unknown) {
      console.error('[held-ratings] vote failed:', error)
      sent.value.delete(shareId)
      void pending.markFailed(shareId, error instanceof Error ? error.message : undefined)
      const reason = classifyVoteError(error)
      if (quiet && reason.isNetworkFailed) {
        store(item)
        return
      }
      if (!quiet) handleVoteError(reason, () => {})
    }
    forget(item)
  }

  /** Отправить все ждущие, не дожидаясь отсчёта. */
  function flush(): void {
    for (const shareId of [...items.value.keys()]) void send(shareId, true)
  }

  /** Ждущие с прошлого запуска: досчитать или, если срок вышел, отправить. */
  function init(): void {
    const address = useAuthStore().getUserAddress
    if (!address || initedFor === address) return
    initedFor = address
    watchApp()
    const at = Date.now()
    for (const item of readStored(address) ?? []) {
      if (items.value.has(item.shareId)) continue
      if (item.sendingAt && at - item.sendingAt < CLAIM_MS) continue
      if (at - item.until > KEEP_MS) {
        forget(item)
        continue
      }
      // Часы перевели назад: дольше обычного не ждём.
      const until = Math.min(item.until, at + RATING_HOLD_MS)
      wait({ ...item, until })
      if (until <= at) void send(item.shareId, true)
    }
  }

  /** Вошли, вышли, сменили аккаунт: записанное на устройстве остаётся. */
  function reset(): void {
    for (const shareId of [...items.value.keys()]) drop(shareId)
    sent.value.clear()
    stopWatching?.()
    stopWatching = null
    initedFor = null
  }

  return { items, heldValue, sentValue, secondsLeft, hold, cancel, flush, init, reset }
})
