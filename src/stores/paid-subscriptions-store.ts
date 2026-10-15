/**
 * Платные подписки: мои платежи авторам, цены авторов, оплата и своя цена.
 *
 * Мои платежи за год приходят одним запросом (`getfromtotransactions [я, '']`),
 * и по ним считается подписка на любого автора — без запроса на каждый пост.
 * Только что отправленный платёж нода покажет, когда он попадёт в блок, поэтому
 * он учитывается сразу (`sent`): заплатил — пост открылся. Так же своя новая
 * цена видна до подтверждения (`pricePending`).
 *
 * Как решается, открыт ли пост, — `accessFor`; как считается срок —
 * helpers/paid-subscription/status.
 */

import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { getPlatform } from '@mobile/utils/platform'
import { useAuthStore } from '@/blockchain'
import { accountScopedKey } from '@/blockchain/storage/account-scoped-key'
import { fetchAccountSettings, paidSubscriptionValue } from '@/helpers/api/account-settings'
import { fetchSubscriptionPayments } from '@/helpers/paid-subscription/payments-api'
import {
  paidSubscriptionStatus,
  type PaidOffer,
  type PaidSubscriptionStatus,
  type SubscriptionPayment,
} from '@/helpers/paid-subscription/status'
import { useUserRelationsStore } from './user-relations-store'

/** Как открыт пост «для платных подписчиков» смотрящему. */
export type PaidAccess =
  /** Показывать. */
  | 'open'
  /** Ещё узнаём цену или платежи. */
  | 'checking'
  /** Нужно оформить подписку. */
  | 'buy'
  /** Оплачено (или автор открыл посты подписчикам) — осталось подписаться. */
  | 'follow'
  /** Автор цену не назначал — оформить нельзя. */
  | 'unavailable'
  /** Не смогли проверить. */
  | 'error'
  /** Не вошёл в аккаунт. */
  | 'guest'
  /** В приложении для iPhone оплату не показываем, как старый клиент. */
  | 'unsupported'

const PRICE_TTL_MS = 10 * 60_000
const PAYMENTS_TTL_MS = 3 * 60_000
/** Платёж, который нода так и не показала, через 6 часов не считаем. */
const SENT_TTL_S = 6 * 3600
/** Новая цена, которую сеть так и не подтвердила, через час забываем. */
const PRICE_PENDING_TTL_S = 3600
const SENT_KEY = 'bastyon_paid_subscription_sent'
const PRICE_KEY = 'bastyon_paid_subscription_price_pending'

interface PricePending {
  value: number
  txid: string
  at: number
}

const nowSeconds = () => Math.floor(Date.now() / 1000)

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    if (value === null || (Array.isArray(value) && !value.length)) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Хранилище недоступно — живёт до перезапуска.
  }
}

/** Платёж за подписку из приложения для iPhone не принимает App Store. */
export function paidPurchaseSupported(): boolean {
  return getPlatform() !== 'capacitor-ios'
}

export const usePaidSubscriptionsStore = defineStore('paid-subscriptions', () => {
  const authStore = useAuthStore()
  const me = computed<string>(() => authStore.getUserAddress || '')

  /** Время для сроков: тикает раз в полминуты, чтобы срок кончался сам. */
  const now = ref(nowSeconds())
  let clock: ReturnType<typeof setInterval> | null = null
  function startClock(): void {
    if (clock || typeof window === 'undefined') return
    clock = setInterval(() => (now.value = nowSeconds()), 30_000)
  }

  // ── Мои платежи ──────────────────────────────────────────────────────
  /** Чьи данные загружены: при смене аккаунта всё начинается заново. */
  const owner = ref('')
  const myPayments = ref<SubscriptionPayment[] | null>(null)
  const myPaymentsError = ref(false)
  let myPaymentsAt = 0
  let myPaymentsRequest: Promise<void> | null = null
  /** Отправленные отсюда, ещё не показанные нодой. */
  const sent = ref<SubscriptionPayment[]>([])

  function adopt(address: string): void {
    if (owner.value === address) return
    owner.value = address
    myPayments.value = null
    myPaymentsError.value = false
    myPaymentsAt = 0
    myPaymentsRequest = null
    sent.value = address ? readJson(accountScopedKey(SENT_KEY, address), []) : []
    pricePending.value = address ? readJson(accountScopedKey(PRICE_KEY, address), null) : null
  }

  function persistSent(): void {
    if (owner.value) writeJson(accountScopedKey(SENT_KEY, owner.value), sent.value)
  }

  /** Отправленные, которых нода ещё не показала и которые не устарели. */
  function pruneSent(known: readonly SubscriptionPayment[]): void {
    const txids = new Set(known.map((p) => p.txid))
    const fresh = sent.value.filter((p) => !txids.has(p.txid) && nowSeconds() - p.time < SENT_TTL_S)
    if (fresh.length !== sent.value.length) {
      sent.value = fresh
      persistSent()
    }
  }

  /** Мои платежи за год (с отправленными). Повторно — не чаще раза в 3 минуты. */
  async function ensureMyPayments(force = false): Promise<void> {
    const address = me.value
    if (!address) return
    adopt(address)
    startClock()
    if (myPaymentsRequest) return myPaymentsRequest
    if (!force && myPayments.value && Date.now() - myPaymentsAt < PAYMENTS_TTL_MS) return
    myPaymentsError.value = false
    myPaymentsRequest = (async () => {
      try {
        const list = await fetchSubscriptionPayments({ from: address })
        if (owner.value !== address) return
        myPayments.value = list
        myPaymentsError.value = false
        myPaymentsAt = Date.now()
        pruneSent(list)
      } catch (e) {
        console.warn('[paidSubscriptions] payments failed', e)
        if (owner.value === address) myPaymentsError.value = true
      } finally {
        myPaymentsRequest = null
      }
    })()
    return myPaymentsRequest
  }

  /** Все мои платежи: из сети и только что отправленные. */
  const allMyPayments = computed<SubscriptionPayment[]>(() => {
    const list = myPayments.value ?? []
    const known = new Set(list.map((p) => p.txid))
    return [...list, ...sent.value.filter((p) => !known.has(p.txid))]
  })

  function paymentsTo(author: string): SubscriptionPayment[] {
    return allMyPayments.value.filter((p) => p.to === author)
  }

  // ── Цены авторов ─────────────────────────────────────────────────────
  const prices = reactive(new Map<string, { value: number; at: number }>())
  const priceErrors = reactive(new Set<string>())
  const priceRequests = new Map<string, Promise<void>>()
  /** Своя новая цена, пока сеть её не подтвердила. */
  const pricePending = ref<PricePending | null>(null)

  function rememberPrice(address: string, value: number): void {
    prices.set(address, { value, at: Date.now() })
    priceErrors.delete(address)
    const pending = pricePending.value
    if (address === me.value && pending) {
      const stale = nowSeconds() - pending.at > PRICE_PENDING_TTL_S
      if (pending.value === value || stale) setPricePending(null)
    }
  }

  /** Цена из настроек, которые уже пришли (страница профиля грузит их сама). */
  function rememberSettings(address: string, settings: Record<string, unknown>): void {
    rememberPrice(address, paidSubscriptionValue(settings))
  }

  async function ensurePrice(address: string, force = false): Promise<void> {
    if (!address) return
    const known = prices.get(address)
    if (!force && known && Date.now() - known.at < PRICE_TTL_MS) return
    const running = priceRequests.get(address)
    if (running) return running
    priceErrors.delete(address)
    const request = (async () => {
      try {
        rememberSettings(address, await fetchAccountSettings(address))
      } catch (e) {
        console.warn('[paidSubscriptions] price failed', address, e)
        if (!prices.has(address)) priceErrors.add(address)
      } finally {
        priceRequests.delete(address)
      }
    })()
    priceRequests.set(address, request)
    return request
  }

  /** Цена автора: PKOIN в месяц, 0 — не назначена, < 0 — отключена; undefined — не знаем. */
  function priceOf(address: string): number | undefined {
    if (address && address === me.value && pricePending.value) return pricePending.value.value
    return prices.get(address)?.value
  }

  /** Цена, которую подтвердила сеть (без своей неподтверждённой новой). */
  function confirmedPriceOf(address: string): number | undefined {
    return prices.get(address)?.value
  }

  function setPricePending(value: PricePending | null): void {
    pricePending.value = value
    if (owner.value) writeJson(accountScopedKey(PRICE_KEY, owner.value), value)
  }

  // ── Статус и доступ ──────────────────────────────────────────────────
  /** Подписка на автора; null — пока не знаем цену или платежи. */
  function statusFor(author: string): PaidSubscriptionStatus | null {
    const price = priceOf(author)
    if (price === undefined || myPayments.value === null) return null
    return paidSubscriptionStatus(paymentsTo(author), price, now.value)
  }

  /** Открыт ли смотрящему пост автора «для платных подписчиков». */
  function accessFor(author: string): PaidAccess {
    if (!me.value) return 'guest'
    if (author === me.value) return 'open'
    const price = priceOf(author)
    if (price === undefined) return priceErrors.has(author) ? 'error' : 'checking'
    if (price === 0) return 'unavailable'
    const following = useUserRelationsStore().isSubscribed(author)
    if (price < 0) return following ? 'open' : 'follow'
    const status = statusFor(author)
    if (!status) return myPaymentsError.value ? 'error' : 'checking'
    if (status.kind === 'active') return following ? 'open' : 'follow'
    return paidPurchaseSupported() ? 'buy' : 'unsupported'
  }

  // ── Действия ─────────────────────────────────────────────────────────
  /**
   * Оплатить подписку и, если нужно, подписаться на автора: без обычной
   * подписки посты для платных подписчиков не откроются (так у старого клиента).
   * `subscribeFailed` — оплата ушла, а подписаться не вышло.
   */
  async function pay(
    author: string,
    offer: PaidOffer
  ): Promise<{ txid: string; subscribeFailed: boolean }> {
    const { payForSubscription } =
      await import('@/blockchain/core/actions/paid-subscription-action')
    const txid = await payForSubscription(author, offer.amount)
    adopt(me.value)
    sent.value = [
      ...sent.value,
      { from: me.value, to: author, txid, height: 0, amount: offer.amount, time: nowSeconds() },
    ]
    persistSent()
    now.value = nowSeconds()

    const relations = useUserRelationsStore()
    let subscribeFailed = false
    if (!relations.isSubscribed(author)) {
      try {
        await relations.subscribe(author)
      } catch (e) {
        console.warn('[paidSubscriptions] subscribe after payment failed', e)
        subscribeFailed = true
      }
    }
    return { txid, subscribeFailed }
  }

  /** Назначить свою цену (PKOIN в месяц) или отключить подписку (-1). */
  async function savePrice(value: number): Promise<string> {
    const { saveAccountSettings } =
      await import('@/blockchain/core/actions/account-settings-action')
    const { txid } = await saveAccountSettings(
      { paidsubscription: value },
      { kind: 'paidSubscriptionPrice', ...(value > 0 ? { amount: value } : {}) }
    )
    adopt(me.value)
    setPricePending({ value, txid, at: nowSeconds() })
    return txid
  }

  // ── Окно оформления (одно на приложение, как окно чаевых) ───────────
  const modal = reactive({ open: false, author: '' })

  function openModal(author: string): void {
    if (!author) return
    modal.author = author
    modal.open = true
    void ensurePrice(author, true)
    void ensureMyPayments(true)
  }

  function closeModal(): void {
    modal.open = false
  }

  /** Смена аккаунта: чужие платежи и своя цена не переживают её. */
  function reset(): void {
    owner.value = ''
    myPayments.value = null
    myPaymentsError.value = false
    myPaymentsAt = 0
    myPaymentsRequest = null
    sent.value = []
    pricePending.value = null
    prices.clear()
    priceErrors.clear()
    priceRequests.clear()
    modal.open = false
  }

  return {
    now,
    myPayments,
    myPaymentsError,
    allMyPayments,
    pricePending,
    modal,
    ensureMyPayments,
    ensurePrice,
    rememberSettings,
    priceOf,
    confirmedPriceOf,
    statusFor,
    accessFor,
    paymentsTo,
    pay,
    savePrice,
    openModal,
    closeModal,
    reset,
  }
})
