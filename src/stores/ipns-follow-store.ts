// «Следить за обновлениями» — чужие постоянные ссылки (имена IPNS) из чата.
//
// Раз в час, пока приложение открыто, проверяется запись имени: если её
// перевели на новое содержимое, появляется уведомление. Проверенную запись
// приложение заодно переиздаёт раз в 12 часов — подписанную владельцем запись
// может переиздать кто угодно, и ссылка живёт, даже когда владелец не в сети
// (до конца срока записи). Это «Раздавать дальше» для имён.
//
// Список — на устройстве, по аккаунтам: `BST_IPNS_FOLLOW_<адрес>`. Под Tor
// проверок нет: запросы шли бы мимо Tor.
import { defineStore } from 'pinia'
import { IPNS_FOLLOW_PREFIX } from '@/blockchain/constants/storage'
import type { NameRecord } from '@/helpers/ipfs/ipns-names'
import { useIpfsStore } from '@/stores/ipfs-store'
import {
  BlockedByTorError,
  publishNameRecord,
  RENEW_EVERY_MS,
  torEnabled,
} from '@/stores/ipns-names-store'

/** Не чаще: таймер срабатывает раз в час, но не ровно. */
const CHECK_EVERY_MS = 55 * 60_000

export interface FollowedName {
  /** `k51…` */
  name: string
  /** Куда вело имя при последней проверке; '' — записи ещё не было. */
  value: string
  /** Номер записи — строкой: в JSON нет bigint. */
  sequence: string
  checkedAt: number
  rebroadcastAt: number
}

/** Имя перевели на новое содержимое. */
export interface NameUpdate {
  name: string
  value: string
}

const loadNames = () => import('@/helpers/ipfs/ipns-names')

function storageKey(account: string): string {
  return `${IPNS_FOLLOW_PREFIX}${account}`
}

function readFollowed(account: string): FollowedName[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(account)) ?? '[]')
    return Array.isArray(parsed) ? (parsed as FollowedName[]) : []
  } catch {
    return []
  }
}

export const useIpnsFollowStore = defineStore('ipns-follow', {
  state: () => ({
    account: '',
    followed: [] as FollowedName[],
    checking: false,
  }),

  actions: {
    use(account: string): void {
      if (this.account === account) return
      this.account = account
      this.followed = account ? readFollowed(account) : []
    },

    _save(): void {
      if (!this.account) return
      try {
        localStorage.setItem(storageKey(this.account), JSON.stringify(this.followed))
      } catch {
        // Не сохранили — после перезапуска за именем снова нужно будет следить.
      }
    },

    isFollowed(name: string): boolean {
      return this.followed.some((f) => f.name === name)
    },

    /** Следить: запомнить, куда имя ведёт сейчас, чтобы заметить перевод. */
    async follow(name: string): Promise<void> {
      if (!this.account || this.isFollowed(name)) return
      if (torEnabled()) {
        useIpfsStore().showTorBlocked()
        throw new BlockedByTorError()
      }
      const { fetchRecord } = await loadNames()
      const record = await fetchRecord(name)
      const now = Date.now()
      this.followed = [
        ...this.followed,
        {
          name,
          value: record?.value ?? '',
          sequence: (record?.sequence ?? 0n).toString(),
          checkedAt: now,
          rebroadcastAt: 0,
        },
      ]
      this._save()
      if (record) await this._rebroadcast(name, record, now)
    },

    unfollow(name: string): void {
      this.followed = this.followed.filter((f) => f.name !== name)
      this._save()
    },

    async _rebroadcast(name: string, record: NameRecord, now: number): Promise<void> {
      const entry = this.followed.find((f) => f.name === name)
      if (!entry || now - entry.rebroadcastAt < RENEW_EVERY_MS) return
      if (record.validUntil.getTime() <= now) return
      try {
        await publishNameRecord(record)
        entry.rebroadcastAt = now
      } catch (e) {
        console.warn('[ipns] rebroadcast failed:', name, e)
      }
    },

    /**
     * Проверить имена, за которыми следим. Возвращает те, что перевели на
     * новое содержимое, — о них показывает уведомление вызывающий.
     */
    async check(now = Date.now()): Promise<NameUpdate[]> {
      if (!this.followed.length || torEnabled() || this.checking) return []
      this.checking = true
      const updates: NameUpdate[] = []
      try {
        const { fetchRecord } = await loadNames()
        for (const entry of this.followed) {
          if (now - entry.checkedAt < CHECK_EVERY_MS) continue
          let record: NameRecord | null
          try {
            record = await fetchRecord(entry.name)
          } catch {
            continue
          }
          entry.checkedAt = now
          if (!record) continue
          if (record.sequence > BigInt(entry.sequence)) {
            if (entry.value && record.value !== entry.value) {
              updates.push({ name: entry.name, value: record.value })
            }
            entry.value = record.value
            entry.sequence = record.sequence.toString()
          }
          await this._rebroadcast(entry.name, record, now)
        }
        this._save()
      } finally {
        this.checking = false
      }
      return updates
    },
  },
})
