/**
 * Закреплённый пост профиля — поле `pin` настроек аккаунта (accSet), как у
 * старого клиента: профиль показывает этот пост первым, а автор закрепляет и
 * открепляет свой пост из меню поста.
 *
 * Новое закрепление нода покажет, только когда транзакция попадёт в блок,
 * поэтому своё отправленное видно сразу (`pending`) и переживает перезапуск.
 * Сеть показала то же самое или прошёл час — забываем.
 *
 * Транзакция пишет настройки целиком: закрепление несёт и свою ещё не
 * подтверждённую цену платной подписки, а новая цена — своё закрепление
 * (paid-subscriptions-store), иначе одно стирало бы другое.
 */

import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'
import { useAuthStore } from '@/blockchain'
import { accountScopedKey } from '@/blockchain/storage/account-scoped-key'
import { fetchAccountSettings, type AccountSettings } from '@/helpers/api/account-settings'
import { usePaidSubscriptionsStore } from './paid-subscriptions-store'
import { t } from '@/i18n'

/** Настройки чужого профиля перечитываем не чаще. */
const PIN_TTL_MS = 10 * 60_000
/** Закрепление, которое сеть так и не показала, через час забываем. */
const PENDING_TTL_S = 3600
const PENDING_KEY = 'bastyon_pinned_post_pending'
const TXID_RE = /^[0-9a-f]{64}$/i

export interface PinPending {
  /** Что закрепили: txid поста, '' — открепили. */
  pin: string
  txid: string
  at: number
}

const nowSeconds = () => Math.floor(Date.now() / 1000)

/** Закреплённый пост из настроек аккаунта; не txid — ничего не закреплено. */
export function pinOfSettings(settings: AccountSettings): string {
  return typeof settings.pin === 'string' && TXID_RE.test(settings.pin) ? settings.pin : ''
}

function readPending(address: string): PinPending | null {
  try {
    const raw = localStorage.getItem(accountScopedKey(PENDING_KEY, address))
    const value = raw ? (JSON.parse(raw) as PinPending) : null
    return value && typeof value.pin === 'string' && typeof value.at === 'number' ? value : null
  } catch {
    return null
  }
}

function writePending(address: string, value: PinPending | null): void {
  try {
    const key = accountScopedKey(PENDING_KEY, address)
    if (value) localStorage.setItem(key, JSON.stringify(value))
    else localStorage.removeItem(key)
  } catch {
    // Хранилище недоступно — живёт до перезапуска.
  }
}

export const usePinnedPostsStore = defineStore('pinned-posts', () => {
  const authStore = useAuthStore()
  const me = computed<string>(() => authStore.getUserAddress || '')

  /** Что закреплено по данным сети: адрес → txid ('' — ничего). */
  const pins = reactive(new Map<string, { pin: string; at: number }>())
  const requests = new Map<string, Promise<void>>()
  /** Чьё `pending` загружено: при смене аккаунта читается заново. */
  const owner = ref('')
  const pending = ref<PinPending | null>(null)

  function adopt(address: string): void {
    if (owner.value === address) return
    owner.value = address
    pending.value = address ? readPending(address) : null
  }

  // Своё неподтверждённое — аккаунта, который сейчас вошёл.
  watch(me, adopt, { immediate: true })

  function setPending(value: PinPending | null): void {
    pending.value = value
    if (owner.value) writePending(owner.value, value)
  }

  const isStale = (p: PinPending): boolean => nowSeconds() - p.at > PENDING_TTL_S

  /** Настройки аккаунта пришли (страница профиля грузит их сама). */
  function remember(address: string, settings: AccountSettings): void {
    if (!address) return
    const pin = pinOfSettings(settings)
    pins.set(address, { pin, at: Date.now() })
    if (address !== owner.value) return
    const p = pending.value
    if (p && (p.pin === pin || isStale(p))) setPending(null)
  }

  /** Узнать закреплённое у профиля; ошибка сети — остаётся неизвестным. */
  async function ensure(address: string, force = false): Promise<void> {
    if (!address) return
    const known = pins.get(address)
    if (!force && known && Date.now() - known.at < PIN_TTL_MS) return
    const running = requests.get(address)
    if (running) return running
    const request = (async () => {
      try {
        remember(address, await fetchAccountSettings(address))
      } catch (e) {
        console.warn('[pinnedPosts] settings failed', address, e)
      } finally {
        requests.delete(address)
      }
    })()
    requests.set(address, request)
    return request
  }

  /** Закреплённый пост профиля: txid, '' — ничего, undefined — пока не знаем. */
  function pinOf(address: string): string | undefined {
    if (address && address === owner.value) {
      const p = pending.value
      if (p && !isStale(p)) return p.pin
    }
    return pins.get(address)?.pin
  }

  /** Своё закрепление, которое сеть ещё не показала (для новой цены подписки). */
  function pendingPin(): string | undefined {
    if (!owner.value) return undefined
    const p = pending.value
    return p && !isStale(p) ? p.pin : undefined
  }

  /**
   * Закрепить свой пост (`txid`) или открепить (''). `postId` — о каком посте
   * операция, для часиков в шапке: при откреплении это прежний закреплённый.
   */
  async function setPin(txid: string, postId: string = txid): Promise<string> {
    const address = me.value
    if (!address) throw new Error(t('paidSubscriptions.errAuthRequired'))
    adopt(address)
    const { saveAccountSettings } =
      await import('@/blockchain/core/actions/account-settings-action')
    const price = usePaidSubscriptionsStore().pricePending
    const { txid: sent } = await saveAccountSettings(
      { pin: txid, ...(price ? { paidsubscription: price.value } : {}) },
      { kind: 'postPin', ...(postId ? { postId } : {}) }
    )
    setPending({ pin: txid, txid: sent, at: nowSeconds() })
    return sent
  }

  /** Смена аккаунта: своё неподтверждённое — данные аккаунта. */
  function reset(): void {
    owner.value = ''
    pending.value = null
    pins.clear()
    requests.clear()
    adopt(me.value)
  }

  return { pending, remember, ensure, pinOf, pendingPin, setPin, reset }
})
