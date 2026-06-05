/**
 * Списки подписчиков (followers) и подписок (following) пользователя.
 *
 * Источник адресов — нода:
 *   - followers → `getusersubscribers(address, '', '', 0, 5000)` (элементы с `.address`);
 *   - following → `getusersubscribes(address, '', '', 0, 5000)` (элементы с `.adddress`/`.private`).
 * Профили (аватар/имя/репутация) резолвятся батчем через {@link useUserProfiles}.
 *
 * Производительность: полный список адресов грузится разом, но профили резолвятся
 * только для видимого среза (`visibleCount`) — модалка наращивает его «показать ещё».
 */

import { computed, unref, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { rpcCall } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { useUserProfiles } from './use-user-profile'
import type { UserProfile } from '@/types/rpc-responses/user-get'

export type RelationListType = 'followers' | 'following'

/** Строка списка: адрес + резолвнутые данные профиля. */
export interface RelationEntry {
  address: string
  name: string
  avatar: string | null
  reputation: number
  /** Приватная подписка (только для following, иначе false). */
  isPrivate: boolean
}

type RawRelation = {
  address?: string
  adddress?: string
  private?: unknown
}

function resolve<T>(v: MaybeRefOrGetter<T>): T {
  return typeof v === 'function' ? (v as () => T)() : unref(v)
}

/** Аватар из профиля: accSet.image приоритетнее legacy-поля `i`. */
function avatarFromProfile(p: UserProfile | undefined): string | null {
  const withAcc = p as (UserProfile & { accSet?: { image?: string } }) | undefined
  return withAcc?.accSet?.image || withAcc?.i || null
}

function isPrivateSub(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1'
}

export function useFollowersList(
  profileAddress: MaybeRefOrGetter<string>,
  type: MaybeRefOrGetter<RelationListType>,
  visibleCount: MaybeRefOrGetter<number>,
  enabled: MaybeRefOrGetter<boolean> = true
) {
  const address = computed(() => resolve(profileAddress))
  const listType = computed(() => resolve(type))
  const isEnabled = computed(() => !!resolve(enabled) && !!address.value)

  // 1. Список адресов (followers/following) + флаг приватности по адресу.
  const {
    data: rawList,
    isLoading: isLoadingAddresses,
    error,
  } = useQuery<RawRelation[]>({
    queryKey: computed(() => ['relation-list', listType.value, address.value]),
    queryFn: () =>
      rpcCall<RawRelation[]>({
        method:
          listType.value === 'followers'
            ? rpcEndpoints.getUserSubscribers
            : rpcEndpoints.getUserSubscribes,
        parameters: [address.value, '', '', 0, 5000],
        options: { auth: false },
      }),
    enabled: isEnabled,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })

  const allEntries = computed<{ address: string; isPrivate: boolean }[]>(() => {
    const list = rawList.value
    if (!Array.isArray(list)) return []
    const seen = new Set<string>()
    const out: { address: string; isPrivate: boolean }[] = []
    for (const item of list) {
      const addr = item?.adddress ?? item?.address
      if (typeof addr === 'string' && addr && !seen.has(addr)) {
        seen.add(addr)
        out.push({ address: addr, isPrivate: isPrivateSub(item.private) })
      }
    }
    return out
  })

  const totalCount = computed(() => allEntries.value.length)

  // 2. Видимый срез — только для него резолвим профили.
  const visibleEntries = computed(() =>
    allEntries.value.slice(0, Math.max(0, resolve(visibleCount)))
  )
  const visibleAddresses = computed(() => visibleEntries.value.map((e) => e.address))
  const hasMore = computed(() => visibleEntries.value.length < totalCount.value)

  // 3. Батч-резолв профилей видимого среза.
  const { data: profiles, isLoading: isLoadingProfiles } = useUserProfiles(visibleAddresses)

  const profileByAddress = computed<Map<string, UserProfile>>(() => {
    const map = new Map<string, UserProfile>()
    const arr = profiles.value
    if (Array.isArray(arr)) {
      for (const p of arr) if (p?.address) map.set(p.address, p)
    }
    return map
  })

  const rows = computed<RelationEntry[]>(() =>
    visibleEntries.value.map((entry) => {
      const p = profileByAddress.value.get(entry.address)
      const reputation = Number(p?.reputation ?? 0)
      return {
        address: entry.address,
        name: p?.name || entry.address,
        avatar: avatarFromProfile(p),
        reputation: Number.isFinite(reputation) ? reputation : 0,
        isPrivate: entry.isPrivate,
      }
    })
  )

  const isLoading = computed(() => isLoadingAddresses.value || isLoadingProfiles.value)

  return { rows, totalCount, hasMore, isLoading, error }
}
