/**
 * Топ аккаунтов (страница `/top`): список из `services/top-accounts`, профили —
 * по мере прокрутки, только тех строк, до которых дошли.
 *
 * Список живёт полчаса: нода пересчитывает репутацию с каждым блоком, но
 * места за это время почти не меняются, а сбор — несколько секунд. Устаревший
 * список пересобирается при следующем открытии страницы, а пока идёт сбор,
 * виден прежний.
 */

import { defineStore } from 'pinia'

import { fetchProfiles, fetchTopByReputation, type TopEntry } from '@/services/top-accounts'
import type { UserProfile } from '@/types/rpc-responses/user-get'

const FRESH_MS = 30 * 60 * 1000

export const useTopAccountsStore = defineStore('topAccounts', {
  state: () => ({
    status: 'idle' as 'idle' | 'loading' | 'ready' | 'error',
    entries: [] as TopEntry[],
    loadedAt: 0,
    profiles: {} as Record<string, UserProfile>,
  }),

  actions: {
    /** Собрать топ, если его ещё нет или он устарел. */
    async load(force = false): Promise<void> {
      if (loadInFlight) return
      if (!force && this.status === 'ready' && Date.now() - this.loadedAt < FRESH_MS) return
      loadInFlight = true
      if (!this.entries.length) this.status = 'loading'
      try {
        const { entries, profiles } = await fetchTopByReputation()
        this.entries = entries
        this.rememberProfiles(profiles)
        this.loadedAt = Date.now()
        this.status = 'ready'
      } catch (e) {
        console.warn('[top-accounts] load failed', e)
        this.status = this.entries.length ? 'ready' : 'error'
      } finally {
        loadInFlight = false
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
  },
})

// Запросы в пути — вне состояния: реактивность им не нужна.
let loadInFlight = false
const profilesInFlight = new Set<string>()
