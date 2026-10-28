/**
 * Топ аккаунтов (страница `/top`): список из `services/top-accounts`, профили
 * и балансы — по мере прокрутки, только тех строк, до которых дошли. «По
 * PKOIN» нужен баланс каждого из топа: он собирается один раз с ходом
 * «узнано N из M» и дальше берётся отсюда.
 *
 * Список живёт полчаса: нода пересчитывает репутацию с каждым блоком, но
 * места за это время почти не меняются, а сбор — несколько секунд.
 */

import { defineStore } from 'pinia'

import {
  fetchBalance,
  fetchProfiles,
  fetchTopByReputation,
  type TopEntry,
} from '@/services/top-accounts'
import type { UserProfile } from '@/types/rpc-responses/user-get'

const FRESH_MS = 30 * 60 * 1000
/** Одновременных запросов баланса: нода отвечает на каждый за доли секунды. */
const BALANCE_CONCURRENCY = 8

export const useTopAccountsStore = defineStore('topAccounts', {
  state: () => ({
    status: 'idle' as 'idle' | 'loading' | 'ready' | 'error',
    entries: [] as TopEntry[],
    loadedAt: 0,
    profiles: {} as Record<string, UserProfile>,
    /** Баланс в PKOIN; null — нода не ответила. */
    balances: {} as Record<string, number | null>,
  }),

  getters: {
    /** По PKOIN: у кого баланс известен — по убыванию, без ответа ноды — в конце. */
    byBalance(): TopEntry[] {
      const known = this.entries.filter((e) => typeof this.balances[e.address] === 'number')
      const rest = this.entries.filter((e) => typeof this.balances[e.address] !== 'number')
      known.sort((a, b) => this.balances[b.address]! - this.balances[a.address]!)
      return [...known, ...rest]
    },
    /** Сколько балансов уже известно (или нода на них не ответила). */
    balancesDone(): number {
      return this.entries.filter((e) => e.address in this.balances).length
    },
  },

  actions: {
    /** Собрать топ, если его ещё нет или он устарел. */
    async load(force = false): Promise<void> {
      if (this.status === 'loading') return
      if (!force && this.status === 'ready' && Date.now() - this.loadedAt < FRESH_MS) return
      this.status = 'loading'
      try {
        const { entries, profiles } = await fetchTopByReputation()
        this.entries = entries
        this.rememberProfiles(profiles)
        this.loadedAt = Date.now()
        this.status = 'ready'
      } catch (e) {
        console.warn('[top-accounts] load failed', e)
        this.status = this.entries.length ? 'ready' : 'error'
      }
    },

    rememberProfiles(profiles: UserProfile[]): void {
      const next = { ...this.profiles }
      for (const p of profiles) if (p?.address) next[p.address] = p
      this.profiles = next
    },

    /** Профили этих адресов, кроме уже известных и уже запрошенных. */
    async ensureProfiles(addresses: readonly string[]): Promise<void> {
      const missing = addresses.filter((a) => !this.profiles[a] && !profilesInFlight.has(a))
      if (!missing.length) return
      for (const a of missing) profilesInFlight.add(a)
      try {
        this.rememberProfiles(await fetchProfiles(missing))
      } catch (e) {
        console.warn('[top-accounts] profiles failed', e)
      } finally {
        for (const a of missing) profilesInFlight.delete(a)
      }
    },

    /** Балансы этих адресов: по несколько запросов сразу, каждый — сразу в стор. */
    async ensureBalances(addresses: readonly string[]): Promise<void> {
      const queue = addresses.filter((a) => !(a in this.balances) && !balancesInFlight.has(a))
      for (const a of queue) balancesInFlight.add(a)
      const worker = async (): Promise<void> => {
        for (let address = queue.shift(); address; address = queue.shift()) {
          let balance: number | null = null
          try {
            balance = await fetchBalance(address)
          } catch {
            // Нода не ответила — в «по PKOIN» он уйдёт в конец с прочерком.
          }
          this.balances = { ...this.balances, [address]: balance }
          balancesInFlight.delete(address)
        }
      }
      await Promise.all(Array.from({ length: BALANCE_CONCURRENCY }, worker))
    },
  },
})

// Запросы в пути — вне состояния: реактивность им не нужна.
const profilesInFlight = new Set<string>()
const balancesInFlight = new Set<string>()
