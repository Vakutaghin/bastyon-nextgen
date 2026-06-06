/**
 * Рекомендованные пользователи для подписки (правый сайдбар).
 *
 * Источник (сверено с legacy `components/recommendedusers` + `js/satolist.js`):
 *   - авторизован → `getrecommendedaccountbyaddress([address, '', [], lang, count])`
 *     (персонализировано);
 *   - аноним → `gettopaccounts([0, count, lang, [], [], '', [], depth])` (топ-аккаунты).
 * Элементы ответа: `{ address, name, i, subscribers_count }`.
 * Отфильтровываем себя и тех, на кого уже подписан.
 */

import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { rpcCall } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { extractAvatarFromProfile } from '@/helpers/common/profile-avatar'
import { useAuthStore } from '@/blockchain/store/auth-store'
import { useUIStore } from '@/stores/ui-store'
import { useUserRelationsStore } from '@/stores'

/** depth для gettopaccounts (legacy-дефолт). */
const TOP_ACCOUNTS_DEPTH = 10000

export interface RecommendedUser {
  address: string
  name: string
  avatar: string | null
  subscribersCount: number
}

type RawAccount = {
  address?: string
  name?: string
  i?: string
  subscribers_count?: number | string
}

/**
 * @param limit сколько показать (запрашиваем с запасом, т.к. часть отфильтруется).
 */
export function useRecommendedUsers(limit = 8) {
  const authStore = useAuthStore()
  const uiStore = useUIStore()
  const relations = useUserRelationsStore()

  const address = computed<string | null>(() => authStore.getUserAddress ?? null)
  const lang = computed(() => uiStore.language)
  const fetchCount = limit + 12

  const { data, isLoading, error } = useQuery<RawAccount[]>({
    queryKey: computed(() => ['recommended-users', address.value, lang.value]),
    queryFn: () => {
      const params = address.value
        ? {
            method: rpcEndpoints.getRecommendedAccountByAddress,
            parameters: [address.value, '', [], lang.value, fetchCount],
            options: { auth: false },
          }
        : {
            method: rpcEndpoints.getTopAccounts,
            parameters: [0, fetchCount, lang.value, [], [], '', [], TOP_ACCOUNTS_DEPTH],
            options: { auth: false },
          }
      return rpcCall<RawAccount[]>(params)
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  const users = computed<RecommendedUser[]>(() => {
    const raw = data.value
    const list: RawAccount[] = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as { data?: RawAccount[] } | null)?.data)
        ? (raw as { data: RawAccount[] }).data
        : []

    const me = address.value
    const seen = new Set<string>()
    const out: RecommendedUser[] = []
    for (const item of list) {
      const addr = item?.address
      if (typeof addr !== 'string' || !addr) continue
      if (addr === me || seen.has(addr) || relations.isSubscribed(addr)) continue
      seen.add(addr)
      const rep = Number(item.subscribers_count ?? 0)
      out.push({
        address: addr,
        name: item.name?.trim() || addr.slice(0, 8) + '…',
        avatar: extractAvatarFromProfile(item) ?? null,
        subscribersCount: Number.isFinite(rep) ? rep : 0,
      })
      if (out.length >= limit) break
    }
    return out
  })

  return { users, isLoading, error }
}
