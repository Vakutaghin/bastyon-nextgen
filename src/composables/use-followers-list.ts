/**
 * Списки подписчиков (followers) и подписок (following) пользователя.
 *
 * Источник адресов — нода:
 *   - followers → `getusersubscribers(address, '', '', 0, 5000)` (элементы с `.address`);
 *   - following → `getusersubscribes(address, '', '', 0, 5000)` (элементы с `.adddress`/`.private`).
 * В каждой строке нода отдаёт и репутацию (×10), и высоту блока подписки —
 * по ним список сортируется без лишних запросов: «сначала новые» или «по
 * репутации». Профили (аватар/имя/репутация) резолвятся батчем через
 * {@link useUserProfiles} — только для видимого среза (`visibleCount`),
 * модалка наращивает его «показать ещё».
 *
 * Поиск — по нику и адресу. Ников в списке нет: на первый поиск имена всех
 * догружаются пачками, найденное прибавляется по мере ответа.
 *
 * `hidden` — адреса, которых в списке быть не должно: старый клиент убирал из
 * подписчиков и подписок тех, кого владелец профиля заблокировал.
 */

import { computed, ref, unref, watch, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { rpcCall } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { useUserProfiles } from './use-user-profile'
import { resolveAvatarUrl } from '@/helpers/common/avatar-resolver'
import { peekUserName, preloadUserNames, userName } from '@/services/user-names'
import type { UserProfile } from '@/types/rpc-responses/user-get'

export type RelationListType = 'followers' | 'following'

/** Порядок списка: по высоте блока подписки (новые сверху) или по репутации. */
export type RelationSort = 'new' | 'reputation'
export const RELATION_SORTS: readonly RelationSort[] = ['new', 'reputation']
/** Выбранный порядок: общий для всех списков и держится до перезапуска. */
export const relationSortOrder = ref<RelationSort>('new')

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
  /** Репутация ×10, как в топе подписчиков. */
  reputation?: unknown
  /** Высота блока, в котором подписались. */
  height?: unknown
}

interface ListEntry {
  address: string
  isPrivate: boolean
  /** Из строки ноды; `null` — нода её не прислала. */
  reputation: number | null
  height: number
}

/** Имён за один шаг поиска: пачки профилей по 50 — пять запросов разом. */
const NAMES_STEP = 250
/** Шаг поиска ждёт имена не дольше: медленная нода не держит остальные. */
const NAMES_STEP_TIMEOUT_MS = 20_000

function resolve<T>(v: MaybeRefOrGetter<T>): T {
  return typeof v === 'function' ? (v as () => T)() : unref(v)
}

/** Аватар из профиля: accSet.image приоритетнее legacy-поля `i`. */
function avatarFromProfile(p: UserProfile | undefined): string | null {
  // Через resolveAvatarUrl: в профиле лежит голый хеш или ссылка на
  // `pocketnet.app:8092`, и без нормализации картинка не грузится (S58).
  return resolveAvatarUrl(p) ?? null
}

function isPrivateSub(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1'
}

function finite(value: unknown): number | null {
  const n = Number(value)
  return value !== undefined && value !== null && value !== '' && Number.isFinite(n) ? n : null
}

/** Запрос из поля: без пробелов по краям и `@` перед ником, в нижнем регистре. */
export function normalizeRelationQuery(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase()
}

/** Порядок списка; при равенстве — как прислала нода. */
export function sortRelations<T extends { reputation: number | null; height: number }>(
  list: readonly T[],
  sort: RelationSort
): T[] {
  const indexed = list.map((entry, index) => ({ entry, index }))
  indexed.sort((a, b) => {
    const byRep =
      sort === 'reputation' ? (b.entry.reputation ?? -1) - (a.entry.reputation ?? -1) : 0
    return byRep || b.entry.height - a.entry.height || a.index - b.index
  })
  return indexed.map((item) => item.entry)
}

export function useFollowersList(
  profileAddress: MaybeRefOrGetter<string>,
  type: MaybeRefOrGetter<RelationListType>,
  visibleCount: MaybeRefOrGetter<number>,
  enabled: MaybeRefOrGetter<boolean> = true,
  hidden: MaybeRefOrGetter<readonly string[]> = [],
  sort: MaybeRefOrGetter<RelationSort> = 'new',
  searchQuery: MaybeRefOrGetter<string> = ''
) {
  const address = computed(() => resolve(profileAddress))
  const listType = computed(() => resolve(type))
  const isEnabled = computed(() => !!resolve(enabled) && !!address.value)
  const query = computed(() => normalizeRelationQuery(resolve(searchQuery)))

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

  const allEntries = computed<ListEntry[]>(() => {
    const list = rawList.value
    if (!Array.isArray(list)) return []
    const seen = new Set<string>(resolve(hidden))
    const out: ListEntry[] = []
    for (const item of list) {
      const addr = item?.adddress ?? item?.address
      if (typeof addr === 'string' && addr && !seen.has(addr)) {
        seen.add(addr)
        const rep = finite(item.reputation)
        out.push({
          address: addr,
          isPrivate: isPrivateSub(item.private),
          reputation: rep === null ? null : rep / 10,
          height: finite(item.height) ?? 0,
        })
      }
    }
    return out
  })

  const totalCount = computed(() => allEntries.value.length)

  const sortedEntries = computed(() => sortRelations(allEntries.value, resolve(sort)))

  // 2. Поиск: по адресу и по уже известному нику.
  const foundEntries = computed(() => {
    const q = query.value
    if (!q) return sortedEntries.value
    return sortedEntries.value.filter(
      (e) =>
        e.address.toLowerCase().includes(q) || peekUserName(e.address).toLowerCase().includes(q)
    )
  })
  const matchCount = computed(() => foundEntries.value.length)

  // Первый поиск по списку просит имена всех — один раз на список.
  const namesLoading = ref(false)
  let namesFor: readonly ListEntry[] | null = null
  watch(
    () => [query.value !== '', allEntries.value] as const,
    async ([searching, list]) => {
      if (!searching || namesFor === list || list.length === 0) return
      namesFor = list
      namesLoading.value = true
      const addresses = list.map((e) => e.address)
      try {
        for (let i = 0; i < addresses.length && namesFor === list; i += NAMES_STEP) {
          await preloadUserNames(addresses.slice(i, i + NAMES_STEP), NAMES_STEP_TIMEOUT_MS)
        }
      } finally {
        if (namesFor === list) namesLoading.value = false
      }
    }
  )

  // 3. Видимый срез — только для него резолвим профили.
  const visibleEntries = computed(() =>
    foundEntries.value.slice(0, Math.max(0, resolve(visibleCount)))
  )
  const visibleAddresses = computed(() => visibleEntries.value.map((e) => e.address))
  const hasMore = computed(() => visibleEntries.value.length < foundEntries.value.length)

  // 4. Батч-резолв профилей видимого среза.
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
      const reputation = Number(p?.reputation ?? entry.reputation ?? 0)
      return {
        address: entry.address,
        name: userName(entry.address, p),
        avatar: avatarFromProfile(p),
        reputation: Number.isFinite(reputation) ? reputation : 0,
        isPrivate: entry.isPrivate,
      }
    })
  )

  const isLoading = computed(() => isLoadingAddresses.value || isLoadingProfiles.value)

  return { rows, totalCount, matchCount, hasMore, isLoading, namesLoading, error }
}
