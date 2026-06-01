/**
 * Отношения текущего пользователя с другими (блок-лист).
 *
 * Источник истины — блокчейн: список заблокированных адресов приходит в
 * `getuserprofile(myAddress).blocking` (string[]). Стор гидрируется из ноды
 * при init() и оптимистично обновляется при block()/unblock(), которые шлют
 * on-chain транзакции `blocking`/`unblocking` (см. core/actions/user-relations-action).
 *
 * Ограничение: блокировки, сделанные на другом устройстве/в legacy-клиенте,
 * подхватятся только после refresh() (повторного getuserprofile). В рамках
 * текущей сессии блок-лист консистентен.
 */

import { defineStore } from 'pinia'
import { useAuthStore } from '@/stores'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { rpcCall } from '@/helpers/api/request'
import {
  blockUser as blockUserTx,
  unblockUser as unblockUserTx,
} from '@/blockchain/core/actions/user-relations-action'
import type { UserProfile } from '@/types/rpc-responses/user-get'

export const useUserRelationsStore = defineStore('userRelations', {
  state: () => ({
    /** Адреса, заблокированные текущим пользователем. */
    blocked: new Set<string>(),
    /** Адреса с in-flight block/unblock транзакцией (для дизейбла кнопок). */
    pending: new Set<string>(),
    /** Адреса, которые заблокировали МЕНЯ (legacy checkBanned, #34). */
    bannedBy: new Set<string>(),
    /** Адреса, чей блок-лист уже проверен (чтобы не дёргать getuserprofile повторно). */
    checkedAuthors: new Set<string>(),
    isInitialized: false,
    isLoading: false,
  }),

  getters: {
    /** Заблокирован ли адрес текущим пользователем. */
    isBlocked(): (address: string) => boolean {
      return (address: string) => this.blocked.has(address)
    },
    /** Идёт ли по адресу block/unblock транзакция. */
    isPending(): (address: string) => boolean {
      return (address: string) => this.pending.has(address)
    },
    /** Множество заблокированных адресов (для isBlockedByMe в visibility). */
    blockedSet(): ReadonlySet<string> {
      return this.blocked
    },
    /** Заблокировал ли указанный автор текущего пользователя (#34). */
    isBannedBy(): (address: string) => boolean {
      return (address: string) => this.bannedBy.has(address)
    },
  },

  actions: {
    /** Загружает блок-лист из ноды один раз за сессию. */
    async init(): Promise<void> {
      if (this.isInitialized) return
      this.isInitialized = true
      await this.refresh()
    },

    /** Перечитывает блок-лист текущего пользователя из getuserprofile. */
    async refresh(): Promise<void> {
      const address = useAuthStore().getUserAddress
      if (!address) return
      this.isLoading = true
      try {
        const arr = await rpcCall<UserProfile[]>({
          method: rpcEndpoints.getUserProfile,
          parameters: [[address]],
          options: { auth: false },
        })
        const me = Array.isArray(arr) ? (arr.find((p) => p?.address === address) ?? arr[0]) : null
        const list = Array.isArray(me?.blocking) ? (me!.blocking as string[]) : []
        this.blocked = new Set(list.filter((a): a is string => typeof a === 'string' && !!a))
      } catch (e) {
        console.warn('[userRelations] refresh failed', e)
      } finally {
        this.isLoading = false
      }
    },

    /** Заблокировать адрес: оптимистично + on-chain tx, откат при ошибке. */
    async block(address: string): Promise<void> {
      if (!address || this.pending.has(address) || this.blocked.has(address)) return
      this.pending.add(address)
      this.blocked.add(address)
      try {
        await blockUserTx(address)
      } catch (e) {
        this.blocked.delete(address)
        throw e
      } finally {
        this.pending.delete(address)
      }
    },

    /** Разблокировать адрес: оптимистично + on-chain tx, откат при ошибке. */
    async unblock(address: string): Promise<void> {
      if (!address || this.pending.has(address) || !this.blocked.has(address)) return
      this.pending.add(address)
      this.blocked.delete(address)
      try {
        await unblockUserTx(address)
      } catch (e) {
        this.blocked.add(address)
        throw e
      } finally {
        this.pending.delete(address)
      }
    },

    /**
     * Проверяет, заблокировал ли `authorAddress` текущего пользователя (#34).
     * Результат кешируется (checkedAuthors), чтобы не дёргать getuserprofile повторно.
     * Вызывать в момент реальной вовлечённости (фокус composer), а не на каждую карточку ленты.
     */
    async checkBannedBy(authorAddress: string): Promise<void> {
      const me = useAuthStore().getUserAddress
      if (!me || !authorAddress || authorAddress === me) return
      if (this.checkedAuthors.has(authorAddress)) return
      this.checkedAuthors.add(authorAddress)
      try {
        const arr = await rpcCall<UserProfile[]>({
          method: rpcEndpoints.getUserProfile,
          parameters: [[authorAddress]],
          options: { auth: false },
        })
        const prof = Array.isArray(arr)
          ? (arr.find((p) => p?.address === authorAddress) ?? arr[0])
          : null
        const blocking = Array.isArray(prof?.blocking) ? (prof!.blocking as string[]) : []
        if (blocking.includes(me)) this.bannedBy.add(authorAddress)
      } catch (e) {
        this.checkedAuthors.delete(authorAddress) // разрешаем повтор при сетевой ошибке
        console.warn('[userRelations] checkBannedBy failed', e)
      }
    },

    /** Сброс при разлогине. */
    reset(): void {
      this.blocked = new Set()
      this.pending = new Set()
      this.bannedBy = new Set()
      this.checkedAuthors = new Set()
      this.isInitialized = false
      this.isLoading = false
    },
  },
})
